from django.contrib import messages
from django.contrib.auth import authenticate, login, logout
from django.shortcuts import redirect, render
from django.views.decorators.http import require_http_methods

from .forms import ReaderRegistrationForm

ROLE_READER = 'reader'
ROLE_EMPLOYEE = 'employee'
ROLE_ADMIN = 'admin'


@require_http_methods(['GET', 'POST'])
def unified_login(request):
    if request.user.is_authenticated:
        return _redirect_for_user(request.user, request.GET.get('next'))

    selected_role = request.GET.get('role', ROLE_READER)
    if selected_role not in (ROLE_READER, ROLE_EMPLOYEE, ROLE_ADMIN):
        selected_role = ROLE_READER

    if request.method == 'POST':
        role = request.POST.get('role', ROLE_READER)
        username = request.POST.get('username', '').strip()
        password = request.POST.get('password', '')
        next_url = request.POST.get('next') or request.GET.get('next')

        user = authenticate(request, username=username, password=password)
        if user is None:
            messages.error(request, 'Invalid username or password.')
            selected_role = role
        elif role == ROLE_ADMIN:
            if not user.is_superuser:
                messages.error(request, 'This account does not have administrator access.')
                selected_role = role
            else:
                login(request, user)
                messages.success(request, f'Welcome, {user.username}.')
                return redirect(next_url or 'admin_dashboard')
        elif role == ROLE_EMPLOYEE:
            if not user.is_staff:
                messages.error(request, 'This account is not registered as an employee.')
                selected_role = role
            else:
                login(request, user)
                messages.success(request, f'Welcome back, {user.username}.')
                if user.is_superuser:
                    return redirect(next_url or 'admin_dashboard')
                return redirect(next_url or 'employee_dashboard')
        else:
            login(request, user)
            messages.success(request, f'Welcome back, {user.username}.')
            return redirect(next_url or 'home')

    return render(request, 'accounts/login.html', {
        'selected_role': selected_role,
        'next': request.GET.get('next', ''),
    })


def _redirect_for_user(user, next_url=None):
    if next_url:
        return redirect(next_url)
    if user.is_superuser:
        return redirect('admin_dashboard')
    if user.is_staff:
        return redirect('employee_dashboard')
    return redirect('home')


def register(request):
    if request.user.is_authenticated:
        return redirect('home')

    if request.method == 'POST':
        form = ReaderRegistrationForm(request.POST)
        if form.is_valid():
            user = form.save()
            login(request, user)
            messages.success(request, 'Account created. You can now join the discussion.')
            return redirect('home')
    else:
        form = ReaderRegistrationForm()

    return render(request, 'accounts/register.html', {'form': form})


def reader_logout(request):
    logout(request)
    messages.info(request, 'You have been signed out.')
    return redirect('home')
