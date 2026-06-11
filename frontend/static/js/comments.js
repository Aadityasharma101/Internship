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

function renderCommentCard(comment) {
    const profilePic = comment.profile_pic || comment.author_profile_pic || '';
    const authorName = comment.author_name || comment.user_name || 'Anonymous';
    const createdAt = comment.created_at || '';
    const text = comment.text || comment.body || '';

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
                <p class="comment-text">${escapeHtml(text)}</p>
            </div>
        </div>
    `;
}

function renderComments(comments, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (!comments || comments.length === 0) {
        container.innerHTML = `
            <div class="comments-header">Comments (0)</div>
            <div class="comments-list">
                <p class="comments-empty">No comments yet. Be the first to comment!</p>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <div class="comments-header">Comments (${comments.length})</div>
        <div class="comments-list">
            ${comments.map(renderCommentCard).join('')}
        </div>
    `;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}