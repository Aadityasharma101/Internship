from django.shortcuts import redirect
from django.urls import path

from . import views


def employee_login_redirect(request):
    return redirect(f'/login/?role=employee')


urlpatterns = [
    path('login/', employee_login_redirect, name='employee_login'),
    path('logout/', views.employee_logout, name='employee_logout'),
    path('dashboard/', views.dashboard, name='employee_dashboard'),
    path('article/add/', views.article_create, name='employee_article_add'),
    path('article/<slug:slug>/edit/', views.article_edit, name='employee_article_edit'),
    path('article/<slug:slug>/delete/', views.article_delete, name='employee_article_delete'),
]
