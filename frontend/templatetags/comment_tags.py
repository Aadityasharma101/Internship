from django import template

register = template.Library()

@register.inclusion_tag('frontend/components/comment_card.html', takes_context=False)
def render_comment_card(comment=None, author_name=None, text=None, created_at=None, profile_pic=None):
    if comment is None:
        comment = {}
    elif not isinstance(comment, dict):
        comment = {}
    
    author_name = author_name or comment.get('author_name', comment.get('author', comment.get('name', 'Anonymous')))
    created_at = created_at or comment.get('created_at', comment.get('timestamp', ''))
    text = text or comment.get('text', comment.get('body', comment.get('content', comment.get('message', ''))))
    profile_pic = profile_pic or comment.get('profile_pic', comment.get('avatar_url', ''))

    name_parts = author_name.strip().split()
    if len(name_parts) >= 2:
        initials = name_parts[0][0] + name_parts[-1][0]
    elif author_name:
        initials = author_name[:2]
    else:
        initials = '?'
    initials = initials.upper()

    return {
        'comment': {
            'author_name': author_name,
            'created_at': created_at,
            'time_ago': _time_ago_value(created_at),
            'text': text,
            'profile_pic': profile_pic,
            'author_initials': initials,
        }
    }

def _time_ago_value(date_string):
    from datetime import datetime
    import re
    if not date_string:
        return ''
    try:
        if isinstance(date_string, str):
            cleaned = re.sub(r'([+-]\d{2}):(\d{2})$', r'\1\2', date_string)
            dt = datetime.fromisoformat(cleaned)
        else:
            dt = date_string
    except Exception:
        return date_string

    now = datetime.now(dt.tzinfo) if dt.tzinfo else datetime.now()
    diff = now - dt
    seconds = int(diff.total_seconds())
    if seconds < 0:
        seconds = -seconds

    intervals = (
        (31536000, 'year'),
        (2592000, 'month'),
        (604800, 'week'),
        (86400, 'day'),
        (3600, 'hour'),
        (60, 'minute'),
        (1, 'second'),
    )
    for divisor, label in intervals:
        count = seconds // divisor
        if count >= 1:
            return f"{count} {label}{'s' if count > 1 else ''} ago"
    return 'Just now'
