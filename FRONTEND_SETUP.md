# Django Frontend Development Setup

This project is configured for frontend development using Django templates with REST API integration.

## Project Structure

```
news-portal/
├── frontend/                          # Frontend Django App
│   ├── static/                        # Static files (served at /static/)
│   │   ├── css/                      # CSS stylesheets
│   │   │   └── style.css
│   │   ├── js/                       # JavaScript files
│   │   │   ├── main.js              # Global JavaScript utilities
│   │   │   └── news.js              # News fetching & display
│   │   └── images/                   # Images & media assets
│   ├── templates/                     # HTML templates
│   │   └── frontend/
│   │       ├── base.html            # Base template for frontend
│   │       └── index.html           # Home page template
│   ├── migrations/                    # Database migrations
│   ├── urls.py                       # Frontend URL routing
│   ├── views.py                      # Frontend views
│   ├── models.py                     # (Optional) Data models
│   └── ...
├── templates/                         # Project-wide templates
│   └── base.html                     # Global base template
├── static/                            # Project-wide static files
├── media/                             # User uploads & media files (served at /media/)
├── staticfiles/                       # Collected static files (production)
├── config/                            # Project settings
│   ├── settings.py                  # Django settings (configured for frontend)
│   ├── urls.py                      # Project URL routing
│   └── ...
└── manage.py                          # Django management script
```

## Key Configurations

### Static Files
- **STATIC_URL**: `/static/`
- **STATIC_ROOT**: `staticfiles/` (where `collectstatic` collects files)
- **STATICFILES_DIRS**: `static/` (additional static files directory)

### Media Files
- **MEDIA_URL**: `/media/`
- **MEDIA_ROOT**: `media/` (user uploads)

### Templates
- **APP_DIRS**: Enabled (templates in app `templates/` folders)
- **DIRS**: `templates/` (project-wide templates)

## Getting Started

### 1. Activate Virtual Environment
```bash
# Windows
myvenv\Scripts\activate

# Linux/Mac
source myvenv/bin/activate
```

### 2. Run Migrations
```bash
python manage.py migrate
```

### 3. Create Superuser (Optional)
```bash
python manage.py createsuperuser
```

### 4. Collect Static Files
```bash
python manage.py collectstatic --noinput
```

### 5. Run Development Server
```bash
python manage.py runserver
```

Access the frontend at: `http://localhost:8000/`

## Frontend Architecture

This setup follows a **Frontend + REST API** pattern:

1. **Django Frontend** serves HTML templates with CSS/JavaScript
2. **JavaScript** makes AJAX calls to REST API endpoints
3. **API** returns JSON data (can be a separate Django REST framework app or external API)

### API Integration Example

In `frontend/static/js/news.js`, update the API endpoint:

```javascript
// Fetch news from your REST API
const response = await fetch('/api/news/');  // Update this to your API endpoint
```

## File Organization

### CSS
Place all stylesheets in `frontend/static/css/`:
- `style.css` - Global styles
- `components.css` - Component-specific styles (optional)
- `responsive.css` - Mobile/responsive styles (optional)

### JavaScript
Place all scripts in `frontend/static/js/`:
- `main.js` - Global utilities & initialization
- `news.js` - News-specific functionality
- `api.js` - API client utilities (optional)
- `components/` - Component JavaScript files (optional)

### Images
Place all images in `frontend/static/images/`:
- Organize by type (icons, backgrounds, etc.)

### Templates
Place templates in `frontend/templates/frontend/`:
- `base.html` - Base template with header/footer
- `index.html` - Home page
- Add more templates as needed

## Creating New Templates

1. Create a new `.html` file in `frontend/templates/frontend/`
2. Extend `base.html`:

```html
{% extends 'frontend/base.html' %}

{% block title %}Page Title{% endblock %}

{% block content %}
<!-- Your content here -->
{% endblock %}
```

3. Create a corresponding view in `frontend/views.py`:

```python
def new_page(request):
    return render(request, 'frontend/new_page.html')
```

4. Add URL to `frontend/urls.py`:

```python
path('new-page/', views.new_page, name='new_page'),
```

## Adding Static Files to Templates

Use the `{% static %}` template tag:

```html
{% load static %}
<link rel="stylesheet" href="{% static 'css/style.css' %}">
<script src="{% static 'js/main.js' %}"></script>
<img src="{% static 'images/logo.png' %}" alt="Logo">
```

## Development Tips

- **Debug Mode**: `DEBUG = True` in settings (automatically serves static files)
- **Hot Reload**: Use browser refresh or auto-reload tools
- **Static Files**: Change CSS/JS files and refresh browser (cache-busting with versioning recommended for production)
- **API Calls**: Use `fetch()` API or AJAX libraries (jQuery, Axios, etc.)

## Production Deployment

Before deploying:

1. Set `DEBUG = False` in settings.py
2. Configure `ALLOWED_HOSTS` with your domain
3. Run `collectstatic`:
   ```bash
   python manage.py collectstatic
   ```
4. Configure web server (Nginx, Apache) to serve:
   - `/static/` → `staticfiles/` folder
   - `/media/` → `media/` folder
5. Use a production WSGI server (Gunicorn, uWSGI)

## Useful Commands

```bash
# Run server
python manage.py runserver

# Collect static files
python manage.py collectstatic

# Run tests
python manage.py test

# Create new app
python manage.py startapp app_name

# Make migrations
python manage.py makemigrations

# Apply migrations
python manage.py migrate

# Create superuser
python manage.py createsuperuser

# Shell access
python manage.py shell

# Check for security issues
python manage.py check --deploy
```

## Common Issues

### Static files not loading
- Ensure `DEBUG = True` for development
- Run `collectstatic` if using `DEBUG = False`
- Check `STATIC_URL` and `STATIC_ROOT` in settings

### 404 errors on static files
- Verify files exist in correct directories
- Clear browser cache (Ctrl+Shift+Delete)
- Restart development server

### Media files not serving
- Check `MEDIA_URL` and `MEDIA_ROOT` in settings
- Ensure URLs are configured for media file serving

## Next Steps

1. Set up your REST API endpoints (if not already done)
2. Update `frontend/static/js/news.js` with your actual API endpoints
3. Create additional templates and views as needed
4. Add more CSS and JavaScript functionality
5. Test thoroughly before deployment

---

For more information on Django static files, see: https://docs.djangoproject.com/en/6.0/howto/static-files/
