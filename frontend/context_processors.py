from django.conf import settings


def api_settings(_request):
    api_root = getattr(settings, 'API_BASE_URL', 'https://news-portal-hvgs.onrender.com')
    api_root = api_root.rstrip('/')
    return {
        'API_MEDIA_BASE': api_root,
        'API_BASE': f"{api_root}/api",
    }
