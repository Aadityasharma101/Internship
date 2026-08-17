import os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
import django
django.setup()
from frontend.models import Advertisement
print('ads_count=', Advertisement.objects.count())
for ad in Advertisement.objects.all().order_by('-created_at')[:10]:
    print({'id': ad.id, 'title': ad.title, 'position': ad.position, 'is_active': ad.is_active, 'start_date': str(ad.start_date), 'end_date': str(ad.end_date)})
