from django.urls import path
from . import views

app_name = 'frontend'

urlpatterns = [
    path('', views.index, name='index'),
<<<<<<< HEAD
    path('register/', views.register, name='register'),
    path('login/', views.login, name='login'),
=======
    path('newsletter/', views.newsletter, name='newsletter'),
    path('news/<int:article_id>/', views.news_detail, name='news_detail'),
>>>>>>> 5053eb38004cff0a05527ef76a6de9a4c0ab2cc8
    path('dashboard/', views.dashboard, name='dashboard'),
    path('users/', views.users, name='users'),
    path('articles/', views.articles, name='articles'),
]
