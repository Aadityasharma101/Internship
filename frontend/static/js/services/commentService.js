(function (window) {
    const Api = window.NewsPortalApi;
    const LIST_ENDPOINTS = ['/comments/', '/articles/comments/'];

    function normalizeComment(comment) {
        const status = String(Api.getValue(comment, ['status', 'state'], Api.getValue(comment, ['is_approved'], false) ? 'approved' : 'pending')).toLowerCase();

        return {
            ...comment,
            status,
            text: Api.getValue(comment, ['text', 'body', 'content', 'comment'], ''),
            author_name: Api.getValue(comment, ['author_name', 'user_name', 'user.username', 'author.username', 'email'], 'Anonymous'),
            author_email: Api.getValue(comment, ['user.email', 'author.email', 'email'], ''),
            article_id: Api.getValue(comment, ['article.id', 'article_id'], ''),
            article_title: Api.getValue(comment, ['article.title', 'article_title'], 'Untitled article'),
            article_author_id: Api.getValue(comment, ['article.author.id', 'article.user.id', 'article.created_by.id'], ''),
            article_author_username: Api.getValue(comment, ['article.author.username', 'article.user.username', 'article.created_by.username'], ''),
            article_author_email: Api.getValue(comment, ['article.author.email', 'article.user.email', 'article.created_by.email'], ''),
            is_approved: status === 'approved'
        };
    }

    function commentMatchesUser(comment, user) {
        if (!user) {
            return true;
        }

        const articleAuthorValues = [
            comment.article_author_id,
            comment.article_author_username,
            comment.article_author_email
        ].filter(Boolean).map((value) => String(value).toLowerCase());

        const userValues = [user.id, user.username, user.email].filter(Boolean).map((value) => String(value).toLowerCase());

        return userValues.some((candidate) => articleAuthorValues.includes(candidate));
    }

    function summarizeComments(comments) {
        const items = Array.isArray(comments) ? comments : [];

        return {
            total: items.length,
            pending: items.filter((comment) => !comment.is_approved && comment.status !== 'approved').length,
            approved: items.filter((comment) => comment.is_approved || comment.status === 'approved').length,
            recent: items.slice().sort((left, right) => new Date(right.created_at || right.updated_at || 0) - new Date(left.created_at || left.updated_at || 0))
        };
    }

    async function loadComments(page = 1, options = {}) {
        const result = await Api.loadList(LIST_ENDPOINTS, page, options);
        return {
            endpoint: result.endpoint,
            data: {
                ...result.data,
                results: result.data.results.map(normalizeComment)
            }
        };
    }

    async function updateCommentStatus(id, status, options = {}) {
        const payload = {
            status,
            is_approved: status === 'approved',
            approved: status === 'approved',
            rejected: status === 'rejected'
        };

        const bases = ['/comments/', '/articles/comments/'];

        return Api.firstSuccessful(bases.map((base) => `${base}${id}/`), async (endpoint) => {
            try {
                return await Api.request('PATCH', endpoint, {
                    ...options,
                    data: payload
                });
            } catch (error) {
                if (error?.response?.status === 405) {
                    return Api.request('PUT', endpoint, {
                        ...options,
                        data: payload
                    });
                }

                throw error;
            }
        });
    }

    async function approveComment(id, options = {}) {
        return updateCommentStatus(id, 'approved', options);
    }

    async function rejectComment(id, options = {}) {
        return updateCommentStatus(id, 'rejected', options);
    }

    async function deleteComment(id, options = {}) {
        return Api.firstSuccessful([`/comments/${id}/`, `/articles/comments/${id}/`], (endpoint) => Api.request('DELETE', endpoint, options));
    }

    window.NewsPortalCommentService = {
        approveComment,
        commentMatchesUser,
        deleteComment,
        loadComments,
        normalizeComment,
        rejectComment,
        summarizeComments,
        updateCommentStatus
    };
})(window);
