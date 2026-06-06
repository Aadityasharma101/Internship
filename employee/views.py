from django.contrib import messages
from django.contrib.auth import logout
from django.contrib.auth.views import LoginView
from django.db.models import Count
from django.shortcuts import get_object_or_404, redirect, render
from django.urls import reverse_lazy
from django.views.decorators.http import require_POST

from accounts.forms import StaffLoginForm
from news.models import Article, Comment

from .decorators import staff_member_required
from .forms import ArticleForm


class EmployeeLoginView(LoginView):
    template_name = 'employee/login.html'
    authentication_form = StaffLoginForm
    redirect_authenticated_user = True

    def form_valid(self, form):
        user = form.get_user()
        if not user.is_staff:
            messages.error(self.request, 'This login is for employees only.')
            return self.form_invalid(form)
        messages.success(self.request, f'Welcome back, {user.username}!')
        return super().form_valid(form)

    def get_success_url(self):
        if self.request.user.is_superuser:
            return reverse_lazy('admin_dashboard')
        return reverse_lazy('employee_dashboard')


def employee_logout(request):
    logout(request)
    messages.info(request, 'Logged out from employee portal.')
    return redirect('home')


@staff_member_required
def dashboard(request):
    articles = (
        Article.objects.filter(author=request.user)
        .select_related('category', 'stats')
        .annotate(comment_count=Count('comments'))
        .order_by('-created_at')
    )
    total_views = sum(a.views_count for a in articles)
    recent_comments = (
        Comment.objects.filter(article__author=request.user)
        .select_related('user', 'article')
        .order_by('-created_at')[:10]
    )
    return render(
        request,
        'employee/dashboard.html',
        {
            'articles': articles,
            'total_views': total_views,
            'article_count': articles.count(),
            'recent_comments': recent_comments,
        },
    )


@staff_member_required
def article_create(request):
    if request.method == 'POST':
        form = ArticleForm(request.POST, request.FILES)
        if form.is_valid():
            article = form.save(commit=False)
            article.author = request.user
            article.save()
            messages.success(request, 'Article created successfully.')
            return redirect('employee_dashboard')
    else:
        form = ArticleForm(initial={'status': Article.Status.PUBLISHED})
    return render(request, 'employee/article_form.html', {'form': form, 'title': 'Add News'})


@staff_member_required
def article_edit(request, slug):
    article = get_object_or_404(Article, slug=slug, author=request.user)
    if request.method == 'POST':
        form = ArticleForm(request.POST, request.FILES, instance=article)
        if form.is_valid():
            form.save()
            messages.success(request, 'Article updated.')
            return redirect('employee_dashboard')
    else:
        form = ArticleForm(instance=article)
    return render(
        request,
        'employee/article_form.html',
        {'form': form, 'title': 'Edit Article', 'article': article},
    )


@staff_member_required
@require_POST
def article_delete(request, slug):
    article = get_object_or_404(Article, slug=slug, author=request.user)
    article.delete()
    messages.success(request, 'Article deleted.')
    return redirect('employee_dashboard')
