from django.shortcuts import render

from .api import ApiError, get_article, list_trending_articles, search_articles, session_access_token


def home(request):
    category_slug = request.GET.get('category', '').strip()
    api_error = ''
    try:
        articles = search_articles(category_slug=category_slug)
        trending_articles = list_trending_articles()
    except ApiError as error:
        articles = []
        trending_articles = []
        api_error = str(error)

    article_pool = list(articles[:10])
    hero_article = article_pool[0] if article_pool else None
    spotlight_articles = article_pool[1:4]
    news_cards = article_pool[1:7]

    return render(
        request,
        'frontend/pages/home.html',
        {
            'hero_article': hero_article,
            'spotlight_articles': spotlight_articles,
            'news_cards': news_cards,
            'trending_articles': trending_articles,
            'selected_category': category_slug,
            'total_headlines': len(articles),
            'api_error': api_error,
        },
    )


def article_detail(request, article_id):
    api_error = ''
    article = None
    trending_articles = []
    related = []
    try:
        article = get_article(article_id, token=session_access_token(request))
        trending_articles = list_trending_articles()
        if article.category:
            related = [item for item in search_articles(category_slug=article.category.slug) if item.id != article.id][:4]
    except ApiError as error:
        api_error = str(error)

    return render(
        request,
        'frontend/pages/article_detail.html',
        {
            'article': article,
            'views_count': article.views_count if article else 0,
            'trending_articles': trending_articles,
            'related_articles': related,
            'api_error': api_error,
        },
    )
