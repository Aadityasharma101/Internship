from unittest.mock import patch

from django.conf import settings
from django.test import TestCase
from django.urls import reverse

from frontend.api import ApiArticle, ApiAuthor, ApiCategory, ApiError


class HomepageTests(TestCase):
    @patch('frontend.context_processors.list_categories')
    @patch('frontend.views.list_trending_articles')
    @patch('frontend.views.search_articles')
    def test_homepage_shows_api_articles_and_categories(self, mock_search_articles, mock_trending_articles, mock_list_categories):
        hero_category = ApiCategory(id=1, name='World', slug='world')
        hero_article = ApiArticle(
            id=101,
            title='Hero Story',
            body='Hero body',
            image_url='https://example.com/hero.jpg',
            author=ApiAuthor(username='editor1'),
            category=hero_category,
            view_count=120,
        )
        card_article = ApiArticle(
            id=102,
            title='Secondary Story',
            body='Card body',
            image_url='https://example.com/card.jpg',
            author=ApiAuthor(username='editor2'),
            category=hero_category,
            view_count=45,
        )
        trending_article = ApiArticle(
            id=201,
            title='Trending Story',
            body='Trending body',
            image_url='https://example.com/trending.jpg',
            author=ApiAuthor(username='editor3'),
            category=hero_category,
            view_count=300,
        )

        mock_search_articles.return_value = [hero_article, card_article]
        mock_trending_articles.return_value = [trending_article]
        mock_list_categories.return_value = [hero_category]

        response = self.client.get(reverse('home'))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Hero Story')
        self.assertContains(response, 'Secondary Story')
        self.assertContains(response, 'Trending Story')
        self.assertContains(response, 'World')


class LoginFlowTests(TestCase):
    @patch('employee.views.get_profile')
    @patch('employee.views.api_login')
    def test_employee_login_uses_api_tokens(self, mock_api_login, mock_get_profile):
        mock_api_login.return_value = {'access': 'access-token', 'refresh': 'refresh-token'}
        mock_get_profile.return_value = {
            'id': 7,
            'username': 'staff1',
            'email': 'staff@example.com',
            'role': {'role_name': 'staff'},
        }

        response = self.client.post(
            reverse('employee_login'),
            {
                'email': 'staff@example.com',
                'password': 'secret123',
            },
        )

        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.url, reverse('employee_dashboard'))
        self.assertEqual(self.client.session['api_access'], 'access-token')
        self.assertEqual(self.client.session['api_user']['username'], 'staff1')

    @patch('employee.views.api_login', side_effect=ApiError('Invalid credentials'))
    def test_employee_login_rejects_bad_api_credentials(self, mock_api_login):
        response = self.client.post(
            reverse('employee_login'),
            {
                'email': 'staff@example.com',
                'password': 'wrong-password',
            },
        )

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Invalid API email or password.')
        self.assertNotIn('api_access', self.client.session)


class StaffArticleApiTests(TestCase):
    def setUp(self):
        session = self.client.session
        session['api_access'] = 'staff-token'
        session['api_user'] = {
            'id': 11,
            'username': 'staff1',
            'email': 'staff@example.com',
            'role': {'role_name': 'staff'},
        }
        session.save()
        self.client.cookies[settings.SESSION_COOKIE_NAME] = session.session_key

    @patch('employee.views.list_categories')
    @patch('employee.views.create_article')
    def test_staff_article_create_calls_api(self, mock_create_article, mock_list_categories):
        mock_list_categories.return_value = [ApiCategory(id=5, name='Politics', slug='politics')]

        response = self.client.post(
            reverse('employee_article_add'),
            {
                'title': 'Breaking API News',
                'category_id': '5',
                'category_name': '',
                'body': 'News content from the API.',
                'image': 'https://example.com/news.jpg',
            },
        )

        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.url, reverse('employee_dashboard'))
        mock_create_article.assert_called_once()
        payload, token = mock_create_article.call_args.args
        self.assertEqual(token, 'staff-token')
        self.assertEqual(payload['title'], 'Breaking API News')
        self.assertEqual(payload['category_id'], '5')
        self.assertEqual(payload['author_name'], 'staff1')

    @patch('employee.views.list_categories')
    @patch('employee.views.update_article')
    @patch('employee.views.get_article')
    def test_staff_article_edit_calls_api(self, mock_get_article, mock_update_article, mock_list_categories):
        mock_list_categories.return_value = [ApiCategory(id=5, name='Politics', slug='politics')]
        mock_get_article.return_value = ApiArticle(
            id=42,
            title='Existing Story',
            body='Old body',
            image_url='https://example.com/old.jpg',
            category=ApiCategory(id=5, name='Politics', slug='politics'),
        )

        response = self.client.post(
            reverse('employee_article_edit', args=[42]),
            {
                'title': 'Updated Story',
                'category_id': '5',
                'category_name': '',
                'body': 'Updated body',
                'image': 'https://example.com/new.jpg',
            },
        )

        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.url, reverse('employee_dashboard'))
        mock_update_article.assert_called_once()
        article_id, payload, token = mock_update_article.call_args.args
        self.assertEqual(article_id, 42)
        self.assertEqual(token, 'staff-token')
        self.assertEqual(payload['title'], 'Updated Story')
        self.assertEqual(payload['category_id'], '5')

    @patch('employee.views.delete_article')
    def test_staff_article_delete_calls_api(self, mock_delete_article):
        response = self.client.post(reverse('employee_article_delete', args=[42]))

        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.url, reverse('employee_dashboard'))
        mock_delete_article.assert_called_once_with(42, 'staff-token')

    @patch('employee.views.change_password')
    def test_staff_password_change_calls_api(self, mock_change_password):
        response = self.client.post(
            reverse('employee_password_change'),
            {
                'old_password': 'TestPass123!',
                'new_password': 'NewPass123!',
                'new_password2': 'NewPass123!',
            },
        )

        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.url, reverse('employee_login'))
        mock_change_password.assert_called_once()
        payload, token = mock_change_password.call_args.args
        self.assertEqual(token, 'staff-token')
        self.assertEqual(payload['old_password'], 'TestPass123!')
        self.assertEqual(payload['new_password'], 'NewPass123!')
