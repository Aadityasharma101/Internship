from functools import wraps

from django.contrib import messages
from django.shortcuts import redirect

from frontend.api import is_api_authenticated, is_staff_profile, session_user


def staff_member_required(view_func):
    @wraps(view_func)
    def wrapper(request, *args, **kwargs):
        if not is_api_authenticated(request):
            messages.warning(request, 'Please log in with your API staff account.')
            return redirect('employee_login')
        profile = session_user(request)
        role_name = (profile.get('role') or {}).get('role_name', '').lower() if isinstance(profile.get('role'), dict) else ''
        if not is_staff_profile(profile):
            messages.error(request, 'Employee access only.')
            return redirect('home')
        return view_func(request, *args, **kwargs)

    return wrapper
