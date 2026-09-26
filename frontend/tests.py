import json
from django.test import TestCase
from django.urls import reverse
from unittest.mock import patch


class MockApiResponse:
    def __init__(self, status_code, payload):
        self.status_code = status_code
        self.payload = payload
        self.content = json.dumps(payload).encode('utf-8') if isinstance(payload, (dict, list)) else str(payload).encode('utf-8')
        self.headers = {'Content-Type': 'application/json'}
        self.text = str(payload)

    def raise_for_status(self):
        return None

    def json(self):
        return self.payload


class AdvertisementApiTests(TestCase):
    @patch('frontend.views.requests.request')
    def test_staff_can_create_and_list_ads_via_remote_api(self, mock_request):
        mock_request.side_effect = [
            MockApiResponse(201, {'id': 1, 'title': 'Spring campaign'}),
            MockApiResponse(200, {'count': 1, 'results': [{'id': 1, 'title': 'Spring campaign'}]}),
        ]

        create_response = self.client.post(
            reverse('frontend:ads_api'),
            json.dumps({
                'title': 'Spring campaign',
                'description': 'Seasonal banner',
                'target_url': 'https://example.com',
                'position': 'top_banner',
                'image_url': 'https://example.com/banner.jpg',
            }),
            content_type='application/json',
        )

        self.assertEqual(create_response.status_code, 201)
        self.assertEqual(create_response.json()['title'], 'Spring campaign')

        list_response = self.client.get(reverse('frontend:ads_api'))
        self.assertEqual(list_response.status_code, 200)
        self.assertEqual(list_response.json()['count'], 1)
        self.assertEqual(mock_request.call_args_list[0].args[0], 'POST')
        self.assertEqual(mock_request.call_args_list[0].args[1], 'https://news-portal-hvgs.onrender.com/api/ads/')
        self.assertEqual(mock_request.call_args_list[1].args[0], 'GET')
        self.assertEqual(mock_request.call_args_list[1].args[1], 'https://news-portal-hvgs.onrender.com/api/ads/')


class PortalArticlesProxyTests(TestCase):
    @patch('frontend.views.requests.request')
    def test_portal_articles_list_proxies_to_remote_api(self, mock_request):
        mock_request.return_value = MockApiResponse(200, {
            'results': [{'id': 1, 'title': 'Hello world'}],
            'count': 1,
            'next': None,
            'previous': None,
        })

        response = self.client.get(reverse('frontend:portal_articles_proxy'))

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload['count'], 1)
        self.assertEqual(payload['results'][0]['title'], 'Hello world')
        self.assertEqual(mock_request.call_args.args[0], 'GET')
        self.assertEqual(mock_request.call_args.args[1], 'https://news-portal-hvgs.onrender.com/api/articles/feed/')
        self.assertIn('/api/articles/', mock_request.call_args.args[1])

    @patch('frontend.views.requests.request')
    def test_portal_articles_create_proxies_to_remote_api(self, mock_request):
        mock_request.return_value = MockApiResponse(201, {'id': 2, 'title': 'New story'})

        response = self.client.post(
            reverse('frontend:portal_articles_create_proxy'),
            {'title': 'New story', 'body': 'Body'},
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()['title'], 'New story')
        self.assertEqual(mock_request.call_args.args[0], 'POST')
        self.assertEqual(mock_request.call_args.args[1], 'https://news-portal-hvgs.onrender.com/api/articles/create/')
        self.assertIn('/api/articles/', mock_request.call_args.args[1])


class StaffArticleCreateTests(TestCase):
    def test_staff_dashboard_redirects_to_articles_page(self):
        response = self.client.get(reverse('frontend:staff'))

        self.assertRedirects(
            response,
            reverse('frontend:staff_articles'),
            fetch_redirect_response=False,
        )

    def test_staff_my_articles_page_uses_staff_article_mode(self):
        response = self.client.get(reverse('frontend:staff_my_articles'))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'data-mode="mine"')
        self.assertContains(response, 'My Articles')

    @patch('frontend.views.requests.request')
    def test_staff_add_article_proxies_to_documented_create_api(self, mock_request):
        mock_request.return_value = MockApiResponse(201, {
            'id': 35,
            'title': 'New story',
            'status': 'draft',
        })

        response = self.client.post(
            reverse('frontend:staff_add_article'),
            json.dumps({
                'title': 'New story',
                'body': 'Full story body',
                'summary': 'Short summary',
                'author_name': 'Staff User',
                'category_name': 'International',
            }),
            content_type='application/json',
            HTTP_AUTHORIZATION='Bearer staff-token',
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()['title'], 'New story')
        self.assertEqual(mock_request.call_args.args[0], 'POST')
        self.assertEqual(mock_request.call_args.args[1], 'https://news-portal-hvgs.onrender.com/api/articles/create/')
        kwargs = mock_request.call_args.kwargs
        self.assertEqual(kwargs['headers']['Authorization'], 'Bearer staff-token')
        self.assertEqual(json.loads(kwargs['data'].decode()), {
            'title': 'New story',
            'body': 'Full story body',
            'summary': 'Short summary',
            'author_name': 'Staff User',
            'category_name': 'International',
        })

    @patch('frontend.views.requests.request')
    def test_staff_add_article_lets_remote_api_handle_authentication(self, mock_request):
        mock_request.return_value = MockApiResponse(401, {'detail': 'Authentication credentials were not provided.'})
        response = self.client.post(
            reverse('frontend:staff_add_article'),
            json.dumps({'title': 'New story', 'body': 'Body'}),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json()['detail'], 'Authentication credentials were not provided.')
        self.assertEqual(mock_request.call_args.args[1], 'https://news-portal-hvgs.onrender.com/api/articles/create/')

    @patch('frontend.views.requests.request')
    def test_staff_can_call_documented_publish_action_through_proxy(self, mock_request):
        mock_request.return_value = MockApiResponse(200, {'id': 45, 'status': 'published'})

        response = self.client.post(
            '/remote/api/articles/45/publish/',
            json.dumps({}),
            content_type='application/json',
            HTTP_AUTHORIZATION='Bearer staff-token',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['status'], 'published')
        self.assertEqual(mock_request.call_args.args[0], 'POST')
        self.assertEqual(mock_request.call_args.args[1], 'https://news-portal-hvgs.onrender.com/api/articles/45/publish/')

    @patch('frontend.views.requests.request')
    def test_staff_can_patch_article_update_through_proxy(self, mock_request):
        mock_request.return_value = MockApiResponse(200, {
            'id': 45,
            'title': 'Updated draft',
            'status': 'draft',
        })

        response = self.client.patch(
            reverse('frontend:api_portal_article_update', args=[45]),
            json.dumps({'title': 'Updated draft', 'body': 'Updated body'}),
            content_type='application/json',
            HTTP_AUTHORIZATION='Bearer staff-token',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['title'], 'Updated draft')
        self.assertEqual(mock_request.call_args.args[0], 'PATCH')
        self.assertEqual(mock_request.call_args.args[1], 'https://news-portal-hvgs.onrender.com/api/articles/45/update/')
        kwargs = mock_request.call_args.kwargs
        self.assertEqual(kwargs['headers']['Authorization'], 'Bearer staff-token')
        self.assertEqual(json.loads(kwargs['data'].decode()), {
            'title': 'Updated draft',
            'body': 'Updated body',
        })

    @patch('frontend.views.requests.request')
    def test_staff_reporter_articles_proxy_uses_api_path(self, mock_request):
        mock_request.return_value = MockApiResponse(200, {
            'count': 1,
            'results': [{'id': 45, 'title': 'Draft story', 'status': 'draft'}],
            'next': None,
            'previous': None,
        })

        response = self.client.get(
            reverse('frontend:api_portal_reporter_articles'),
            HTTP_AUTHORIZATION='Bearer staff-token',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['count'], 1)
        self.assertEqual(mock_request.call_args.args[0], 'GET')
        self.assertEqual(mock_request.call_args.args[1], 'https://news-portal-hvgs.onrender.com/api/articles/reporter/articles/')
        self.assertEqual(mock_request.call_args.kwargs['headers']['Authorization'], 'Bearer staff-token')


class ArticleApiViewTests(TestCase):
    @patch('frontend.views.requests.get')
    def test_index_uses_remote_article_feed_api(self, mock_get):
        mock_get.return_value = MockApiResponse(200, {
            'results': [
                {'id': 7, 'title': 'Live from the API', 'description': 'Fetched from remote API'}
            ],
            'count': 1,
            'next': None,
            'previous': None,
        })

        response = self.client.get(reverse('frontend:index'))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.context['articles'][0]['title'], 'Live from the API')
        self.assertEqual(mock_get.call_args.args[0], 'https://news-portal-hvgs.onrender.com/api/articles/feed/?ordering=-id')


class AuthLoginTests(TestCase):
    @patch('frontend.views.requests.get')
    @patch('frontend.views.requests.post')
    def test_admin_login_returns_browser_tokens_and_admin_redirect(self, mock_post, mock_get):
        access_token = 'eyJhbGciOiJub25lIn0.eyJleHAiOjQxMDI0NDgwMDAsInJvbGUiOiJhZG1pbiJ9.signature'
        refresh_token = 'eyJhbGciOiJub25lIn0.eyJleHAiOjQxMDI0NDgwMDAsInR5cGGUiOiJyZWZyZXNoIn0.signature'
        mock_post.return_value = MockApiResponse(200, {
            'access': access_token,
            'refresh': refresh_token,
        })
        mock_get.return_value = MockApiResponse(200, {
            'email': 'admin@example.com',
            'role': 'admin',
            'is_staff': True,
        })

        response = self.client.post(
            reverse('frontend:auth_login'),
            {'email': 'admin@example.com', 'password': 'secret'},
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload['next'], reverse('frontend:users'))
        self.assertEqual(payload['access'], access_token)
        self.assertEqual(payload['refresh'], refresh_token)
        self.assertEqual(payload['user']['email'], 'admin@example.com')
        self.assertNotIn('access_token', self.client.session)

    @patch('frontend.views.requests.get')
    @patch('frontend.views.requests.post')
    def test_admin_login_with_object_role_redirects_to_users(self, mock_post, mock_get):
        access_token = 'eyJhbGciOiJub25lIn0.eyJleHAiOjQxMDI0NDgwMDAsInJvbGUiOiJhZG1pbiJ9.signature'
        refresh_token = 'eyJhbGciOiJub25lIn0.eyJleHAiOjQxMDI0NDgwMDAsInR5cGUiOiJyZWZyZXNoIn0.signature'
        mock_post.return_value = MockApiResponse(200, {
            'access': access_token,
            'refresh': refresh_token,
        })
        mock_get.return_value = MockApiResponse(200, {
            'email': 'admin@example.com',
            'role': {'id': 1, 'role_name': 'Admin'},
            'is_staff': False,
        })

        response = self.client.post(
            reverse('frontend:auth_login'),
            {'email': 'admin@example.com', 'password': 'secret'},
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload['next'], reverse('frontend:users'))
        self.assertEqual(payload['role'], 'admin')

    @patch('frontend.views.requests.get')
    @patch('frontend.views.requests.post')
    def test_staff_login_redirects_to_articles_page(self, mock_post, mock_get):
        access_token = 'eyJhbGciOiJub25lIn0.eyJleHAiOjQxMDI0NDgwMDAsInJvbGUiOiJzdGFmZiJ9.signature'
        refresh_token = 'eyJhbGciOiJub25lIn0.eyJleHAiOjQxMDI0NDgwMDAsInR5cGUiOiJyZWZyZXNoIn0.signature'
        mock_post.return_value = MockApiResponse(200, {
            'access': access_token,
            'refresh': refresh_token,
        })
        mock_get.return_value = MockApiResponse(200, {
            'email': 'staff@example.com',
            'role': {'id': 2, 'role_name': 'Staff'},
            'is_staff': True,
        })

        response = self.client.post(
            reverse('frontend:auth_login'),
            {'email': 'staff@example.com', 'password': 'secret'},
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload['next'], reverse('frontend:staff_articles'))
        self.assertEqual(payload['role'], 'staff')
