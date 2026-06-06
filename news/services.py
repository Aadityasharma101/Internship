from django.conf import settings
from django.db.models import F
from django.utils import timezone

from .models import Article, ArticleStats, Bookmark


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


def is_article_bookmarked(user, article_id):
    if not user.is_authenticated:
        return False
    return Bookmark.objects.filter(user=user, article_id=article_id).exists()


def toggle_bookmark(user, article):
    bookmark, created = Bookmark.objects.get_or_create(user=user, article=article)
    if created:
        return True
    bookmark.delete()
    return False


def get_bookmarked_articles(user):
    if not user.is_authenticated:
        return Article.objects.none()

    bookmarks = (
        Bookmark.objects.filter(user=user, article__status=Article.Status.PUBLISHED)
        .select_related('article', 'article__category', 'article__author', 'article__stats')
        .order_by('-created_at')
    )
    return [bookmark.article for bookmark in bookmarks]
