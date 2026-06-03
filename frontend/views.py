from django.conf import settings
from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.shortcuts import get_object_or_404, redirect, render
from django.views.decorators.http import require_POST

from news.models import Article, Bookmark
from news.services import get_trending_articles, record_article_view


def home(request):
    articles = (
        Article.objects.filter(status=Article.Status.PUBLISHED)
        .select_related('category', 'author', 'stats')
        .order_by('-published_at')[:12]
    )
    return render(
        request,
        'frontend/home.html',
        {
            'articles': articles,
            'trending_articles': get_trending_articles(),
        },
    )


def article_detail(request, slug):
    article = get_object_or_404(
        Article.objects.select_related('category', 'author', 'stats').prefetch_related('tags'),
        slug=slug,
        status=Article.Status.PUBLISHED,
    )
    views_count = record_article_view(article, request)
    article.stats.refresh_from_db()

    is_bookmarked = False
    if request.user.is_authenticated:
        is_bookmarked = Bookmark.objects.filter(user=request.user, article=article).exists()

    trending_articles = get_trending_articles(limit=5)
    related = (
        Article.objects.filter(
            status=Article.Status.PUBLISHED,
            category=article.category,
        )
        .exclude(pk=article.pk)
        .select_related('stats')[:4]
        if article.category
        else Article.objects.none()
    )

    return render(
        request,
        'frontend/article_detail.html',
        {
            'article': article,
            'views_count': views_count,
            'is_trending': article.is_trending,
            'is_bookmarked': is_bookmarked,
            'trending_articles': trending_articles,
            'related_articles': related,
            'trending_threshold': getattr(settings, 'TRENDING_VIEWS_THRESHOLD', 50),
        },
    )


@login_required
def bookmark_list(request):
    bookmarks = (
        Bookmark.objects.filter(user=request.user)
        .select_related('article', 'article__category', 'article__author', 'article__stats')
        .order_by('-created_at')
    )
    return render(request, 'frontend/bookmarks.html', {'bookmarks': bookmarks})


@login_required
@require_POST
def toggle_bookmark(request, slug):
    article = get_object_or_404(Article, slug=slug, status=Article.Status.PUBLISHED)
    bookmark, created = Bookmark.objects.get_or_create(user=request.user, article=article)

    if not created:
        bookmark.delete()
        messages.success(request, 'Article removed from bookmarks.')
        bookmarked = False
    else:
        messages.success(request, 'Article saved to bookmarks.')
        bookmarked = True

    next_url = request.POST.get('next', request.META.get('HTTP_REFERER', '/'))
    if request.headers.get('HX-Request') or request.POST.get('ajax'):
        return render(
            request,
            'frontend/partials/bookmark_button.html',
            {'article': article, 'is_bookmarked': bookmarked},
        )
    return redirect(next_url or 'article_detail', slug=slug)
