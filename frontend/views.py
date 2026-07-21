from django.conf import settings
from django.http import HttpResponse
from django.shortcuts import redirect, render
from django.views.decorators.csrf import csrf_exempt
# authentication removed for public staff pages
from django.http import JsonResponse
from django.views.decorators.http import require_POST
from django.urls import reverse
from django.utils import timezone
from .models import Advertisement
import base64
import json
import urllib.request
import urllib.error
import urllib.parse
from datetime import datetime
import re
import requests

NEWS_REMOTE_ORIGIN = getattr(settings, 'API_BASE_URL', 'https://news-portal-hvgs.onrender.com').rstrip('/')
if NEWS_REMOTE_ORIGIN.endswith('/api'):
    NEWS_REMOTE_ORIGIN = NEWS_REMOTE_ORIGIN[:-4]

NEWS_API_BASE = f"{NEWS_REMOTE_ORIGIN}/api"
NEWS_ARTICLE_BASE = NEWS_REMOTE_ORIGIN
ARTICLE_STATUS_CHOICES = {'draft', 'pending_review', 'published', 'rejected'}
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


def _join_remote_path(base, path):
    return f"{base.rstrip('/')}/{str(path or '').lstrip('/')}"


def _is_article_path(path):
    clean_path = str(path or '').lstrip('/')
    return clean_path == 'articles' or clean_path.startswith('articles/')


def _remote_url_for_path(path):
    clean_path = str(path or '').lstrip('/')
    if clean_path.startswith('api/'):
        return _join_remote_path(NEWS_REMOTE_ORIGIN, clean_path)

    base = NEWS_ARTICLE_BASE if _is_article_path(clean_path) else NEWS_API_BASE
    return _join_remote_path(base, clean_path)


def _truthy(value):
    if isinstance(value, bool):
        return value
    if value is None:
        return False
    if isinstance(value, (int, float)):
        return bool(value)
    return str(value).strip().lower() in {'1', 'true', 'yes', 'on', 'published'}


def _normalize_article_status(value, published=None):
    if _truthy(published):
        return 'published'

    raw = str(value or '').strip().lower().replace('-', '_').replace(' ', '_')
    if raw in ARTICLE_STATUS_CHOICES:
        return raw
    if raw in {'archive', 'archived'}:
        return 'rejected'
    return 'draft'


def _remote_json_response(response):
    try:
        return response.json()
    except Exception:
        return None


def fetch_json(path):
    url = _remote_url_for_path(path)
    req = urllib.request.Request(url, headers={
        "Accept": "application/json",
        "User-Agent": "Mozilla/5.0"
    })
    with urllib.request.urlopen(req, timeout=20) as resp:
        return json.loads(resp.read().decode())


def _normalize_position(value):
    raw = str(value or '').strip().lower().replace(' ', '_')
    if raw in {'top_banner', 'sidebar', 'between_articles', 'footer_banner'}:
        return raw
    if raw in {'in_article', 'between_articles'}:
        return 'between_articles'
    if raw in {'footer', 'footer_banner'}:
        return 'footer_banner'
    return 'between_articles'


def _normalize_status(value, is_active=None):
    if is_active is not None:
        return 'active' if is_active else 'inactive'

    raw = str(value or '').strip().lower()
    if raw in {'inactive', 'disabled', 'draft', 'archived'}:
        return 'inactive'
    return 'active'


def _parse_datetime(value):
    if not value:
        return None

    try:
        return datetime.fromisoformat(str(value).replace('Z', '+00:00'))
    except ValueError:
        return None


def _coerce_payload(request):
    if request.content_type and 'application/json' in request.content_type:
        try:
            return json.loads(request.body.decode() or '{}') or {}
        except json.JSONDecodeError:
            return {}

    payload = {}
    for key, value in request.POST.items():
        payload[key] = value
    return payload


@csrf_exempt
def ads_api(request):
    if request.method == 'GET':
        ads = Advertisement.objects.all().order_by('-created_at')
        return JsonResponse({
            'count': ads.count(),
            'next': None,
            'previous': None,
            'results': [ad.to_api_dict() for ad in ads],
        })

    if request.method == 'POST':
        payload = _coerce_payload(request)
        title = (payload.get('title') or request.POST.get('title') or '').strip()
        if not title:
            return JsonResponse({'detail': 'Title is required.'}, status=400)

        description = (payload.get('description') or payload.get('client_name') or request.POST.get('description') or request.POST.get('client_name') or '').strip()
        target_url = (payload.get('target_url') or payload.get('redirect_url') or request.POST.get('target_url') or request.POST.get('redirect_url') or '').strip()
        image_value = payload.get('image') or request.POST.get('image') or ''
        image_url_value = (payload.get('image_url') or request.POST.get('image_url') or '').strip()
        position = _normalize_position(payload.get('position') or request.POST.get('position') or 'between_articles')
        start_date = _parse_datetime(payload.get('start_date') or request.POST.get('start_date')) or timezone.now()
        end_date = _parse_datetime(payload.get('end_date') or request.POST.get('end_date'))
        status_value = payload.get('status') or request.POST.get('status') or payload.get('state') or request.POST.get('state') or 'active'
        is_active = payload.get('is_active') if 'is_active' in payload else request.POST.get('is_active')
        if is_active is None:
            is_active = _normalize_status(status_value) == 'active'
        else:
            is_active = str(is_active).lower() in {'1', 'true', 'yes', 'on'}

        ad = Advertisement(
            title=title,
            description=description,
            target_url=target_url,
            position=position,
            image_url=image_url_value,
            start_date=start_date,
            end_date=end_date,
            is_active=is_active,
        )

        uploaded_image = request.FILES.get('image')
        if uploaded_image:
            ad.image = uploaded_image
        elif isinstance(image_value, str) and image_value and (image_value.startswith('http://') or image_value.startswith('https://') or image_value.startswith('/')):
            ad.image_url = image_value

        ad.save()
        return JsonResponse(ad.to_api_dict(), status=201)

    return JsonResponse({'detail': 'Method not allowed.'}, status=405)


@csrf_exempt
def ads_detail(request, ad_id):
    try:
        ad = Advertisement.objects.get(pk=ad_id)
    except Advertisement.DoesNotExist:
        return JsonResponse({'detail': 'Advertisement not found.'}, status=404)

    if request.method == 'GET':
        return JsonResponse(ad.to_api_dict())

    if request.method in {'PATCH', 'PUT'}:
        payload = _coerce_payload(request)
        if 'title' in payload and payload['title'] is not None:
            ad.title = str(payload['title']).strip()
        if 'description' in payload and payload['description'] is not None:
            ad.description = str(payload['description']).strip()
        if 'client_name' in payload and payload['client_name'] is not None:
            ad.description = str(payload['client_name']).strip()
        if 'target_url' in payload and payload['target_url'] is not None:
            ad.target_url = str(payload['target_url']).strip()
        if 'redirect_url' in payload and payload['redirect_url'] is not None:
            ad.target_url = str(payload['redirect_url']).strip()
        if 'position' in payload:
            ad.position = _normalize_position(payload['position'])
        if 'image' in payload and payload['image'] is not None:
            image_value = str(payload['image']).strip()
            if image_value.startswith('http://') or image_value.startswith('https://') or image_value.startswith('/'):
                ad.image_url = image_value
            else:
                ad.image_url = ''
        if 'image_url' in payload and payload['image_url'] is not None:
            ad.image_url = str(payload['image_url']).strip()
        if 'start_date' in payload and payload['start_date'] is not None:
            parsed_start = _parse_datetime(payload['start_date'])
            if parsed_start:
                ad.start_date = parsed_start
        if 'end_date' in payload and payload['end_date'] is not None:
            parsed_end = _parse_datetime(payload['end_date'])
            if parsed_end:
                ad.end_date = parsed_end
        if 'status' in payload or 'state' in payload:
            ad.is_active = _normalize_status(payload.get('status') or payload.get('state') or 'active') == 'active'
        if 'is_active' in payload:
            value = payload['is_active']
            ad.is_active = str(value).lower() in {'1', 'true', 'yes', 'on'}

        ad.save()
        return JsonResponse(ad.to_api_dict())

    if request.method == 'DELETE':
        ad.delete()
        return HttpResponse(status=204)

    return JsonResponse({'detail': 'Method not allowed.'}, status=405)


@csrf_exempt
def ads_tracking(request, action):
    if request.method != 'POST':
        return JsonResponse({'detail': 'Method not allowed.'}, status=405)

    ad_id = request.POST.get('ad_id') or request.POST.get('advertisement') or request.POST.get('id')
    try:
        ad = Advertisement.objects.get(pk=ad_id)
    except (Advertisement.DoesNotExist, TypeError, ValueError):
        return JsonResponse({'detail': 'Advertisement not found.'}, status=404)

    if action == 'click':
        ad.target_url = ad.target_url or '#'
    ad.save()
    return JsonResponse(ad.to_api_dict())


@csrf_exempt
def api_proxy(request, path):
    query = request.META.get("QUERY_STRING")
    url = _remote_url_for_path(path)

    if query:
        url = f"{url}?{query}"

    if path in {'api/ads', 'api/ads/'}:
        return ads_api(request)

    if re.match(r'^api/ads/(?P<ad_id>\d+)/?$', path):
        ad_id = int(re.match(r'^api/ads/(?P<ad_id>\d+)/?$', path).group('ad_id'))
        return ads_detail(request, ad_id)

    if path in {'api/ads/click', 'api/ads/click/'}:
        return ads_tracking(request, 'click')

    if path in {'api/ads/impressions', 'api/ads/impressions/'}:
        return ads_tracking(request, 'impression')

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

    # Debug logging to help trace proxy issues during development
    try:
        print(f"[api_proxy] {request.method} {path} -> {url} (status={remote_response.status_code})")
        if remote_response.status_code >= 400:
            print("[api_proxy] remote response body:", remote_response.text[:1000])
    except Exception:
        pass

    django_response = HttpResponse(
        remote_response.content,
        status=remote_response.status_code,
        content_type=remote_response.headers.get("Content-Type", "application/json"),
    )
    for header, value in remote_response.headers.items():
        if header.lower() not in HOP_BY_HOP_HEADERS and header.lower() != "content-type":
            django_response[header] = value
    return django_response


@csrf_exempt
def portal_articles_proxy(request):
    return api_proxy(request, 'articles/feed/')


@csrf_exempt
def portal_articles_create_proxy(request):
    return api_proxy(request, 'articles/create/')


@csrf_exempt
def portal_token_obtain(request):
    return api_proxy(request, 'api/token/')


@csrf_exempt
def portal_token_refresh(request):
    return api_proxy(request, 'api/token/refresh/')


@csrf_exempt
def portal_articles_feed(request):
    return api_proxy(request, 'articles/feed/')


@csrf_exempt
def portal_reporter_articles(request):
    return api_proxy(request, 'articles/reporter/articles/')


@csrf_exempt
def portal_articles_create(request):
    return api_proxy(request, 'articles/create/')


@csrf_exempt
def portal_article_detail(request, article_id):
    return api_proxy(request, f'articles/{article_id}/')


@csrf_exempt
def portal_article_update(request, article_id):
    return api_proxy(request, f'articles/{article_id}/update/')


@csrf_exempt
def portal_article_delete(request, article_id):
    return api_proxy(request, f'articles/{article_id}/delete/')


@csrf_exempt
def portal_ads_proxy(request):
    if request.method == 'GET':
        return ads_api(request)
    if request.method == 'POST':
        return ads_api(request)
    return JsonResponse({'detail': 'Method not allowed.'}, status=405)


@csrf_exempt
def portal_ads_detail_proxy(request, ad_id):
    return ads_detail(request, ad_id)


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


def profile(request):
    context = {}
    return render(request, "frontend/pages/profile.html", context)
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


def _get_bearer_token(request):
    authorization = request.headers.get('Authorization', '')
    parts = authorization.split()
    if len(parts) == 2 and parts[0].lower() == 'bearer':
        return parts[1]
    return ''


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


def normalize_user_role(user):
    """Return a normalized role slug from remote user payload."""
    if not isinstance(user, dict):
        return ''
    role = user.get('role')
    if isinstance(role, str):
        return role.strip().lower().replace(' ', '_').replace('-', '_')
    if isinstance(role, dict):
        raw = role.get('role_name') or role.get('name') or ''
        return str(raw).strip().lower().replace(' ', '_').replace('-', '_')
    return ''


def is_admin_user(user):
    if not isinstance(user, dict):
        return False
    if user.get('is_superuser'):
        return True
    return normalize_user_role(user) in ('admin', 'super_admin', 'superadmin')


def is_staff_portal_user(user):
    if not isinstance(user, dict):
        return False
    if is_admin_user(user):
        return False
    role = normalize_user_role(user)
    if role == 'staff':
        return True
    return bool(user.get('is_staff'))


def login_redirect_for_user(user):
    if is_admin_user(user):
        return reverse('frontend:users')
    if is_staff_portal_user(user):
        return reverse('frontend:staff')
    return reverse('frontend:index')


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

    # Fallback: decode JWT payload and normalize values
    payload = _decode_jwt_payload(access_token)
    user = {}
    # common claim names
    user['email'] = payload.get('email') or payload.get('username') or ''
    # role: ensure string lowercased when present
    raw_role = payload.get('role') or payload.get('user_role') or ''
    user['role'] = str(raw_role).lower() if raw_role is not None else ''

    def _to_bool(val):
        if isinstance(val, bool):
            return val
        if val is None:
            return False
        if isinstance(val, (int, float)):
            return bool(val)
        s = str(val).strip().lower()
        return s in ('1', 'true', 'yes', 'y', 't')

    user['is_staff'] = _to_bool(payload.get('is_staff') or payload.get('staff'))
    user['is_superuser'] = _to_bool(payload.get('is_superuser') or payload.get('admin'))
    return user


@csrf_exempt
def auth_login(request):
    """Server-side login endpoint. Accepts POST with JSON {email,password}.
    Authentication is performed against the remote API (no local DB lookup).
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

    # Authenticate using the remote API only (do not consult local DB)
    if requests is None:
        return JsonResponse({'detail': 'requests library not installed on server.'}, status=500)

    # Try common token endpoints used by the remote API
    token_paths = ['/token/', '/auth/token/', '/auth/login/', '/api/token/']
    token_response = None
    last_error_resp = None
    for path in token_paths:
        try:
            url = f"{NEWS_API_BASE}{path}"
            resp = requests.post(url, json={'email': email, 'username': email, 'password': password}, timeout=15)
            # accept 200/201 as success; otherwise capture last non-2xx for forwarding
            if resp.status_code in (200, 201):
                token_response = resp
                break
            else:
                last_error_resp = (url, resp)
        except requests.RequestException:
            continue

    if not token_response:
        # If remote API returned an error response, forward its JSON/text to help debugging
        if last_error_resp:
            url, resp = last_error_resp
            try:
                body = resp.json()
            except Exception:
                body = resp.text or {'detail': 'Authentication failed'}
            # Log remote auth failure for server-side debugging
            print(f"Remote auth failed: {url} -> {resp.status_code}: {body}")
            return JsonResponse(body, status=resp.status_code)
        return JsonResponse({'detail': 'Authentication failed. Invalid credentials or unable to reach auth endpoint.'}, status=401)

    try:
        token_json = token_response.json()
    except Exception:
        return JsonResponse({'detail': 'Invalid response from auth endpoint.'}, status=502)

    access = token_json.get('access') or token_json.get('token') or token_json.get('access_token')
    refresh = token_json.get('refresh') or token_json.get('refresh_token')
    if not access:
        # Authentication failed - forward error message
        return JsonResponse(token_json, status=token_response.status_code)

    # Fetch user info and store minimal profile
    user = get_remote_user_info(access) or {}

    role = normalize_user_role(user) or 'reader'
    next_url = login_redirect_for_user(user)

    return JsonResponse({
        'detail': 'Login successful',
        'next': next_url,
        'role': role,
        'user': user,
        'access': access,
        'refresh': refresh,
    })


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
        token = _get_bearer_token(request)
        if not token:
            # Not logged in -> redirect to login page
            if request.is_ajax() or request.headers.get('Accept') == 'application/json':
                return JsonResponse({'detail': 'Authentication required'}, status=401)
            return redirect(reverse('frontend:login'))
        return view_func(request, *args, **kwargs)

    return _wrapped

def dashboard(request):
    """Staff dashboard overview page."""
    context = {}
    return render(request, 'staff/pages/dashboard.html', context)


def staff_dashboard(request):
    """Staff dashboard view (alias for /staff/)."""
    return dashboard(request)


@csrf_exempt
@require_POST
def staff_add_article(request):
    """Receive article data from staff frontend and forward to remote API.

    Expects JSON body or form data with at least `title` and `body`.
    """
    token = _get_bearer_token(request)
    if not token:
        return JsonResponse({'detail': 'Authentication required'}, status=401)

    try:
        # prefer JSON
        data = json.loads(request.body.decode()) if request.body else request.POST.dict()
    except Exception:
        data = request.POST.dict()

    status = _normalize_article_status(
        data.get('status'),
        data.get('published') if 'published' in data else data.get('is_published')
    )
    body = data.get('body') or data.get('content') or ''
    description = data.get('description') or data.get('summary') or data.get('excerpt') or ''

    payload = {
        'title': data.get('title', ''),
        'status': status,
        'body': body,
        'content': body,
        'description': description,
        'summary': description,
    }

    if status == 'published' and not data.get('published_at'):
        payload['published_at'] = timezone.now().isoformat()

    # Use the remote API's create endpoint for article creation
    url = _join_remote_path(NEWS_ARTICLE_BASE, 'articles/create/')

    if requests is None:
        return JsonResponse({'detail': 'requests library not installed on server. Install it in your virtualenv (pip install requests).'}, status=500)


    try:
        headers = {'Accept': 'application/json', 'Authorization': f'Bearer {token}'}

        # If the client sent multipart/form-data (file upload), forward as multipart
        content_type = request.META.get('CONTENT_TYPE', '')
        if content_type.startswith('multipart/'):
            files = {}
            data_fields = {}

            # request.POST contains form fields
            for k, v in request.POST.items():
                data_fields[k] = v

            data_fields['status'] = status
            if body:
                data_fields.setdefault('body', body)
                data_fields.setdefault('content', body)
            if description:
                data_fields.setdefault('description', description)
                data_fields.setdefault('summary', description)
            if status == 'published' and not data_fields.get('published_at'):
                data_fields['published_at'] = timezone.now().isoformat()

            category_value = data_fields.get('category', '').strip()
            if category_value and not data_fields.get('category_id') and not data_fields.get('category_name'):
                if category_value.isdigit():
                    data_fields['category_id'] = category_value
                else:
                    data_fields['category_name'] = category_value

            image_value = data_fields.get('image', '').strip()
            if image_value.startswith(('http://', 'https://')) and not data_fields.get('image_url'):
                data_fields['image_url'] = image_value

            # request.FILES contains uploaded files
            for k, f in request.FILES.items():
                # requests accepts file tuples: (filename, fileobj, content_type)
                files[k] = (f.name, f.read(), f.content_type)

            resp = requests.post(url, data=data_fields, files=files, headers=headers, timeout=30)
        else:
            # include any optional fields from JSON/form data
            for key in (
                'category',
                'category_id',
                'category_name',
                'tags',
                'image',
                'image_url',
                'featured',
                'is_featured',
                'published',
                'is_published',
                'published_at',
            ):
                if key in data:
                    if key in ('featured', 'published'):
                        val = data.get(key)
                        if isinstance(val, str):
                            payload[key] = val.lower() in ('1', 'true', 'yes', 'on')
                        else:
                            payload[key] = bool(val)
                    else:
                        payload[key] = data[key]

            category_value = str(payload.get('category') or '').strip()
            if category_value and not payload.get('category_id') and not payload.get('category_name'):
                if category_value.isdigit():
                    payload['category_id'] = int(category_value)
                else:
                    payload['category_name'] = category_value

            image_value = str(payload.get('image') or '').strip()
            if image_value.startswith(('http://', 'https://')) and not payload.get('image_url'):
                payload['image_url'] = image_value

            resp = requests.post(url, json=payload, headers=headers, timeout=30)
    except requests.RequestException as e:
        return JsonResponse({'detail': str(e)}, status=502)

    if resp.status_code == 403 and status == 'published':
        try:
            if content_type.startswith('multipart/'):
                retry_fields = dict(data_fields)
                retry_fields['status'] = 'pending_review'
                retry_fields['published'] = 'false'
                retry_fields['is_published'] = 'false'
                retry_fields.pop('published_at', None)
                retry_resp = requests.post(url, data=retry_fields, files=files, headers=headers, timeout=30)
            else:
                retry_payload = {
                    **payload,
                    'status': 'pending_review',
                    'published': False,
                    'is_published': False,
                }
                retry_payload.pop('published_at', None)
                retry_resp = requests.post(url, json=retry_payload, headers=headers, timeout=30)

            if 200 <= retry_resp.status_code < 300:
                retry_data = retry_resp.json()
                if isinstance(retry_data, dict):
                    retry_data['detail'] = 'Article saved to the remote database as pending review. This staff account cannot publish directly.'
                return JsonResponse(retry_data, status=retry_resp.status_code)
        except (requests.RequestException, ValueError):
            pass

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


def staff_comments(request):
    context = {}
    return render(request, 'staff/pages/comments.html', context)


def staff_advertisements(request):
    context = {}
    return render(request, 'staff/pages/ads.html', context)


def staff_profile(request):
    context = {}
    return render(request, 'staff/pages/profile.html', context)
