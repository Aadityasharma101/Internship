from django.contrib import messages
from django.contrib.auth import logout
from django.contrib.auth.views import LoginView
from django.db.models import Count, Sum
from django.shortcuts import get_object_or_404, redirect, render
from django.urls import reverse_lazy
from django.views.decorators.http import require_POST

from accounts.forms import StaffLoginForm
from news.models import Article, ArticleStats, Comment
from django.contrib.auth import get_user_model

from .decorators import superuser_required
from .forms import AdminArticleForm, EmployeeCreateForm

User = get_user_model()


class AdminLoginView(LoginView):
    template_name = 'admin_portal/login.html'
    authentication_form = StaffLoginForm
    redirect_authenticated_user = True

    def get_success_url(self):
        return reverse_lazy('admin_dashboard')

    def form_valid(self, form):
        user = form.get_user()
        if not user.is_superuser:
            messages.error(self.request, 'This login is for administrators only.')
            if user.is_staff:
                messages.info(self.request, 'Use the employee portal instead.')
            return self.form_invalid(form)
        messages.success(self.request, f'Welcome, Admin {user.username}!')
        return super().form_valid(form)


def admin_logout(request):
    logout(request)
    messages.info(request, 'Logged out from admin portal.')
    return redirect('home')


@superuser_required
def dashboard(request):
    total_news = Article.objects.count()
    total_users = User.objects.count()
    total_views = ArticleStats.objects.aggregate(total=Sum('views_count'))['total'] or 0
    total_employees = User.objects.filter(is_staff=True, is_superuser=False).count()
    recent_comments = (
        Comment.objects.select_related('user', 'article', 'article__author')
        .order_by('-created_at')[:15]
    )
    recent_articles = (
        Article.objects.select_related('author', 'category', 'stats')
        .order_by('-created_at')[:8]
    )
    return render(
        request,
        'admin_portal/dashboard.html',
        {
            'total_news': total_news,
            'total_users': total_users,
            'total_views': total_views,
            'total_employees': total_employees,
            'recent_comments': recent_comments,
            'recent_articles': recent_articles,
        },
    )


@superuser_required
def article_list(request):
    articles = (
        Article.objects.select_related('author', 'category', 'stats')
        .annotate(comment_count=Count('comments'))
        .order_by('-created_at')
    )
    return render(request, 'admin_portal/article_list.html', {'articles': articles})


@superuser_required
def article_edit(request, slug):
    article = get_object_or_404(Article, slug=slug)
    if request.method == 'POST':
        form = AdminArticleForm(request.POST, request.FILES, instance=article)
        if form.is_valid():
            form.save()
            messages.success(request, 'Article updated.')
            return redirect('admin_article_list')
    else:
        form = AdminArticleForm(instance=article)
    return render(
        request,
        'admin_portal/article_form.html',
        {'form': form, 'title': 'Edit Article', 'article': article},
    )


@superuser_required
@require_POST
def article_delete(request, slug):
    article = get_object_or_404(Article, slug=slug)
    article.delete()
    messages.success(request, 'Article deleted.')
    return redirect('admin_article_list')


@superuser_required
def employee_list(request):
    employees = User.objects.filter(is_staff=True).order_by('-date_joined')
    return render(request, 'admin_portal/employee_list.html', {'employees': employees})


@superuser_required
def employee_add(request):
    if request.method == 'POST':
        form = EmployeeCreateForm(request.POST)
        if form.is_valid():
            form.save()
            messages.success(request, 'Employee account created.')
            return redirect('admin_employee_list')
    else:
        form = EmployeeCreateForm()
    return render(request, 'admin_portal/employee_form.html', {'form': form})


@superuser_required
def user_list(request):
    users = User.objects.all().order_by('-date_joined')
    return render(request, 'admin_portal/user_list.html', {'users': users})
