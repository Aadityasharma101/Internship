(function () {
    const Api = window.NewsPortalApi;
    const ArticleService = window.NewsPortalArticleService;
    const CommentService = window.NewsPortalCommentService;
    const AdService = window.NewsPortalAdvertisementService;
    const Utils = window.StaffUtils;

    const els = {
        avatar: document.getElementById('profileAvatar'),
        name: document.getElementById('profileName'),
        emailCopy: document.getElementById('profileEmailCopy'),
        username: document.getElementById('profileUsername'),
        email: document.getElementById('profileEmail'),
        role: document.getElementById('profileRole'),
        status: document.getElementById('profileStatus'),
        detailUsername: document.getElementById('detailUsername'),
        detailEmail: document.getElementById('detailEmail'),
        detailRole: document.getElementById('detailRole'),
        detailStatus: document.getElementById('detailStatus'),
        articleCount: document.getElementById('profileArticleCount'),
        commentCount: document.getElementById('profileCommentCount'),
        adCount: document.getElementById('profileAdCount')
    };

    function getInitials(value) {
        return Utils.getInitials(value || 'ST');
    }

    function roleLabel(user) {
        const raw = String(window.NewsPortalSession.roleName(user) || 'staff').replace(/[_-]+/g, ' ');
        return raw.replace(/\b\w/g, (char) => char.toUpperCase());
    }

    async function loadProfile() {
        try {
            const hasAuth = Boolean(window.NewsPortalAuth?.hasStoredAuthToken?.());
            const user = hasAuth ? await window.NewsPortalSession.fetchCurrentUser().catch(() => null) : null;
            const displayName = user ? (window.NewsPortalSession.displayName(user) || user.username || 'Staff Member') : 'Guest Visitor';
            const role = user ? roleLabel(user) : 'Guest';
            const isActive = user ? (user.is_active === false ? 'Inactive' : 'Active') : 'No Login';

            els.avatar.textContent = getInitials(displayName);
            els.name.textContent = displayName;
            els.emailCopy.textContent = user.email || 'No email provided';
            els.username.textContent = user.username || 'Not available';
            els.email.textContent = user.email || 'Not available';
            els.role.textContent = role;
            els.status.textContent = isActive;
            els.detailUsername.textContent = user.username || 'Not available';
            els.detailEmail.textContent = user.email || 'Not available';
            els.detailRole.textContent = role;
            els.detailStatus.textContent = isActive;

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

            const [articlesResponse, commentsResponse, adsResponse] = await Promise.all([
                Utils.loadAllPages((page, options) => ArticleService.loadArticles(page, {
                    ...requestOptions,
                    ...options,
                    params: {
                        ...(requestOptions.params || {}),
                        ...(options.params || {})
                    }
                })),
                Utils.loadAllPages((page, options) => CommentService.loadComments(page, {
                    ...requestOptions,
                    ...options,
                    params: {
                        ...(requestOptions.params || {}),
                        ...(options.params || {})
                    }
                })),
                Utils.loadAllPages((page, options) => AdService.loadAdvertisements(page, {
                    ...requestOptions,
                    ...options,
                    params: {
                        ...(requestOptions.params || {}),
                        ...(options.params || {})
                    }
                }))
            ]);

            const ownArticles = user ? articlesResponse.data.results.filter((article) => ArticleService.articleMatchesUser(article, user)) : articlesResponse.data.results;
            const ownComments = user ? commentsResponse.data.results.filter((comment) => CommentService.commentMatchesUser(comment, user)) : commentsResponse.data.results;

            els.articleCount.textContent = ownArticles.length;
            els.commentCount.textContent = ownComments.length;
            els.adCount.textContent = adsResponse.data.results.length;
        } catch (error) {
            console.error('Unable to load profile:', error);
            els.name.textContent = 'Unable to load profile';
            els.emailCopy.textContent = 'Please refresh or sign in again.';
        }
    }

    document.addEventListener('DOMContentLoaded', loadProfile);
})();
