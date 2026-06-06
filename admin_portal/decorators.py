from functools import wraps

from django.contrib import messages
from django.shortcuts import redirect


def superuser_required(view_func):
    @wraps(view_func)
    def wrapper(request, *args, **kwargs):
        if not request.user.is_authenticated:
            messages.warning(request, 'Please log in as admin.')
            return redirect('admin_login')
        if not request.user.is_superuser:
            messages.error(request, 'Admin access only.')
            if request.user.is_staff:
                return redirect('employee_dashboard')
            return redirect('home')
        return view_func(request, *args, **kwargs)

    return wrapper
