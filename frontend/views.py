from django.shortcuts import render
import json
import urllib.request
import urllib.error
import urllib.parse
from datetime import datetime
import re

NEWS_API_BASE = "https://news-portal-hvgs.onrender.com"


def fetch_json(path):
    url = f"{NEWS_API_BASE}{path}"
    req = urllib.request.Request(url, headers={
        "Accept": "application/json",
        "User-Agent": "Mozilla/5.0"
    })
    with urllib.request.urlopen(req, timeout=20) as resp:
        return json.loads(resp.read().decode())


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