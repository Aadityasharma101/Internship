from django.conf import settings
from django.http import HttpResponse
from django.shortcuts import redirect, render
from django.views.decorators.csrf import csrf_exempt
# authentication removed for public staff pages
from django.http import JsonResponse
from django.urls import reverse
import base64
import json
import re
import requests

NEWS_REMOTE_ORIGIN = getattr(settings, 'API_BASE_URL', 'https://news-portal-hvgs.onrender.com').rstrip('/')
if NEWS_REMOTE_ORIGIN.endswith('/api'):
    NEWS_REMOTE_ORIGIN = NEWS_REMOTE_ORIGIN[:-4]

NEWS_API_BASE = f"{NEWS_REMOTE_ORIGIN}/api"
NEWS_ARTICLE_BASE = NEWS_REMOTE_ORIGIN
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

    if clean_path.startswith('articles/'):
        return _join_remote_path(NEWS_API_BASE, clean_path)

    if clean_path in {'articles/feed/', 'articles/feed', 'articles/trending/', 'articles/trending', 'articles/create/', 'articles/create'}:
        return _join_remote_path(NEWS_API_BASE, clean_path)

    base = NEWS_ARTICLE_BASE if _is_article_path(clean_path) else NEWS_API_BASE
    return _join_remote_path(base, clean_path)


def _request_json(method, path, **kwargs):
    url = _remote_url_for_path(path)
    headers = {
        "Accept": "application/json",
        "User-Agent": "Mozilla/5.0",
    }
    headers.update(kwargs.pop('headers', {}))
    params = kwargs.pop('params', None)
    timeout = kwargs.pop('timeout', 20)
    payload = kwargs.pop('json', None)
    data = kwargs.pop('data', None)

    response = requests.request(method, url, params=params, headers=headers, timeout=timeout, json=payload, data=data, **kwargs)
    response.raise_for_status()
    try:
        return response.json()
    except ValueError:
        return None


def fetch_json(path, **kwargs):
    return _request_json('GET', path, **kwargs)


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


def _proxy_remote_request(request, path):
    query = request.META.get("QUERY_STRING")
    url = _remote_url_for_path(path)

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
def ads_api(request):
    if request.method == 'GET':
        return _proxy_remote_request(request, 'api/ads/')

    if request.method == 'POST':
        return _proxy_remote_request(request, 'api/ads/')

    return JsonResponse({'detail': 'Method not allowed.'}, status=405)


@csrf_exempt
def ads_detail(request, ad_id):
    if request.method == 'GET':
        return _proxy_remote_request(request, f'api/ads/{ad_id}/')

    if request.method in {'PATCH', 'PUT'}:
        return _proxy_remote_request(request, f'api/ads/{ad_id}/')

    if request.method == 'DELETE':
        return _proxy_remote_request(request, f'api/ads/{ad_id}/')

    return JsonResponse({'detail': 'Method not allowed.'}, status=405)


@csrf_exempt
def ads_tracking(request, action):
    if request.method != 'POST':
        return JsonResponse({'detail': 'Method not allowed.'}, status=405)

    return _proxy_remote_request(request, 'api/ads/click/' if action == 'click' else 'api/ads/impressions/')


@csrf_exempt
def api_proxy(request, path):
    if path in {'api/ads', 'api/ads/'}:
        return ads_api(request)

    if re.match(r'^api/ads/(?P<ad_id>\d+)/?$', path):
        ad_id = int(re.match(r'^api/ads/(?P<ad_id>\d+)/?$', path).group('ad_id'))
        return ads_detail(request, ad_id)

    if path in {'api/ads/click', 'api/ads/click/'}:
        return ads_tracking(request, 'click')

    if path in {'api/ads/impressions', 'api/ads/impressions/'}:
        return ads_tracking(request, 'impression')

    return _proxy_remote_request(request, path)


@csrf_exempt
def portal_articles_proxy(request):
    return api_proxy(request, 'api/articles/feed/')


@csrf_exempt
def portal_articles_create_proxy(request):
    return api_proxy(request, 'api/articles/create/')


@csrf_exempt
def portal_token_obtain(request):
    return api_proxy(request, 'api/token/')


@csrf_exempt
def portal_token_refresh(request):
    return api_proxy(request, 'api/token/refresh/')


@csrf_exempt
def portal_articles_feed(request):
    return api_proxy(request, 'api/articles/feed/')


@csrf_exempt
def portal_reporter_articles(request):
    return api_proxy(request, 'api/articles/reporter/articles/')


@csrf_exempt
def portal_articles_trending(request):
    return api_proxy(request, 'api/articles/trending/')


@csrf_exempt
def portal_articles_categories(request):
    return api_proxy(request, 'api/articles/categories/')


@csrf_exempt
def portal_articles_create(request):
    return api_proxy(request, 'api/articles/create/')


@csrf_exempt
def portal_article_detail(request, article_id):
    return api_proxy(request, f'api/articles/{article_id}/')


@csrf_exempt
def portal_article_update(request, article_id):
    return api_proxy(request, f'api/articles/{article_id}/update/')


@csrf_exempt
def portal_article_delete(request, article_id):
    return api_proxy(request, f'api/articles/{article_id}/delete/')


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


def index(request):
    articles = []
    try:
        data = fetch_json("/api/articles/feed/", params={"ordering": "-id"})
        articles = data.get("results", []) if isinstance(data, dict) else []
    except Exception as e:
        print("API fetch error:", e)
    return render(request, "frontend/index.html", {"articles": articles})


def news_detail(request, article_id):
    article = {}
    article_json_raw = "{}"
    try:
        article = fetch_json(f"/api/articles/{article_id}/") or {}
        if not isinstance(article, dict):
            article = {}
        article_json_raw = json.dumps(article)
        article_json_raw = article_json_raw.replace("</script>", "<\\/script>")
    except Exception:
        article = {}

    comments = article.get("comments") or []
    article_context = {
        'id': article.get('id'),
        'slug': article.get('slug'),
        'title': article.get('title') or 'Untitled article',
        'summary': article.get('summary') or article.get('body') or article.get('description') or '',
        'body': article.get('body') or article.get('description') or '',
        'image': article.get('image') or article.get('image_url') or article.get('thumbnail') or article.get('thumbnail_url') or article.get('featured_image') or article.get('featured_image_url') or '',
        'author_name': article.get('author_name') or article.get('author') or '',
        'published_at': article.get('published_at') or article.get('published_on') or '',
        'category_name': article.get('category_name') or article.get('category') or 'Uncategorized',
        'comments': comments,
    }
    return render(request, "frontend/news_detail.html", {
        "article": article_context,
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


def _normalize_role_name(role):
    if isinstance(role, dict):
        return str(role.get('role_name') or role.get('name') or role.get('title') or '').strip().lower()
    if isinstance(role, str):
        return role.strip().lower()
    return ''


def _resolve_next_path_for_user(user):
    role_name = _normalize_role_name(user.get('role'))

    if bool(user.get('is_superuser')) or role_name in {'admin', 'super_admin', 'superadmin'}:
        return reverse('frontend:users')

    if bool(user.get('is_staff')) or role_name == 'staff':
        return _staff_articles_path()

    return reverse('frontend:profile')


def _staff_articles_path():
    return reverse('frontend:staff_articles')


@csrf_exempt
def auth_login(request):
    """Forward authentication requests directly to the remote API."""
    if request.method != 'POST':
        return JsonResponse({'detail': 'Method not allowed'}, status=405)

    if requests is None:
        return JsonResponse({'detail': 'requests library not installed on server.'}, status=500)

    url = _join_remote_path(NEWS_API_BASE, 'token/')
    headers = {'Accept': 'application/json'}
    content_type = request.headers.get('Content-Type')
    if content_type:
        headers['Content-Type'] = content_type

    body = request.body if request.method not in ('GET', 'HEAD') else None
    try:
        resp = requests.post(url, data=body, headers=headers, timeout=15)
    except requests.RequestException as error:
        return JsonResponse({'detail': str(error)}, status=502)

    try:
        payload = resp.json()
    except Exception:
        content_type = resp.headers.get('Content-Type', 'application/octet-stream')
        return HttpResponse(resp.content, status=resp.status_code, content_type=content_type)

    if not isinstance(payload, dict):
        return JsonResponse({'detail': 'Unexpected authentication response'}, status=resp.status_code)

    access_token = payload.get('access') or ''
    if access_token:
        try:
            user_resp = requests.get(
                _join_remote_path(NEWS_API_BASE, 'users/me/'),
                headers={
                    'Accept': 'application/json',
                    'Authorization': f'Bearer {access_token}',
                },
                timeout=15,
            )
            if user_resp.status_code < 400:
                user_payload = user_resp.json() or {}
                role_name = _normalize_role_name(user_payload.get('role'))
                if role_name:
                    payload['role'] = role_name
                payload['user'] = user_payload
                payload['next'] = _resolve_next_path_for_user(user_payload)
        except requests.RequestException:
            pass

    return JsonResponse(payload, status=resp.status_code)


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
    """Redirect the old staff dashboard overview to the articles page."""
    return redirect(_staff_articles_path())


def staff_dashboard(request):
    """Redirect the old /staff/ landing page to the articles page."""
    return redirect(_staff_articles_path())


@csrf_exempt
def staff_add_article(request):
    """Compatibility route: proxy staff article creation to the documented API."""
    return api_proxy(request, 'api/articles/create/')

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
    context = {'article_page_mode': 'all'}
    return render(request, 'staff/pages/articles.html', context)


def staff_my_articles(request):
    """Staff-facing page scoped to articles posted by the logged-in staff user."""
    context = {'article_page_mode': 'mine'}
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
    return redirect(_staff_articles_path())
 
