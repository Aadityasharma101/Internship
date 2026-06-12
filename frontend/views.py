from django.shortcuts import render

# Create your views here.

def index(request):
    """
    Frontend home page view.
    News data will be fetched via API calls from frontend (JavaScript).
    """
    context = {}
    return render(request, 'frontend/index.html', context)


def register(request):
    """
    User registration page.
    Form submission is handled by frontend JavaScript against the DRF API.
    """
    context = {}
    return render(request, 'frontend/pages/register.html', context)


def login(request):
    """
    User login page.
    Authentication is handled by frontend JavaScript against the DRF JWT API.
    """
    context = {}
    return render(request, 'frontend/pages/login.html', context)


def dashboard(request):
    """
    Newsletter page view.
    """
    context = {}
    return render(request, 'admin/components/base.html', context)

def users(request):
    """
    Users page view.
    """
    context = {}
    return render(request, 'admin/pages/users.html', context)


def articles(request):
    """
    Articles page view.
    """
    context = {}
    return render(request, 'admin/pages/articles.html', context)
