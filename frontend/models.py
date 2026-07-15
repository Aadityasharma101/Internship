from django.db import models
from django.utils import timezone


class Advertisement(models.Model):
    POSITION_CHOICES = [
        ('top_banner', 'Top Banner'),
        ('sidebar', 'Sidebar'),
        ('between_articles', 'Between Articles'),
        ('footer_banner', 'Footer Banner'),
    ]

    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    target_url = models.URLField(max_length=500, blank=True)
    position = models.CharField(max_length=30, choices=POSITION_CHOICES, default='between_articles')
    image = models.FileField(upload_to='ads/', blank=True, null=True)
    image_url = models.URLField(max_length=500, blank=True)
    start_date = models.DateTimeField(default=timezone.now)
    end_date = models.DateTimeField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    @property
    def status(self):
        return 'active' if self.is_active else 'inactive'

    def to_api_dict(self):
        image_value = self.image.url if self.image else self.image_url
        return {
            'id': self.id,
            'title': self.title,
            'description': self.description,
            'target_url': self.target_url,
            'position': self.position,
            'image': image_value,
            'image_url': image_value,
            'start_date': self.start_date.isoformat() if self.start_date else None,
            'end_date': self.end_date.isoformat() if self.end_date else None,
            'status': self.status,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }
