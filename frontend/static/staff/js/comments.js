(function () {
    const Api = window.NewsPortalApi;
    const CommentService = window.NewsPortalCommentService;
    const Utils = window.StaffUtils;

    const state = {
        user: null,
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

    function statusClass(status) {
        if (status === 'approved') {
            return 'pill-green';
        }

        if (status === 'rejected') {
            return 'pill-red';
        }

        return 'pill-orange';
    }

    function renderSummary(items) {
        els.total.textContent = items.length;
        els.approved.textContent = items.filter((comment) => comment.is_approved || comment.status === 'approved').length;
        els.pending.textContent = items.filter((comment) => !comment.is_approved && comment.status !== 'rejected').length;
        els.rejected.textContent = items.filter((comment) => comment.status === 'rejected').length;
    }

    function renderComments() {
        const query = els.search.value.trim().toLowerCase();
        const filtered = state.comments.filter((comment) => [
            comment.author_name,
            comment.article_title,
            comment.text,
            comment.status
        ].join(' ').toLowerCase().includes(query));

        els.visible.textContent = `${filtered.length} comment${filtered.length === 1 ? '' : 's'} shown`;

        if (!filtered.length) {
            Utils.setTableMessage(els.tbody, 6, query ? 'No comments match your search.' : 'No comments found for your articles.');
            return;
        }

        els.tbody.innerHTML = filtered.map((comment) => `
            <tr>
                <td>
                    <div class="primary-cell">
                        <strong>${Api.escapeHtml(comment.author_name || 'Anonymous')}</strong>
                        <span>${Api.escapeHtml(comment.author_email || 'No email provided')}</span>
                    </div>
                </td>
                <td>${Api.escapeHtml(comment.article_title || 'Untitled article')}</td>
                <td>
                    <div class="primary-cell">
                        <strong>${Api.escapeHtml(comment.text || 'No comment text')}</strong>
                    </div>
                </td>
                <td><span class="pill ${statusClass(comment.status)}">${Api.escapeHtml(comment.status || 'pending')}</span></td>
                <td class="article-meta-muted">${Api.escapeHtml(Api.formatDate(comment.created_at || comment.updated_at))}</td>
                <td>
                    <div class="row-actions">
                        <button type="button" data-action="approve" data-id="${Api.escapeHtml(comment.id)}" title="Approve comment" aria-label="Approve comment">
                            <i class="fa-solid fa-check"></i>
                        </button>
                        <button type="button" data-action="reject" data-id="${Api.escapeHtml(comment.id)}" title="Reject comment" aria-label="Reject comment">
                            <i class="fa-solid fa-xmark"></i>
                        </button>
                        <button class="danger-action" type="button" data-action="delete" data-id="${Api.escapeHtml(comment.id)}" title="Delete comment" aria-label="Delete comment">
                            <i class="fa-regular fa-trash-can"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    }

    async function loadComments() {
        Utils.setTableMessage(els.tbody, 6, 'Loading comments...');

        try {
            if (hasAuth) {
                try {
                    state.user = await window.NewsPortalSession.fetchCurrentUser();
                } catch {
                    state.user = null;
                }
            } else {
                state.user = null;
            }

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

            state.comments = Utils.sortByNewest(state.user ? result.data.results.filter((comment) => CommentService.commentMatchesUser(comment, state.user)) : result.data.results, ['created_at', 'updated_at']);
            renderSummary(state.comments);
            renderComments();
        } catch (error) {
            console.error('Unable to load comments:', error);
            Utils.setTableMessage(els.tbody, 6, 'Unable to load comments. Please check the API token or try again.');
            state.comments = [];
            renderSummary([]);
        }
    }

    async function moderateComment(comment, status) {
        try {
            if (status === 'approved') {
                await CommentService.approveComment(comment.id);
            } else if (status === 'rejected') {
                await CommentService.rejectComment(comment.id);
            }

            Api.notifyDataChanged?.('comments', { action: status, id: comment.id });
            await loadComments();
        } catch (error) {
            console.error('Unable to moderate comment:', error);
            window.alert('Unable to update this comment right now.');
        }
    }

    async function deleteComment(comment) {
        if (!window.confirm('Delete this comment? This cannot be undone.')) {
            return;
        }

        try {
            await CommentService.deleteComment(comment.id);
            Api.notifyDataChanged?.('comments', { action: 'delete', id: comment.id });
            await loadComments();
        } catch (error) {
            console.error('Unable to delete comment:', error);
            window.alert('Unable to delete this comment right now.');
        }
    }

    els.tbody.addEventListener('click', (event) => {
        const button = event.target.closest('button[data-action]');

        if (!button) {
            return;
        }

        const comment = state.comments.find((item) => String(item.id) === String(button.dataset.id));

        if (!comment) {
            return;
        }

        if (button.dataset.action === 'approve') {
            moderateComment(comment, 'approved');
        }

        if (button.dataset.action === 'reject') {
            moderateComment(comment, 'rejected');
        }

        if (button.dataset.action === 'delete') {
            deleteComment(comment);
        }
    });

    els.refresh.addEventListener('click', loadComments);
    els.search.addEventListener('input', renderComments);

    document.addEventListener('DOMContentLoaded', loadComments);
    window.addEventListener('pageshow', loadComments);
    Api.onDataChanged?.((event) => {
        if (event?.type === 'comments' || event?.type === 'articles') {
            loadComments();
        }
    });
})();
