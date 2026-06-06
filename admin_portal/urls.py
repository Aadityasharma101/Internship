from django.shortcuts import redirect
from django.urls import path

from . import views


def admin_login_redirect(request):
    return redirect('/login/?role=admin')


urlpatterns = [
    path('login/', admin_login_redirect, name='admin_login'),
    path('logout/', views.admin_logout, name='admin_logout'),
    path('dashboard/', views.dashboard, name='admin_dashboard'),
    path('articles/', views.article_list, name='admin_article_list'),
    path('article/<slug:slug>/edit/', views.article_edit, name='admin_article_edit'),
    path('article/<slug:slug>/delete/', views.article_delete, name='admin_article_delete'),
    path('employees/', views.employee_list, name='admin_employee_list'),
    path('employee/add/', views.employee_add, name='admin_employee_add'),
    path('users/', views.user_list, name='admin_user_list'),
]
