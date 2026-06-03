from django.urls import path

from . import views

urlpatterns = [
    path('', views.home, name='home'),
    path('article/<slug:slug>/', views.article_detail, name='article_detail'),
    path('bookmarks/', views.bookmark_list, name='bookmark_list'),
    path('article/<slug:slug>/bookmark/', views.toggle_bookmark, name='toggle_bookmark'),
]
