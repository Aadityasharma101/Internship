from django.test import TestCase
from django.contrib.auth import get_user_model
from django.urls import reverse

from news.models import Article, Bookmark


User = get_user_model()


class BookmarkFlowTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='reader1', password='pass12345')
        self.article = Article.objects.create(
            title='Sample News Story',
            content='This is a test article.',
            status=Article.Status.PUBLISHED,
        )
        self.article_url = reverse('article_detail', args=[self.article.slug])
        self.bookmark_url = reverse('toggle_bookmark', args=[self.article.slug])

    def test_authenticated_user_can_save_and_view_bookmarks(self):
        self.client.force_login(self.user)

        response = self.client.post(self.bookmark_url, {'next': self.article_url})

        self.assertRedirects(response, self.article_url, fetch_redirect_response=False)
        self.assertTrue(Bookmark.objects.filter(user=self.user, article=self.article).exists())

        response = self.client.get(reverse('bookmark_list'))
        self.assertContains(response, self.article.title)
        self.assertContains(response, 'Remove')

    def test_authenticated_user_can_remove_bookmark(self):
        Bookmark.objects.create(user=self.user, article=self.article)
        self.client.force_login(self.user)

        response = self.client.post(self.bookmark_url, {'next': reverse('bookmark_list')})

        self.assertRedirects(response, reverse('bookmark_list'), fetch_redirect_response=False)
        self.assertFalse(Bookmark.objects.filter(user=self.user, article=self.article).exists())

    def test_anonymous_user_is_redirected_to_login(self):
        response = self.client.post(self.bookmark_url, {'next': self.article_url})

        self.assertEqual(response.status_code, 302)
        self.assertIn(reverse('login'), response.url)
        self.assertFalse(Bookmark.objects.filter(article=self.article).exists())

        response = self.client.get(reverse('bookmark_list'))
        self.assertEqual(response.status_code, 302)
        self.assertIn(reverse('login'), response.url)
