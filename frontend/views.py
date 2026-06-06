from django.shortcuts import render

# Create your views here.

def index(request):
    """
    Frontend home page view.
    News data will be fetched via API calls from frontend (JavaScript).
    """
    context = {}
    return render(request, 'frontend/index.html', context)


def newsletter(request):
    """
    Newsletter page view.
    """
    context = {}
    return render(request, 'frontend/newsletter.html', context)
