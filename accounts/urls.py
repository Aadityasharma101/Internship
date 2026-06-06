from django.urls import path

from . import views

urlpatterns = [
    path('login/', views.unified_login, name='login'),
    path('register/', views.register, name='register'),
    path('logout/', views.reader_logout, name='logout'),
]
