# Internship
works done during internship
# news-portal-frontend

## Running locally

```bash
python manage.py migrate
python manage.py runserver
```

## Render deployment

Install dependencies from `requirements.txt`, then use this start command so the
bookmark table exists before the web process accepts requests:

```bash
python manage.py migrate && gunicorn config.wsgi:application
```
# news-portal-frontend
