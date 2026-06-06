from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.utils import timezone

from news.models import Article, Category, Tag

User = get_user_model()


class Command(BaseCommand):
    help = 'Create sample categories, users, and published articles for demo/testing.'

    def handle(self, *args, **options):
        admin, created = User.objects.get_or_create(
            username='admin',
            defaults={'email': 'admin@newshub.com', 'is_staff': True, 'is_superuser': True},
        )
        if created or not admin.has_usable_password():
            admin.set_password('admin123')
            admin.is_staff = True
            admin.is_superuser = True
            admin.save()
            self.stdout.write(self.style.SUCCESS('Admin created: admin / admin123'))

        reporter, _ = User.objects.get_or_create(
            username='reporter',
            defaults={'email': 'reporter@newshub.com', 'is_staff': True},
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

        samples = [
            {
                'title': 'AI Revolution Changes How We Work',
                'category': tech,
                'excerpt': 'Artificial intelligence is transforming workplaces across every industry at unprecedented speed.',
                'content': 'From automated workflows to intelligent assistants, AI tools are reshaping how teams collaborate and deliver results.\n\nExperts predict that adaptability will be the most valuable skill in the years ahead.',
                'is_breaking': False,
                'image_seed': 'ai-work',
            },
            {
                'title': 'New Climate Bill Passes Senate Vote',
                'category': politics,
                'excerpt': 'Landmark legislation aims to cut emissions by 50% before the end of the decade.',
                'content': 'Lawmakers celebrated a bipartisan breakthrough after months of negotiation.\n\nThe bill includes funding for renewable energy infrastructure and green job training programs.',
                'is_breaking': True,
                'image_seed': 'climate',
            },
            {
                'title': 'Championship Final Ends in Dramatic Overtime',
                'category': sports,
                'excerpt': 'Underdogs clinch the title after a last-second play stunned the crowd.',
                'content': 'Fans packed the stadium as the underdogs completed an unforgettable comeback in overtime.\n\nThe winning coach credited teamwork and preparation for the historic win.',
                'is_breaking': False,
                'image_seed': 'sports-final',
            },
            {
                'title': 'National Election Results Show Record Turnout',
                'category': politics,
                'excerpt': 'Voters turned out in historic numbers across the country.',
                'content': 'Election officials confirmed record participation in every region. Analysts say youth turnout drove much of the surge.',
                'is_breaking': True,
                'image_seed': 'election',
            },
            {
                'title': 'Startup Unveils Next-Gen Electric Vehicle',
                'category': tech,
                'excerpt': 'The new model promises 500 miles of range on a single charge.',
                'content': 'Industry analysts called the announcement a major milestone for affordable EV adoption.\n\nPre-orders open next month with deliveries expected by year end.',
                'is_breaking': False,
                'image_seed': 'ev-car',
            },
            {
                'title': 'Olympic Athlete Breaks World Record',
                'category': sports,
                'excerpt': 'A stunning performance captivated audiences worldwide.',
                'content': 'The athlete shattered a decades-old record that many thought would never fall.\n\nTeammates and coaches praised years of relentless training.',
                'is_breaking': False,
                'image_seed': 'olympics',
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
                        data['image_seed']
                    ),
                },
            )
            if created:
                self.stdout.write(self.style.SUCCESS(f'Created: {article.title}'))
            else:
                self.stdout.write(f'Already exists: {article.title}')

        self.stdout.write(self.style.SUCCESS('\n=== Demo Ready ==='))
        self.stdout.write('Admin:    admin / admin123  ->  /admin/login/')
        self.stdout.write('Employee: reporter / reporter123  ->  /employee/login/')
        self.stdout.write('Readers:  register at /register/ to comment & rate')
