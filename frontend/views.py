from django.conf import settings
from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.shortcuts import get_object_or_404, redirect, render
from django.views.decorators.http import require_POST

from news.models import Article, Category, Comment, Rating
from news.services import (
    get_bookmarked_articles,
    get_trending_articles,
    is_session_bookmarked,
    record_article_view,
    toggle_session_bookmark,
)


def home(request):
    category_slug = request.GET.get('category', '')
    articles = (
        Article.objects.filter(status=Article.Status.PUBLISHED)
        .select_related('category', 'author', 'stats')
        .order_by('-published_at')
    )
    if category_slug:
        articles = articles.filter(category__slug=category_slug)

    breaking = articles.filter(is_breaking=True).first()
    categories = Category.objects.all()
    article_list = list(articles[:13])
    featured = breaking or (article_list[0] if article_list else None)
    featured_pk = featured.pk if featured else None
    grid_articles = [a for a in article_list if a.pk != featured_pk][:12]

    return render(
        request,
        'frontend/home.html',
        {
            'articles': grid_articles,
            'featured_article': featured,
            'trending_articles': get_trending_articles(),
            'breaking_article': breaking,
            'categories': categories,
            'selected_category': category_slug,
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

    is_bookmarked = is_session_bookmarked(request, article.pk)
    user_rating = None
    if request.user.is_authenticated:
        user_rating = Rating.objects.filter(user=request.user, article=article).first()

    comments = (
        article.comments.select_related('user').order_by('-created_at')[:50]
    )
    trending_articles = get_trending_articles(limit=6)
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
            'comments': comments,
            'user_rating': user_rating,
        },
    )


def bookmark_list(request):
    articles = get_bookmarked_articles(request)
    return render(request, 'frontend/bookmarks.html', {'articles': articles})


@require_POST
def toggle_bookmark(request, slug):
    article = get_object_or_404(Article, slug=slug, status=Article.Status.PUBLISHED)
    bookmarked = toggle_session_bookmark(request, article.pk)

    if bookmarked:
        messages.success(request, 'Article saved to bookmarks.')
    else:
        messages.success(request, 'Article removed from bookmarks.')

    next_url = request.POST.get('next', request.META.get('HTTP_REFERER', '/'))
    if request.headers.get('HX-Request') or request.POST.get('ajax'):
        return render(
            request,
            'frontend/partials/bookmark_button.html',
            {'article': article, 'is_bookmarked': bookmarked},
        )
    return redirect(next_url or 'article_detail', slug=slug)


@login_required
@require_POST
def add_comment(request, slug):
    article = get_object_or_404(Article, slug=slug, status=Article.Status.PUBLISHED)
    text = request.POST.get('text', '').strip()
    if not text:
        messages.error(request, 'Comment cannot be empty.')
    elif len(text) > 2000:
        messages.error(request, 'Comment is too long.')
    else:
        Comment.objects.create(article=article, user=request.user, text=text)
        messages.success(request, 'Comment posted!')
    return redirect('article_detail', slug=slug)


@login_required
@require_POST
def rate_article(request, slug):
    article = get_object_or_404(Article, slug=slug, status=Article.Status.PUBLISHED)
    try:
        score = int(request.POST.get('score', 0))
    except (TypeError, ValueError):
        score = 0

    if score < 1 or score > 5:
        messages.error(request, 'Please select a rating between 1 and 5.')
    else:
        Rating.objects.update_or_create(
            user=request.user,
            article=article,
            defaults={'score': score},
        )
        messages.success(request, f'You rated this article {score}/5 stars!')
    return redirect('article_detail', slug=slug)
