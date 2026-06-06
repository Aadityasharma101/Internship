from functools import wraps

from django.contrib import messages
from django.shortcuts import redirect


def staff_member_required(view_func):
    @wraps(view_func)
    def wrapper(request, *args, **kwargs):
        if not request.user.is_authenticated:
            messages.warning(request, 'Please log in as an employee.')
            return redirect('employee_login')
        if request.user.is_superuser:
            return redirect('admin_dashboard')
        if not request.user.is_staff:
            messages.error(request, 'Employee access only.')
            return redirect('home')
        return view_func(request, *args, **kwargs)

    return wrapper
