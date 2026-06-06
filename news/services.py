from django.conf import settings
from django.db.models import F
from django.utils import timezone

from .models import Article, ArticleStats


def record_article_view(article: Article, request) -> int:
    """
    Increment view count once per browser session per article.
    Returns the updated views_count.
    """
    session_key = f'viewed_article_{article.pk}'
    if request.session.get(session_key):
        return article.views_count

    stats, _ = ArticleStats.objects.get_or_create(article=article)
    ArticleStats.objects.filter(pk=stats.pk).update(
        views_count=F('views_count') + 1,
        last_viewed_at=timezone.now(),
    )
    stats.refresh_from_db()
    request.session[session_key] = True
    return stats.views_count


def get_trending_articles(limit=6):
    return (
        Article.objects.filter(status=Article.Status.PUBLISHED)
        .select_related('category', 'author', 'stats')
        .order_by('-stats__views_count')[:limit]
    )


SESSION_BOOKMARK_KEY = 'bookmarked_articles'


def get_session_bookmark_ids(request):
    return request.session.get(SESSION_BOOKMARK_KEY, [])


def is_session_bookmarked(request, article_id):
    return article_id in get_session_bookmark_ids(request)


def toggle_session_bookmark(request, article_id):
    bookmarks = list(get_session_bookmark_ids(request))
    if article_id in bookmarks:
        bookmarks.remove(article_id)
        bookmarked = False
    else:
        bookmarks.append(article_id)
        bookmarked = True
    request.session[SESSION_BOOKMARK_KEY] = bookmarks
    request.session.modified = True
    return bookmarked


def get_bookmarked_articles(request):
    ids = get_session_bookmark_ids(request)
    if not ids:
        return Article.objects.none()
    preserved = {pk: i for i, pk in enumerate(ids)}
    qs = Article.objects.filter(pk__in=ids, status=Article.Status.PUBLISHED).select_related(
        'category', 'author', 'stats'
    )
    return sorted(qs, key=lambda a: preserved.get(a.pk, 0))
