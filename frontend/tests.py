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

    def test_staff_can_update_and_delete_an_ad(self):
        created = self.client.post(
            reverse('frontend:ads_api'),
            {
                'title': 'Original campaign',
                'target_url': 'https://example.com',
                'position': 'sidebar',
            },
            content_type='application/json',
        )
        ad_id = created.json()['id']
        detail_url = reverse('frontend:ads_detail', args=[ad_id])

        updated = self.client.patch(
            detail_url,
            {'title': 'Updated campaign', 'is_active': False},
            content_type='application/json',
        )
        self.assertEqual(updated.status_code, 200)
        self.assertEqual(updated.json()['title'], 'Updated campaign')
        self.assertFalse(updated.json()['is_active'])

        deleted = self.client.delete(detail_url)
        self.assertEqual(deleted.status_code, 204)


class AdminContentApiTests(TestCase):
    def test_category_crud(self):
        created = self.client.post(
            reverse('frontend:admin_categories_api'),
            {'name': 'Technology', 'slug': 'technology', 'description': 'Tech news', 'is_featured': True},
            content_type='application/json',
        )
        self.assertEqual(created.status_code, 201)
        category_id = created.json()['id']

        updated = self.client.patch(
            reverse('frontend:admin_category_detail', args=[category_id]),
            {'description': 'Updated tech news', 'is_active': False},
            content_type='application/json',
        )
        self.assertEqual(updated.status_code, 200)
        self.assertFalse(updated.json()['is_active'])
        self.assertEqual(self.client.delete(reverse('frontend:admin_category_detail', args=[category_id])).status_code, 204)

    def test_article_crud(self):
        category = self.client.post(reverse('frontend:admin_categories_api'), {'name': 'World'}, content_type='application/json').json()
        created = self.client.post(
            reverse('frontend:admin_articles_api'),
            {'title': 'Headline', 'category': category['id'], 'description': 'Summary', 'body': 'Full body', 'status': 'published'},
            content_type='application/json',
        )
        self.assertEqual(created.status_code, 201)
        article_id = created.json()['id']
        self.assertTrue(created.json()['is_published'])

        updated = self.client.patch(
            reverse('frontend:admin_article_detail', args=[article_id]),
            {'title': 'Updated headline', 'is_featured': True},
            content_type='application/json',
        )
        self.assertEqual(updated.status_code, 200)
        self.assertTrue(updated.json()['is_featured'])
        self.assertEqual(self.client.delete(reverse('frontend:admin_article_detail', args=[article_id])).status_code, 204)


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
