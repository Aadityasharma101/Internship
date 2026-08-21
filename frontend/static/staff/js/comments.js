(function () {
    const Api = window.NewsPortalApi;
    const CommentService = window.NewsPortalCommentService;
    const Utils = window.StaffUtils;
    const TABLE_COLSPAN = 6;

    if (!Api || !CommentService || !Utils) {
        return;
    }

    const state = {
        comments: []
    };

    const hasAuth = Boolean(window.NewsPortalAuth?.hasStoredAuthToken?.());

    const els = {
        tbody: document.getElementById('commentsTableBody'),
        refresh: document.getElementById('refreshCommentsBtn'),
        search: document.getElementById('commentSearchInput'),
        visible: document.getElementById('visibleCommentsCount'),
        total: document.getElementById('totalComments'),
        approved: document.getElementById('approvedComments'),
        pending: document.getElementById('pendingComments'),
        rejected: document.getElementById('rejectedComments')
    };

    function isVisible(comment) {
        const status = String(comment.status || '').toLowerCase();
        return comment.is_approved || status === 'approved' || status === 'visible';
    }

    function isRejected(comment) {
        return String(comment.status || '').toLowerCase() === 'rejected';
    }

    function statusClass(status) {
        const key = String(status || '').toLowerCase();

        if (key === 'approved' || key === 'visible') {
            return 'pill-green';
        }

        if (key === 'rejected') {
            return 'pill-red';
        }

        return 'pill-orange';
    }

    function setText(element, value) {
        if (element) {
            element.textContent = String(value);
        }
    }

    function renderSummary(items) {
        const visible = items.filter(isVisible).length;
        const rejected = items.filter(isRejected).length;
        const pending = items.length - visible - rejected;

        setText(els.total, items.length);
        setText(els.approved, visible);
        setText(els.pending, Math.max(0, pending));
        setText(els.rejected, rejected);
    }

    function articleLink(comment) {
        const articleId = Api.getValue(comment, ['article_id', 'article.id'], '');

        if (!articleId) {
            return '';
        }

        return `/news/${encodeURIComponent(articleId)}/`;
    }

    function renderArticleCell(comment) {
        const href = articleLink(comment);
        const title = comment.article_title || 'Untitled article';
        const articleId = Api.getValue(comment, ['article_id', 'article.id'], '');

        if (!href) {
            return `
                <div class="primary-cell">
                    <strong>${Api.escapeHtml(title)}</strong>
                    <span>No article link available</span>
                </div>
            `;
        }

        return `
            <div class="primary-cell">
                <strong><a href="${Api.escapeHtml(href)}">${Api.escapeHtml(title)}</a></strong>
                <span>Article #${Api.escapeHtml(articleId)}</span>
            </div>
        `;
    }

    function renderAction(comment) {
        const href = articleLink(comment);

        if (!href) {
            return '<span class="article-meta-muted">No link</span>';
        }

        return `
            <div class="row-actions">
                <a href="${Api.escapeHtml(href)}" title="View article and comments" aria-label="View article and comments">
                    <i class="fa-regular fa-eye"></i>
                </a>
            </div>
        `;
    }

    function renderComments() {
        if (!els.tbody) {
            return;
        }

        const query = (els.search?.value || '').trim().toLowerCase();
        const filtered = state.comments.filter((comment) => [
            comment.author_name,
            comment.author_email,
            comment.article_title,
            comment.text,
            comment.status,
            comment.article_id
        ].join(' ').toLowerCase().includes(query));

        setText(els.visible, `${filtered.length} comment${filtered.length === 1 ? '' : 's'} shown`);

        if (!filtered.length) {
            Utils.setTableMessage(els.tbody, TABLE_COLSPAN, query ? 'No comments match your search.' : 'No comments found.');
            return;
        }

        els.tbody.innerHTML = filtered.map((comment) => {
            const status = comment.status || 'visible';

            return `
                <tr>
                    <td>
                        <div class="primary-cell">
                            <strong>${Api.escapeHtml(comment.text || 'No comment text')}</strong>
                            <span>${Api.escapeHtml(comment.replies?.length ? `${comment.replies.length} replies` : 'User comment')}</span>
                        </div>
                    </td>
                    <td>${renderArticleCell(comment)}</td>
                    <td>
                        <div class="primary-cell">
                            <strong>${Api.escapeHtml(comment.author_name || 'Anonymous')}</strong>
                            <span>${Api.escapeHtml(comment.author_email || 'No email provided')}</span>
                        </div>
                    </td>
                    <td><span class="pill ${statusClass(status)}">${Api.escapeHtml(status)}</span></td>
                    <td class="article-meta-muted">${Api.escapeHtml(Api.formatDate(comment.created_at || comment.updated_at))}</td>
                    <td>${renderAction(comment)}</td>
                </tr>
            `;
        }).join('');
    }

    async function loadComments() {
        if (!els.tbody) {
            return;
        }

        Utils.setTableMessage(els.tbody, TABLE_COLSPAN, 'Loading comments...');

        try {
            const requestOptions = hasAuth ? {
                params: {
                    ordering: '-id'
                }
            } : {
                auth: false,
                params: {
                    ordering: '-id'
                }
            };

            const result = await Utils.loadAllPages((page, options) => CommentService.loadComments(page, {
                ...requestOptions,
                ...options,
                params: {
                    ...(requestOptions.params || {}),
                    ...(options.params || {})
                }
            }));

            state.comments = Utils.sortByNewest(result.data.results, ['created_at', 'updated_at']);
            renderSummary(state.comments);
            renderComments();
        } catch (error) {
            console.error('Unable to load comments:', error);
            state.comments = [];
            renderSummary([]);
            Utils.setTableMessage(els.tbody, TABLE_COLSPAN, 'Unable to load comments right now.');
        }
    }

    els.refresh?.addEventListener('click', loadComments);
    els.search?.addEventListener('input', renderComments);

    document.addEventListener('DOMContentLoaded', loadComments);
    Api.onDataChanged?.((event) => {
        if (event?.type === 'comments' || event?.type === 'articles') {
            loadComments();
        }
    });
})();
