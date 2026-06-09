# Internship

News portal internship project powered by the external API.

## Folder Structure

```text
Internship/
|-- config/        project settings and URLs
|-- docs/          API schema and swagger reference
|-- employee/      staff dashboard and news submission
|-- frontend/      public homepage and article views
|-- media/         uploaded media files
|-- static/        CSS and other static assets
|-- templates/     shared Django templates
|-- manage.py
```

## Notes

- All content now comes from the external news API.
- The legacy `news` app has been removed.
- The `accounts` and `admin_portal` apps are no longer used.
- No local SQLite database file is kept in the project.
