from django.http import HttpResponse
from django.shortcuts import render
from django.views.decorators.csrf import csrf_exempt
import json
import urllib.request
import urllib.error
import urllib.parse
from datetime import datetime
import re
import requests

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
