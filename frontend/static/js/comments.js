function timeAgo(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);

    const intervals = [
        { label: 'year', seconds: 31536000 },
        { label: 'month', seconds: 2592000 },
        { label: 'week', seconds: 604800 },
        { label: 'day', seconds: 86400 },
        { label: 'hour', seconds: 3600 },
        { label: 'minute', seconds: 60 },
        { label: 'second', seconds: 1 },
    ];

    for (const interval of intervals) {
        const count = Math.floor(seconds / interval.seconds);
        if (count >= 1) {
            return `${count} ${interval.label}${count > 1 ? 's' : ''} ago`;
        }
    }

    return 'Just now';
}

function getInitials(name) {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
}

function displayCommentAuthor(comment) {
    const suppliedName = comment.author_name || comment.user_name || comment.username || comment.author || '';
    if (suppliedName) return suppliedName;

    // The comments API currently returns the commenter in `user` as an email.
    // Present its local part as a username instead of exposing the email address.
    const user = String(comment.user || '').trim();
    if (user.includes('@')) {
        return user.split('@')[0]
            .replace(/[._-]+/g, ' ')
            .replace(/\b\w/g, letter => letter.toUpperCase()) || 'Anonymous';
    }

    return user || 'Anonymous';
}

function commentUserEmail(comment) {
    const user = comment?.user || comment?.author || comment?.author_email || '';
    return String(typeof user === 'object' ? (user.email || '') : user).trim().toLowerCase();
}

function isOwnComment(comment) {
    const currentUser = window.NewsPortalSession?.getKnownUser?.();
    const currentEmail = String(currentUser?.email || '').trim().toLowerCase();
    return Boolean(currentEmail && currentEmail === commentUserEmail(comment));
}

const renderedComments = new Map();

function renderCommentCard(comment) {
    const profilePic = comment.profile_pic || comment.author_profile_pic || '';
    const authorName = displayCommentAuthor(comment);
    const createdAt = comment.created_at || '';
    const text = comment.text || comment.body || comment.content || comment.comment || '';
    const controls = isOwnComment(comment) && comment.id != null ? `
        <div class="comment-menu" data-comment-menu>
            <button type="button" class="comment-menu-trigger" data-comment-menu-trigger aria-label="Comment options" aria-haspopup="true" aria-expanded="false">⋮</button>
            <div class="comment-menu-popover" data-comment-menu-popover hidden>
                <button type="button" class="comment-menu-item" data-comment-action="edit" data-comment-id="${escapeHtml(comment.id)}">Edit</button>
                <button type="button" class="comment-menu-item comment-menu-item--delete" data-comment-action="delete" data-comment-id="${escapeHtml(comment.id)}">Delete</button>
            </div>
        </div>` : '';

    return `
        <div class="comment-card">
            <div class="comment-avatar">
                ${profilePic
                    ? `<img src="${profilePic}" alt="${escapeHtml(authorName)} avatar" loading="lazy">`
                    : `<span class="comment-avatar-placeholder">${escapeHtml(getInitials(authorName))}</span>`
                }
            </div>
            <div class="comment-body">
                <div class="comment-header">
                    <span class="comment-author">${escapeHtml(authorName)}</span>
                    <time class="comment-time" datetime="${escapeHtml(createdAt)}" title="${escapeHtml(createdAt)}">
                        ${escapeHtml(timeAgo(createdAt))}
                    </time>
                </div>
                <p class="comment-text" id="comment-text-${escapeHtml(comment.id || '')}">${escapeHtml(text)}</p>
            </div>
            ${controls}
        </div>
    `;
}

function renderComments(comments, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const items = Array.isArray(comments) ? comments : [];
    renderedComments.clear();
    items.forEach(comment => {
        if (comment?.id != null) renderedComments.set(String(comment.id), comment);
    });
    const count = items.length;
    const header = container.closest('.comments-section')?.querySelector('.comments-header');
    if (header) {
        header.textContent = `Comments (${count})`;
    }

    if (items.length === 0) {
        container.innerHTML = `
            <div class="comments-list">
                <p class="comments-empty">No comments yet. Be the first to comment!</p>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <div class="comments-list">
            ${items.map(renderCommentCard).join('')}
        </div>
    `;
}

function getRenderedComment(commentId) {
    return renderedComments.get(String(commentId));
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
