from news.models import Category


def portal_context(request):
    return {
        'show_views': request.user.is_authenticated and request.user.is_staff,
        'nav_categories': Category.objects.all()[:8],
        'selected_category': request.GET.get('category', ''),
    }
