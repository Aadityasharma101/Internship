from django.urls import path

from . import views


urlpatterns = [
    path('login/', views.employee_login, name='employee_login'),
    path('logout/', views.employee_logout, name='employee_logout'),
    path('dashboard/', views.dashboard, name='employee_dashboard'),
    path('password/change/', views.password_change, name='employee_password_change'),
    path('article/add/', views.article_create, name='employee_article_add'),
    path('article/<int:article_id>/edit/', views.article_edit, name='employee_article_edit'),
    path('article/<int:article_id>/delete/', views.article_delete, name='employee_article_delete'),
]
