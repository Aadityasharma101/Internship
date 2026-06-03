from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import Article, ArticleStats


@receiver(post_save, sender=Article)
def create_article_stats(sender, instance, created, **kwargs):
    if created:
        ArticleStats.objects.get_or_create(article=instance)
