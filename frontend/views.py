from django.http import HttpResponse, JsonResponse
from django.shortcuts import render
from django.views.decorators.csrf import csrf_exempt
import json
import urllib.request
import urllib.error
import urllib.parse
from datetime import datetime
import re
import requests
from django.utils import timezone

from .models import Advertisement

NEWS_API_BASE = "https://news-portal-hvgs.onrender.com"
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
    url = f"{NEWS_API_BASE}/{path}"

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

def dashboard(request):
    """
    Newsletter page view.
    """
    context = {}
    return render(request, 'admin/components/base.html', context)

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


def categories(request):
    """
    Categories page view.
    """
    context = {}
    return render(request, 'admin/pages/categories.html', context)


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
    return render(request, 'admin/pages/comments.html', context)


def reacts(request):
    context = {}
    return render(request, 'admin/pages/reacts.html', context)


def staff_dashboard(request):
    context = {}
    return render(request, 'staff/pages/dashboard.html', context)


def staff_articles(request):
    context = {}
    return render(request, 'staff/pages/articles.html', context)


def staff_comments(request):
    context = {}
    return render(request, 'staff/pages/comments.html', context)


def staff_advertisements(request):
    context = {}
    return render(request, 'staff/pages/ads.html', context)


def staff_profile(request):
    context = {}
    return render(request, 'staff/pages/profile.html', context)
