from dataclasses import dataclass
from datetime import datetime, timezone as datetime_timezone
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen
import json

from django.conf import settings
from django.utils import timezone


API_BASE_URL = getattr(settings, 'NEWS_API_BASE_URL', 'https://news-portal-hvgs.onrender.com').rstrip('/')


class ApiError(Exception):
    def __init__(self, message='The news API request failed.', status_code=None, details=None):
        super().__init__(message)
        self.status_code = status_code
        self.details = details or {}


@dataclass
class ApiCategory:
    id: int | None
    name: str
    slug: str


@dataclass
class ApiAuthor:
    username: str = ''

    def get_full_name(self):
        return self.username


@dataclass
class ApiArticle:
    id: int
    title: str
    body: str = ''
    image_url: str = ''
    author: ApiAuthor | None = None
    category: ApiCategory | None = None
    published_at: datetime | None = None
    status: str = ''
    view_count: int = 0
    comment_count: int = 0

    @property
    def slug(self):
        return self.id

    @property
    def pk(self):
        return self.id

    @property
    def excerpt(self):
        return self.body[:220]

    @property
    def content(self):
        return self.body

    @property
    def views_count(self):
        return self.view_count

    @property
    def is_breaking(self):
        return False


def api_get(path, token=None, params=None):
    return _api_request('GET', path, token=token, params=params)


def api_post(path, payload=None, token=None):
    return _api_request('POST', path, payload=payload or {}, token=token)


def api_patch(path, payload=None, token=None):
    return _api_request('PATCH', path, payload=payload or {}, token=token)


def api_delete(path, token=None):
    return _api_request('DELETE', path, token=token)


def login(email, password):
    return api_post('/api/token/', {'email': email, 'password': password})

def get_profile(token):
    return api_get('/api/users/me/', token=token)


def list_categories():
    data = api_get('/articles/categories/')
    return [_normalize_category(item) for item in _results(data)]


def search_articles(category_slug='', query=''):
    data = api_get('/articles/search/', params={'category': category_slug, 'query': query})
    return [_normalize_article(item) for item in _results(data)]


def list_articles(token=None):
    data = api_get('/articles/', token=token)
    return [_normalize_article(item) for item in _results(data)]


def list_trending_articles():
    data = api_get('/articles/trending/')
    return [_normalize_article(item) for item in _results(data)]


def get_article(article_id, token=None):
    return _normalize_article(api_get(f'/articles/{article_id}/', token=token))


def create_article(payload, token):
    return _normalize_article(api_post('/articles/create/', payload=payload, token=token))


def update_article(article_id, payload, token):
    return _normalize_article(api_patch(f'/articles/{article_id}/update/', payload=payload, token=token))


def delete_article(article_id, token):
    api_delete(f'/articles/{article_id}/delete/', token=token)


def change_password(payload, token):
    return api_post('/api/users/change_password/', payload=payload, token=token)


def session_access_token(request):
    return request.session.get('api_access')


def session_user(request):
    return request.session.get('api_user') or {}


def is_api_authenticated(request):
    return bool(session_access_token(request))


def api_role_name(user):
    role = (user or {}).get('role') or {}
    if isinstance(role, dict):
        return (role.get('role_name') or '').lower()
    return str(role or '').lower()


def is_staff_profile(user):
    role_name = api_role_name(user)
    return any(name in role_name for name in ('admin', 'staff', 'employee', 'reporter'))


def _api_request(method, path, payload=None, token=None, params=None):
    query = ''
    clean_params = {key: value for key, value in (params or {}).items() if value not in (None, '')}
    if clean_params:
        query = f'?{urlencode(clean_params)}'

    body = None
    headers = {'Accept': 'application/json'}
    if payload is not None:
        body = json.dumps(payload).encode('utf-8')
        headers['Content-Type'] = 'application/json'
    if token:
        headers['Authorization'] = f'Bearer {token}'

    request = Request(f'{API_BASE_URL}{path}{query}', data=body, headers=headers, method=method)
    try:
        with urlopen(request, timeout=12) as response:
            raw = response.read().decode('utf-8')
            if not raw:
                return {}
            return json.loads(raw)
    except HTTPError as error:
        details = _load_error_details(error)
        message = details.get('detail') or details.get('message') or 'The news API rejected the request.'
        raise ApiError(message, status_code=error.code, details=details) from error
    except (URLError, TimeoutError) as error:
        raise ApiError('The news API is currently unreachable.') from error
    except json.JSONDecodeError as error:
        raise ApiError('The news API returned an unreadable response.') from error


def _load_error_details(error):
    try:
        raw = error.read().decode('utf-8')
        return json.loads(raw) if raw else {}
    except Exception:
        return {}


def _results(data):
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        if isinstance(data.get('results'), list):
            return data['results']
        if isinstance(data.get('articles'), list):
            return data['articles']
        if isinstance(data.get('categories'), list):
            return data['categories']
    return []


def _normalize_category(data):
    if not isinstance(data, dict):
        return ApiCategory(id=None, name='', slug='')
    return ApiCategory(
        id=data.get('id'),
        name=data.get('name') or data.get('category_name') or 'General',
        slug=data.get('slug') or data.get('category_slug') or '',
    )


def _normalize_article(data):
    if not isinstance(data, dict):
        return ApiArticle(id=0, title='')

    category = None
    category_data = data.get('category')
    if isinstance(category_data, dict):
        category = ApiCategory(
            id=category_data.get('id') or data.get('category_id'),
            name=category_data.get('name') or category_data.get('category_name') or 'General',
            slug=category_data.get('slug') or category_data.get('category_slug') or '',
        )

    category_name = data.get('category_name')
    category_slug = data.get('category_slug')
    if category_name or category_slug:
        category = ApiCategory(id=data.get('category_id'), name=category_name or 'General', slug=category_slug or '')

    author_data = data.get('author')
    author_name = data.get('author_name') or ''
    if isinstance(author_data, dict):
        author_name = author_data.get('username') or author_data.get('name') or author_name
    elif isinstance(author_data, str):
        author_name = author_data or author_name
    published_at = _parse_datetime(data.get('published_at') or data.get('created_at'))
    return ApiArticle(
        id=data.get('id') or 0,
        title=data.get('title') or 'Untitled story',
        body=data.get('body') or data.get('content') or data.get('excerpt') or '',
        image_url=data.get('image') or data.get('image_url') or '',
        author=ApiAuthor(author_name) if author_name else None,
        category=category,
        published_at=published_at,
        status=data.get('status') or '',
        view_count=data.get('view_count') or data.get('views_count') or 0,
        comment_count=data.get('comments_count') or data.get('comment_count') or 0,
    )


def _parse_datetime(value):
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(str(value).replace('Z', '+00:00'))
    except ValueError:
        return None
    if timezone.is_naive(parsed):
        return timezone.make_aware(parsed, datetime_timezone.utc)
    return parsed
