# standard imports
from django.http import HttpResponse
from django.shortcuts import render
from django.views.decorators.csrf import csrf_exempt
# authentication removed for public staff pages
from django.http import JsonResponse
from django.views.decorators.http import require_POST
from django.conf import settings
import json
import urllib.request
import urllib.error
import urllib.parse
from datetime import datetime
import re
try:
    import requests
except ImportError:
    requests = None

NEWS_API_BASE = "https://news-portal-hvgs.onrender.com/api"
HOP_BY_HOP_HEADERS = {
    "connection",
    "keep-alive",
    "proxy-authenticate",
    "proxy-authorization",
    "te",
    "trailers",
    "transfer-encoding",
    "upgrade",
    "content-encoding",
    "content-length",
}


def fetch_json(path):
    url = f"{NEWS_API_BASE}{path}"
    req = urllib.request.Request(url, headers={
        "Accept": "application/json",
        "User-Agent": "Mozilla/5.0"
    })
    with urllib.request.urlopen(req, timeout=20) as resp:
        return json.loads(resp.read().decode())


@csrf_exempt
def api_proxy(request, path):
    query = request.META.get("QUERY_STRING")
    url = f"{NEWS_API_BASE}/{path}"

    if query:
        url = f"{url}?{query}"

    headers = {
        "Accept": request.headers.get("Accept", "application/json"),
        "User-Agent": "Mozilla/5.0",
    }

    content_type = request.headers.get("Content-Type")
    authorization = request.headers.get("Authorization")

    if content_type:
        headers["Content-Type"] = content_type

    if authorization:
        headers["Authorization"] = authorization

    body = request.body if request.method not in ("GET", "HEAD") else None

    if requests is None:
        return HttpResponse(
            json.dumps({"detail": "requests library not installed on server. Install it in your virtualenv (pip install requests)."}),
            status=500,
            content_type="application/json",
        )

    try:
        remote_response = requests.request(
            request.method,
            url,
            data=body,
            headers=headers,
            timeout=30,
        )
    except requests.RequestException as error:
        return HttpResponse(
            json.dumps({"detail": str(error)}),
            status=502,
            content_type="application/json",
        )

    django_response = HttpResponse(
        remote_response.content,
        status=remote_response.status_code,
        content_type=remote_response.headers.get("Content-Type", "application/json"),
    )
    for header, value in remote_response.headers.items():
        if header.lower() not in HOP_BY_HOP_HEADERS and header.lower() != "content-type":
            django_response[header] = value
    return django_response


def _time_ago(date_string):
    if not date_string:
        return ""
    try:
        cleaned = re.sub(r'([+-]\d{2}):(\d{2})$', r'\1\2', date_string)
        dt = datetime.fromisoformat(cleaned)
    except Exception:
        return date_string

    now = datetime.now(dt.tzinfo) if dt.tzinfo else datetime.now()
    diff = now - dt
    seconds = int(abs(diff.total_seconds()))

    intervals = (
        (31536000, 'year'),
        (2592000, 'month'),
        (604800, 'week'),
        (86400, 'day'),
        (3600, 'hour'),
        (60, 'minute'),
        (1, 'second'),
    )
    for divisor, label in intervals:
        count = seconds // divisor
        if count >= 1:
            return f"{count} {label}{'s' if count > 1 else ''} ago"
    return 'Just now'


def index(request):
    articles = []
    try:
        data = fetch_json("/articles/feed/?ordering=-id")
        articles = data.get("results", []) if isinstance(data, dict) else []
    except Exception as e:
        print("API fetch error:", e)
    return render(request, "frontend/index.html", {"articles": articles})


def news_detail(request, article_id):
    article = {}
    article_json_raw = "{}"
    article_body_text = ""
    try:
        article = fetch_json(f"/articles/{article_id}/") or {}
        article_body_text = article.get("body", article.get("description", "")) or ""
    except Exception:
        pass

    try:
        article_json_raw = json.dumps({
            "body": article_body_text,
            "description": article.get("description", ""),
            "title": article.get("title", ""),
        })
        article_json_raw = article_json_raw.replace("</script>", "<\\/script>")
    except Exception:
        pass

    comments_raw = article.get("comments", "")
    comments = []
    if comments_raw:
        try:
            if comments_raw.strip().startswith("["):
                parsed = json.loads(comments_raw)
            else:
                parsed = list(json.loads(comments_raw).values())
        except Exception:
            parsed = []

        for c in parsed:
            if isinstance(c, dict):
                author = c.get('author_name', c.get('user_name', 'Anonymous'))
                text = c.get('text', c.get('body', c.get('content', '')))
                created = c.get('created_at', '')
                profile_pic = c.get('profile_pic', c.get('avatar_url', ''))
                name_parts = str(author).strip().split()
                if len(name_parts) >= 2:
                    initials = (name_parts[0][0] + name_parts[-1][0]).upper()
                elif author:
                    initials = str(author)[:2].upper()
                else:
                    initials = "?"
                comments.append({
                    "author_name": author,
                    "text": text,
                    "created_at": created,
                    "time_ago": _time_ago(created),
                    "profile_pic": profile_pic,
                    "author_initials": initials,
                })

    return render(request, "frontend/news_detail.html", {
        "article": article,
        "article_json": article_json_raw,
        "comments": comments,
    })


def newsletter(request):
    context = {}
    return render(request, "frontend/newsletter.html", context)

def register(request):
    """
    User registration page.
    Form submission is handled by frontend JavaScript against the DRF API.
    """
    context = {}
    return render(request, 'frontend/pages/register.html', context)

def login(request):
    """
    User login page.
    Authentication is handled by frontend JavaScript against the DRF JWT API.
    """
    context = {}
    return render(request, 'frontend/pages/login.html', context)


def _decode_jwt_payload(token):
    """Decode JWT payload without verification to extract claims (useful for role)."""
    try:
        parts = token.split('.')
        if len(parts) < 2:
            return {}
        payload_b64 = parts[1]
        # Add padding
        padding = '=' * (-len(payload_b64) % 4)
        payload_bytes = base64.urlsafe_b64decode(payload_b64 + padding)
        return json.loads(payload_bytes.decode())
    except Exception:
        return {}


def get_remote_user_info(access_token):
    """Attempt to fetch the current user from the remote API using common endpoints.
    Falls back to decoding the JWT token when no user endpoint exists.
    Returns a dict with at least 'role' or 'is_staff' keys when available.
    """
    if not access_token:
        return None

    headers = {'Authorization': f'Bearer {access_token}', 'Accept': 'application/json'}
    candidates = [
        '/users/me/',
        '/auth/users/me/',
        '/accounts/me/',
        '/me/',
    ]
    for path in candidates:
        try:
            url = f"{NEWS_API_BASE}{path}"
            resp = requests.get(url, headers=headers, timeout=10)
            if resp.status_code == 200:
                try:
                    return resp.json()
                except Exception:
                    return None
        except Exception:
            continue

    # Fallback: decode JWT payload
    payload = _decode_jwt_payload(access_token)
    user = {}
    # common claim names
    user['email'] = payload.get('email') or payload.get('username')
    user['role'] = payload.get('role') or payload.get('user_role')
    user['is_staff'] = payload.get('is_staff') or payload.get('staff') or False
    user['is_superuser'] = payload.get('is_superuser') or payload.get('admin') or False
    return user


@csrf_exempt
def auth_login(request):
    """Server-side login endpoint. Accepts POST with JSON {email,password}.
    Forwards credentials to remote API token endpoint, stores tokens in session,
    fetches remote user info, and returns JSON with a `next` URL for redirection.
    """
    if request.method != 'POST':
        return JsonResponse({'detail': 'Method not allowed'}, status=405)

    try:
        data = json.loads(request.body.decode()) if request.body else request.POST.dict()
    except Exception:
        data = request.POST.dict()

    email = data.get('email') or data.get('username')
    password = data.get('password')
    if not email or not password:
        return JsonResponse({'detail': 'Email and password are required.'}, status=400)

    if requests is None:
        return JsonResponse({'detail': 'requests library not installed on server.'}, status=500)

    # Try common token endpoints used by the remote API
    token_paths = ['/token/', '/auth/token/', '/auth/login/', '/api/token/']
    token_response = None
    for path in token_paths:
        try:
            url = f"{NEWS_API_BASE}{path}"
            resp = requests.post(url, json={'email': email, 'username': email, 'password': password}, timeout=15)
            if resp.status_code in (200, 201):
                token_response = resp
                break
        except requests.RequestException:
            continue

    if not token_response:
        return JsonResponse({'detail': 'Authentication failed. Unable to reach auth endpoint.'}, status=502)

    try:
        token_json = token_response.json()
    except Exception:
        return JsonResponse({'detail': 'Invalid response from auth endpoint.'}, status=502)

    access = token_json.get('access') or token_json.get('token') or token_json.get('access_token')
    refresh = token_json.get('refresh') or token_json.get('refresh_token')
    if not access:
        # Authentication failed - forward error message
        return JsonResponse(token_json, status=token_response.status_code)

    # Save tokens in session (server-side). Avoid exposing tokens to client JS.
    request.session['access_token'] = access
    if refresh:
        request.session['refresh_token'] = refresh

    # Fetch user info and store minimal profile
    user = get_remote_user_info(access) or {}
    request.session['user'] = user

    # Determine redirect based on role
    role = (user.get('role') or 'reader').lower() if isinstance(user.get('role'), str) else None
    if user.get('is_superuser') or user.get('is_staff') or role == 'admin':
        next_url = reverse('frontend:users')  # admin area
    elif role == 'staff' or user.get('is_staff'):
        next_url = reverse('frontend:staff')
    else:
        next_url = reverse('frontend:index')

    return JsonResponse({'detail': 'Login successful', 'next': next_url, 'role': role})


@csrf_exempt
def auth_logout(request):
    """Clear server-side session tokens and redirect to login."""
    try:
        request.session.pop('access_token', None)
        request.session.pop('refresh_token', None)
        request.session.pop('user', None)
    except Exception:
        pass
    return JsonResponse({'detail': 'Logged out', 'next': reverse('frontend:login')})


def require_remote_login(view_func):
    """Decorator to protect views that require a logged-in remote user.
    Checks for `access_token` in session and returns 302 to login when missing.
    """
    from functools import wraps

    @wraps(view_func)
    def _wrapped(request, *args, **kwargs):
        token = request.session.get('access_token')
        if not token:
            # Not logged in -> redirect to login page
            if request.is_ajax() or request.headers.get('Accept') == 'application/json':
                return JsonResponse({'detail': 'Authentication required'}, status=401)
            return redirect(reverse('frontend:login'))
        return view_func(request, *args, **kwargs)

    return _wrapped

def dashboard(request):
    """
    Newsletter page view.
    """
    # Render the staff dashboard for overview instead of the admin base
    return staff_dashboard(request)


def staff_dashboard(request):
    """Staff dashboard view (restricted to staff users)."""
    # require login
    token = request.session.get('access_token')
    user = request.session.get('user') or {}
    role = (user.get('role') or '').lower() if isinstance(user.get('role'), str) else None
    if not token or not (role == 'staff' or user.get('is_staff')):
        return redirect(reverse('frontend:login'))
    context = {}
    articles = []
    try:
        data = fetch_json('/articles/feed/?ordering=-id')
        if isinstance(data, dict):
            articles = data.get('results', [])
        elif isinstance(data, list):
            articles = data
    except Exception as e:
        print('staff_dashboard fetch error:', e)

    context['articles'] = articles
    return render(request, 'staff/pages/staff.html', context)


@csrf_exempt
@require_POST
def staff_add_article(request):
    """Receive article data from staff frontend and forward to remote API.

    Expects JSON body or form data with at least `title` and `body`.
    """
    # Require server-side login
    token = request.session.get('access_token')
    user = request.session.get('user') or {}
    role = (user.get('role') or '').lower() if isinstance(user.get('role'), str) else None
    if not token or not (role == 'staff' or user.get('is_staff')):
        return JsonResponse({'detail': 'Authentication required'}, status=401)

    try:
        # prefer JSON
        data = json.loads(request.body.decode()) if request.body else request.POST.dict()
    except Exception:
        data = request.POST.dict()

    payload = {
        'title': data.get('title', ''),
        'body': data.get('body', ''),
        'description': data.get('description', ''),
    }

    # Use the remote API's create endpoint for article creation
    url = f"{NEWS_API_BASE}/articles/create/"

    if requests is None:
        return JsonResponse({'detail': 'requests library not installed on server. Install it in your virtualenv (pip install requests).'}, status=500)


    try:
        headers = {'Accept': 'application/json', 'Authorization': f'Bearer {token}'}
        # Prefer client-provided Authorization header. If missing, allow a dev-only
        # fallback token when running in DEBUG and an environment token is configured.
        # token already added to headers above; allow fallback for debug
        if not headers.get('Authorization'):
            fallback = getattr(settings, 'ADMIN_FALLBACK_ACCESS_TOKEN', '')
            if settings.DEBUG and fallback:
                headers['Authorization'] = f'Bearer {fallback}'
            else:
                return JsonResponse({'detail': 'Missing Authorization header'}, status=401)

        # If the client sent multipart/form-data (file upload), forward as multipart
        content_type = request.META.get('CONTENT_TYPE', '')
        if content_type.startswith('multipart/'):
            files = {}
            data_fields = {}

            # request.POST contains form fields
            for k, v in request.POST.items():
                data_fields[k] = v

            # request.FILES contains uploaded files
            for k, f in request.FILES.items():
                # requests accepts file tuples: (filename, fileobj, content_type)
                files[k] = (f.name, f.read(), f.content_type)

            resp = requests.post(url, data=data_fields, files=files, headers=headers, timeout=30)
        else:
            # include any optional fields from JSON/form data
            for key in ('category', 'tags', 'status', 'image', 'featured', 'published'):
                if key in data:
                    if key in ('featured', 'published'):
                        val = data.get(key)
                        if isinstance(val, str):
                            payload[key] = val.lower() in ('1', 'true', 'yes', 'on')
                        else:
                            payload[key] = bool(val)
                    else:
                        payload[key] = data[key]

            resp = requests.post(url, json=payload, headers=headers, timeout=30)
    except requests.RequestException as e:
        return JsonResponse({'detail': str(e)}, status=502)

    try:
        return JsonResponse(resp.json(), status=resp.status_code)
    except Exception:
        # Return remote response content and status to help debugging when non-JSON
        content_type = resp.headers.get('Content-Type', 'application/octet-stream')
        return HttpResponse(resp.content, status=resp.status_code, content_type=content_type)

def users(request):
    """
    Users page view.
    """
    context = {}
    return render(request, 'admin/pages/users.html', context)


def articles(request):
    """
    Articles page view.
    """
    context = {}
    return render(request, 'admin/pages/articles.html', context)


def staff_articles(request):
    """Staff-facing articles page using the admin UI but served under staff templates."""
    context = {}
    return render(request, 'staff/pages/articles.html', context)


def categories(request):
    """
    Categories page view.
    """
    context = {}
    return render(request, 'staff/pages/categories.html', context)


def media(request):
    """
    Media library page view.
    """
    context = {}
    return render(request, 'admin/pages/media.html', context)


def roles(request):
    context = {}
    return render(request, 'admin/pages/roles.html', context)


def advertise(request):
    context = {}
    return render(request, 'admin/pages/advertise.html', context)


def tags(request):
    context = {}
    return render(request, 'admin/pages/tags.html', context)


def bookmarks(request):
    context = {}
    return render(request, 'admin/pages/bookmarks.html', context)


def comments(request):
    context = {}
    return render(request, 'staff/pages/comments.html', context)


def reacts(request):
    context = {}
    return render(request, 'admin/pages/reacts.html', context)
