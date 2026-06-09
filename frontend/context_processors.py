from .api import ApiError, is_api_authenticated, is_staff_profile, list_categories, session_user


def portal_context(request):
    api_user = session_user(request)
    try:
        nav_categories = list_categories()[:8]
    except ApiError:
        nav_categories = []

    return {
        'api_user': api_user,
        'api_is_authenticated': is_api_authenticated(request),
        'api_is_staff': is_staff_profile(api_user),
        'nav_categories': nav_categories,
        'selected_category': request.GET.get('category', ''),
    }
