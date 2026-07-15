from django.test import TestCase
from django.urls import reverse
from unittest.mock import patch


class MockApiResponse:
    def __init__(self, status_code, payload):
        self.status_code = status_code
        self.payload = payload
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
