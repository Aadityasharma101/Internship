from django.conf import settings


def api_settings(_request):
    api_root = getattr(settings, 'API_BASE_URL', 'https://news-portal-hvgs.onrender.com')
    api_root = api_root.rstrip('/')
    return {
        # Media base should point to the remote API origin so image URLs resolve correctly
        'API_MEDIA_BASE': api_root,
        # Use the raw API root so frontend fetches match backend paths (no extra /api)
        'API_BASE': api_root,
    }
