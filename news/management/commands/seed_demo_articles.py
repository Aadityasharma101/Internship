from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.utils import timezone

from news.models import Article, Category, Tag

User = get_user_model()


class Command(BaseCommand):
    help = 'Create sample categories and published articles for demo/testing.'

    def handle(self, *args, **options):
        reporter, _ = User.objects.get_or_create(
            username='reporter',
            defaults={'email': 'reporter@newsportal.com', 'is_staff': True},
        )
        if not reporter.has_usable_password():
            reporter.set_password('reporter123')
            reporter.save()

        politics, _ = Category.objects.get_or_create(
            name='Politics',
            defaults={'description': 'National and local politics'},
        )
        tech, _ = Category.objects.get_or_create(
            name='Technology',
            defaults={'description': 'Tech news and innovation'},
        )
        sports, _ = Category.objects.get_or_create(
            name='Sports',
            defaults={'description': 'Sports headlines'},
        )

        election_tag, _ = Tag.objects.get_or_create(name='Election')
        ai_tag, _ = Tag.objects.get_or_create(name='AI')

        samples = [
            {
                'title': 'National Election Results Show Record Turnout',
                'category': politics,
                'tags': [election_tag],
                'excerpt': 'Voters turned out in historic numbers across the country.',
                'content': 'Election officials confirmed record participation in every region. Analysts say youth turnout drove much of the surge.\n\nResults are expected to be certified within 48 hours.',
                'is_breaking': True,
            },
            {
                'title': 'New AI Policy Framework Announced by Government',
                'category': tech,
                'tags': [ai_tag],
                'excerpt': 'Regulators outline rules for safe and transparent AI deployment.',
                'content': 'The framework focuses on transparency, data privacy, and accountability for public-sector AI systems.\n\nIndustry leaders welcomed the clarity but asked for more consultation on startup compliance costs.',
                'is_breaking': False,
            },
            {
                'title': 'Championship Final Ends in Dramatic Overtime Victory',
                'category': sports,
                'tags': [],
                'excerpt': 'Underdogs clinch the title after a last-second play.',
                'content': 'Fans packed the stadium as the underdogs completed an unforgettable comeback in overtime.\n\nThe winning coach credited teamwork and preparation for the historic win.',
                'is_breaking': False,
            },
        ]

        for data in samples:
            article, created = Article.objects.get_or_create(
                title=data['title'],
                defaults={
                    'author': reporter,
                    'category': data['category'],
                    'excerpt': data['excerpt'],
                    'content': data['content'],
                    'status': Article.Status.PUBLISHED,
                    'is_breaking': data['is_breaking'],
                    'published_at': timezone.now(),
                    'featured_image_url': 'https://picsum.photos/seed/{}/800/450'.format(
                        data['title'][:8].replace(' ', '')
                    ),
                },
            )
            if created:
                for tag in data['tags']:
                    article.tags.add(tag)
                self.stdout.write(self.style.SUCCESS(f'Created: {article.title}'))
            else:
                self.stdout.write(f'Already exists: {article.title}')

        self.stdout.write(self.style.SUCCESS(
            '\nDemo ready. Reporter login: reporter / reporter123'
        ))
        self.stdout.write('Open an article: /article/<slug>/')
