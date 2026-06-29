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
            const user = await window.NewsPortalSession.fetchCurrentUser();
            const displayName = window.NewsPortalSession.displayName(user) || user.username || 'Staff Member';
            const role = roleLabel(user);
            const isActive = user.is_active === false ? 'Inactive' : 'Active';

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

            const [articlesResponse, commentsResponse, adsResponse] = await Promise.all([
                Utils.loadAllPages((page, options) => ArticleService.loadArticles(page, {
                    ...options,
                    params: {
                        ...(options.params || {}),
                        ordering: '-id'
                    }
                })),
                Utils.loadAllPages((page, options) => CommentService.loadComments(page, {
                    ...options,
                    params: {
                        ...(options.params || {}),
                        ordering: '-id'
                    }
                })),
                Utils.loadAllPages((page, options) => AdService.loadAdvertisements(page, {
                    ...options,
                    params: {
                        ...(options.params || {}),
                        ordering: '-id'
                    }
                }))
            ]);

            const ownArticles = articlesResponse.data.results.filter((article) => ArticleService.articleMatchesUser(article, user));
            const ownComments = commentsResponse.data.results.filter((comment) => CommentService.commentMatchesUser(comment, user));

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
