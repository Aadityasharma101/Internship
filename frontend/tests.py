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

    def json(self):
        return self.payload


class AdvertisementApiTests(TestCase):
    def test_staff_can_create_and_list_ads(self):
        response = self.client.post(
            reverse('frontend:ads_api'),
            {
                'title': 'Spring campaign',
                'description': 'Seasonal banner',
                'target_url': 'https://example.com',
                'position': 'top_banner',
                'image_url': 'https://example.com/banner.jpg',
            },
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 201)
        payload = response.json()
        self.assertEqual(payload['title'], 'Spring campaign')

        list_response = self.client.get(reverse('frontend:ads_api'))
        self.assertEqual(list_response.status_code, 200)
        self.assertGreaterEqual(list_response.json()['count'], 1)


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
        self.assertEqual(mock_request.call_args.args[1], 'https://news-portal-hvgs.onrender.com/articles/feed/')
        self.assertNotIn('/api/articles/', mock_request.call_args.args[1])

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
        self.assertEqual(mock_request.call_args.args[1], 'https://news-portal-hvgs.onrender.com/articles/create/')
        self.assertNotIn('/api/articles/', mock_request.call_args.args[1])


class StaffArticleCreateTests(TestCase):
    def test_staff_add_article_requires_authentication(self):
        response = self.client.post(
            reverse('frontend:staff_add_article'),
            json.dumps({'title': 'New story', 'body': 'Body'}),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json()['detail'], 'Authentication required')

    @patch('frontend.views.requests.post')
    def test_staff_add_article_forwards_publishable_article_payload(self, mock_post):
        mock_post.return_value = MockApiResponse(201, {
            'id': 35,
            'title': 'New story',
            'status': 'published',
        })

        response = self.client.post(
            reverse('frontend:staff_add_article'),
            json.dumps({
                'title': 'New story',
                'body': 'Full story body',
                'description': 'Short summary',
                'category': 'International',
                'image': 'https://example.com/story.jpg',
                'published': True,
                'featured': True,
            }),
            content_type='application/json',
            HTTP_AUTHORIZATION='Bearer staff-token',
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(mock_post.call_args.args[0], 'https://news-portal-hvgs.onrender.com/articles/create/')

        kwargs = mock_post.call_args.kwargs
        self.assertEqual(kwargs['headers']['Authorization'], 'Bearer staff-token')
        payload = kwargs['json']
        self.assertEqual(payload['title'], 'New story')
        self.assertEqual(payload['status'], 'published')
        self.assertEqual(payload['body'], 'Full story body')
        self.assertEqual(payload['content'], 'Full story body')
        self.assertEqual(payload['description'], 'Short summary')
        self.assertEqual(payload['summary'], 'Short summary')
        self.assertEqual(payload['category_name'], 'International')
        self.assertEqual(payload['image_url'], 'https://example.com/story.jpg')
        self.assertTrue(payload['featured'])
        self.assertTrue(payload['published'])
        self.assertIn('published_at', payload)

    @patch('frontend.views.requests.post')
    def test_staff_add_article_retries_pending_review_when_remote_blocks_publish(self, mock_post):
        mock_post.side_effect = [
            MockApiResponse(403, {'detail': 'You do not have permission to perform this action.'}),
            MockApiResponse(201, {'id': 36, 'title': 'Pending story', 'status': 'pending_review'}),
        ]

        response = self.client.post(
            reverse('frontend:staff_add_article'),
            json.dumps({
                'title': 'Pending story',
                'body': 'Full story body',
                'description': 'Short summary',
                'published': True,
            }),
            content_type='application/json',
            HTTP_AUTHORIZATION='Bearer staff-token',
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(mock_post.call_count, 2)
        retry_payload = mock_post.call_args.kwargs['json']
        self.assertEqual(retry_payload['status'], 'pending_review')
        self.assertFalse(retry_payload['published'])
        self.assertFalse(retry_payload['is_published'])
        self.assertNotIn('published_at', retry_payload)
        self.assertIn('pending review', response.json()['detail'])


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
    def test_staff_login_redirects_to_staff_dashboard(self, mock_post, mock_get):
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
        self.assertEqual(payload['next'], reverse('frontend:staff'))
        self.assertEqual(payload['role'], 'staff')
