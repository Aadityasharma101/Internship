from django.urls import path
from . import views

app_name = 'frontend'

urlpatterns = [
    path('', views.index, name='index'),
    path('newsletter/', views.newsletter, name='newsletter'),
    path('news/<int:article_id>/', views.news_detail, name='news_detail'),
    path('dashboard/', views.dashboard, name='dashboard'),
    path('users/', views.users, name='users'),
    path('articles/', views.articles, name='articles'),
]
