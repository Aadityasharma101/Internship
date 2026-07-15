from django.test import TestCase
from django.urls import reverse


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
