from django.conf import settings


def api_settings(_request):
    api_root = getattr(settings, 'API_BASE_URL', 'https://news-portal-hvgs.onrender.com')
    api_root = api_root.rstrip('/')
    return {
        'API_MEDIA_BASE': api_root,
        # Use the raw API root so frontend fetches match backend paths (no extra /api)
        'API_BASE': api_root,
        # Expose debug and optional dev fallback tokens to templates for local testing only
        'DEBUG': settings.DEBUG,
        'ADMIN_FALLBACK_ACCESS_TOKEN': getattr(settings, 'ADMIN_FALLBACK_ACCESS_TOKEN', ''),
        'ADMIN_FALLBACK_REFRESH_TOKEN': getattr(settings, 'ADMIN_FALLBACK_REFRESH_TOKEN', ''),
    }
