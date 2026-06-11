from django.conf import settings


def api_settings(_request):
    return {
        'API_MEDIA_BASE': getattr(
            settings,
            'API_BASE_URL',
            'https://news-portal-hvgs.onrender.com',
        ),
    }
