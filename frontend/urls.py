from django.urls import path
from . import views

app_name = 'frontend'

urlpatterns = [
    path('', views.index, name='index'),

    path('register/', views.register, name='register'),
    path('login/', views.login, name='login'),
    # Server-side auth endpoints (login forwards credentials to remote API and stores tokens in session)
    path('auth/login/', views.auth_login, name='auth_login'),
    path('auth/logout/', views.auth_logout, name='auth_logout'),
   
    path('newsletter/', views.newsletter, name='newsletter'),
    path('profile/', views.profile, name='profile'),
    path('news/<int:article_id>/', views.news_detail, name='news_detail'),
    path('dashboard/', views.dashboard, name='dashboard'),
    path('staff/', views.staff_dashboard, name='staff'),
    path('staff/add_article/', views.staff_add_article, name='staff_add_article'),
    path('staff/articles/', views.staff_articles, name='staff_articles'),
    path('users/', views.users, name='users'),
    path('portal/articles/', views.portal_articles_proxy, name='portal_articles_proxy'),
    path('portal/articles/create/', views.portal_articles_create_proxy, name='portal_articles_create_proxy'),
    path('articles/feed/', views.portal_articles_feed, name='portal_articles_feed'),
    path('articles/reporter/articles/', views.portal_reporter_articles, name='portal_reporter_articles'),
    path('articles/create/', views.portal_articles_create, name='portal_articles_create'),
    path('articles/<int:article_id>/', views.portal_article_detail, name='portal_article_detail'),
    path('articles/<int:article_id>/update/', views.portal_article_update, name='portal_article_update'),
    path('articles/<int:article_id>/delete/', views.portal_article_delete, name='portal_article_delete'),
    path('articles/', views.articles, name='articles'),
    path('categories/', views.categories, name='categories'),
    path('media/', views.media, name='media'),
    path('roles/', views.roles, name='roles'),
    path('advertise/', views.advertise, name='advertise'),
    path('tags/', views.tags, name='tags'),
    path('bookmarks/', views.bookmarks, name='bookmarks'),
    path('comments/', views.comments, name='comments'),
    path('reacts/', views.reacts, name='reacts'),
    path('staff/', views.staff_dashboard, name='staff_dashboard'),
    path('staff/articles/', views.staff_articles, name='staff_articles'),
    path('staff/comments/', views.staff_comments, name='staff_comments'),
    path('staff/advertisements/', views.staff_advertisements, name='staff_advertisements'),
    path('staff/profile/', views.staff_profile, name='staff_profile'),
    path('api/ads/', views.ads_api, name='ads_api'),
    path('api/ads/<int:ad_id>/', views.ads_detail, name='ads_detail'),
    path('api/ads/click/', views.ads_tracking, {'action': 'click'}, name='ads_click'),
    path('api/ads/impressions/', views.ads_tracking, {'action': 'impression'}, name='ads_impression'),
    path('remote/<path:path>', views.api_proxy, name='api_proxy'),
]
