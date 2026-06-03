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
    threshold = getattr(settings, 'TRENDING_VIEWS_THRESHOLD', 50)
    return (
        Article.objects.filter(
            status=Article.Status.PUBLISHED,
            stats__views_count__gte=threshold,
        )
        .select_related('category', 'author', 'stats')
        .order_by('-stats__views_count')[:limit]
    )
