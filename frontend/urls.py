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
    path('news/<int:article_id>/', views.news_detail, name='news_detail'),
    path('dashboard/', views.dashboard, name='dashboard'),
    path('staff/', views.staff_dashboard, name='staff'),
    path('staff/add_article/', views.staff_add_article, name='staff_add_article'),
    path('staff/articles/', views.staff_articles, name='staff_articles'),
    path('users/', views.users, name='users'),
    path('articles/', views.articles, name='articles'),
    path('categories/', views.categories, name='categories'),
    path('media/', views.media, name='media'),
    path('roles/', views.roles, name='roles'),
    path('advertise/', views.advertise, name='advertise'),
    path('tags/', views.tags, name='tags'),
    path('bookmarks/', views.bookmarks, name='bookmarks'),
    path('comments/', views.comments, name='comments'),
    path('reacts/', views.reacts, name='reacts'),
    path('remote/<path:path>', views.api_proxy, name='api_proxy'),
]
