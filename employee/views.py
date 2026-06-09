from django.contrib import messages
from django.shortcuts import redirect, render
from django.views.decorators.http import require_http_methods, require_POST

from frontend.api import (
    ApiError,
    change_password,
    create_article,
    delete_article,
    get_article,
    get_profile,
    list_articles,
    list_categories,
    login as api_login,
    session_access_token,
    session_user,
    update_article,
    api_role_name,
    is_staff_profile,
)

from .decorators import staff_member_required
from .forms import ArticleForm, PasswordChangeForm


@require_http_methods(['GET', 'POST'])
def employee_login(request):
    if request.session.get('api_access'):
        return _redirect_for_api_user(request)

    login_error = ''
    if request.method == 'POST':
        email = request.POST.get('email', '').strip()
        password = request.POST.get('password', '')
        if '@' not in email:
            login_error = 'Use the email address you registered with. This API login does not accept username.'
            return render(request, 'employee/pages/login.html', {'login_error': login_error, 'email': email})
        try:
            tokens = api_login(email, password)
            profile = get_profile(tokens['access'])
        except ApiError as error:
            login_error = _login_error_message(error)
        else:
            if not is_staff_profile(profile):
                login_error = 'This API account is not registered as staff.'
            else:
                request.session['api_access'] = tokens['access']
                request.session['api_refresh'] = tokens['refresh']
                request.session['api_user'] = profile
                messages.success(request, f"Welcome back, {profile.get('username', email)}.")
                return redirect('employee_dashboard')

    return render(request, 'employee/pages/login.html', {'login_error': login_error})


def employee_logout(request):
    request.session.pop('api_access', None)
    request.session.pop('api_refresh', None)
    request.session.pop('api_user', None)
    messages.info(request, 'Logged out from employee portal.')
    return redirect('home')


@staff_member_required
def dashboard(request):
    api_error = ''
    try:
        articles = list_articles(token=session_access_token(request))
    except ApiError as error:
        articles = []
        api_error = str(error)
    article_count = len(articles)
    published_count = sum(1 for article in articles if article.status == 'published')
    draft_count = sum(1 for article in articles if article.status == 'draft')
    pending_count = sum(1 for article in articles if article.status == 'pending_review')
    total_views = sum(article.views_count for article in articles)
    return render(
        request,
        'employee/pages/dashboard.html',
        {
            'articles': articles,
            'total_views': total_views,
            'article_count': article_count,
            'published_count': published_count,
            'draft_count': draft_count,
            'pending_count': pending_count,
            'recent_comments': [],
            'api_error': api_error,
        },
    )


@staff_member_required
def article_create(request):
    categories = _categories()
    if request.method == 'POST':
        form = ArticleForm(request.POST, categories=categories)
        if form.is_valid():
            try:
                create_article(form.to_api_payload(author_name=_author_name(request)), session_access_token(request))
            except ApiError as error:
                form.add_error(None, str(error))
            else:
                messages.success(request, 'Article created in the API successfully.')
                return redirect('employee_dashboard')
    else:
        form = ArticleForm(categories=categories)
    return render(request, 'employee/pages/article_form.html', {'form': form, 'title': 'Add News'})


@staff_member_required
def article_edit(request, article_id):
    categories = _categories()
    try:
        article = get_article(article_id, token=session_access_token(request))
    except ApiError as error:
        messages.error(request, str(error))
        return redirect('employee_dashboard')

    if request.method == 'POST':
        form = ArticleForm(request.POST, categories=categories)
        if form.is_valid():
            try:
                update_article(article_id, form.to_api_payload(author_name=_author_name(request)), session_access_token(request))
            except ApiError as error:
                form.add_error(None, str(error))
            else:
                messages.success(request, 'Article updated in the API.')
                return redirect('employee_dashboard')
    else:
        form = ArticleForm(
            initial={
                'title': article.title,
                'body': article.body,
                'image': article.image_url,
                'category_id': article.category.id if article.category else '',
                'category_name': '',
            },
            categories=categories,
        )
    return render(
        request,
        'employee/pages/article_form.html',
        {'form': form, 'title': 'Edit Article', 'article': article},
    )


@staff_member_required
@require_POST
def article_delete(request, article_id):
    try:
        delete_article(article_id, session_access_token(request))
    except ApiError as error:
        messages.error(request, str(error))
    else:
        messages.success(request, 'Article deleted from the API.')
    return redirect('employee_dashboard')


@staff_member_required
def password_change(request):
    api_error = ''
    if request.method == 'POST':
        form = PasswordChangeForm(request.POST)
        if form.is_valid():
            try:
                change_password(form.to_api_payload(), session_access_token(request))
            except ApiError as error:
                api_error = _login_error_message(error)
                form.add_error(None, api_error)
            else:
                request.session.pop('api_access', None)
                request.session.pop('api_refresh', None)
                request.session.pop('api_user', None)
                messages.success(request, 'Password changed successfully. Please log in again.')
                return redirect('employee_login')
    else:
        form = PasswordChangeForm()

    return render(
        request,
        'employee/pages/password_change.html',
        {
            'form': form,
            'api_error': api_error,
        },
    )


def _categories():
    try:
        return list_categories()
    except ApiError:
        return []


def _author_name(request):
    profile = session_user(request)
    return profile.get('username') or profile.get('email') or ''


def _redirect_for_api_user(request):
    profile = session_user(request)
    if is_staff_profile(profile):
        return redirect('employee_dashboard')
    return redirect('home')


def _login_error_message(error):
    details = getattr(error, 'details', {}) or {}
    if isinstance(details, dict):
        for key in ('detail', 'message', 'error'):
            if details.get(key):
                return str(details[key])
        non_field_errors = details.get('non_field_errors')
        if isinstance(non_field_errors, list) and non_field_errors:
            return str(non_field_errors[0])
        if isinstance(non_field_errors, str):
            return non_field_errors
    return 'Invalid API email or password.'
