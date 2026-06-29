(function () {
    const Api = window.NewsPortalApi;
    const ArticleService = window.NewsPortalArticleService;
    const CommentService = window.NewsPortalCommentService;
    const AdService = window.NewsPortalAdvertisementService;
    const Utils = window.StaffUtils;

    const els = {
        refresh: document.getElementById('refreshDashboardBtn'),
        totalArticles: document.getElementById('totalArticles'),
        publishedArticles: document.getElementById('publishedArticles'),
        draftArticles: document.getElementById('draftArticles'),
        totalAds: document.getElementById('totalAds'),
        activeAds: document.getElementById('activeAds'),
        totalComments: document.getElementById('totalComments'),
        recentArticles: document.getElementById('recentArticlesBody'),
        recentComments: document.getElementById('recentCommentsBody')
    };

    let cachedUser = null;
    const hasAuth = Boolean(window.NewsPortalAuth?.hasStoredAuthToken?.());

    function renderEmpty(tbody, colspan, message) {
        Utils.setTableMessage(tbody, colspan, message);
    }

    function renderRecentArticles(items) {
        if (!items.length) {
            renderEmpty(els.recentArticles, 4, 'No articles found for your account.');
            return;
        }

        els.recentArticles.innerHTML = items.map((article) => `
            <tr>
                <td>
                    <div class="primary-cell">
                        <strong>${Api.escapeHtml(article.title)}</strong>
                        <span>${Api.escapeHtml(article.subtitle || article.content || 'No summary added')}</span>
                    </div>
                </td>
                <td><span class="pill pill-blue">${Api.escapeHtml(article.category_label || 'Uncategorized')}</span></td>
                <td><span class="pill ${article.status === 'published' ? 'pill-green' : 'pill-orange'}">${Api.escapeHtml(article.status)}</span></td>
                <td class="article-meta-muted">${Api.escapeHtml(Api.formatDate(article.publish_date || article.updated_at || article.created_at))}</td>
            </tr>
        `).join('');
    }

    function renderRecentComments(items) {
        if (!items.length) {
            renderEmpty(els.recentComments, 4, 'No comments found on your articles.');
            return;
        }

        els.recentComments.innerHTML = items.map((comment) => `
            <tr>
                <td>
                    <div class="primary-cell">
                        <strong>${Api.escapeHtml(comment.text || 'No comment text')}</strong>
                        <span>By ${Api.escapeHtml(comment.author_name || 'Anonymous')}</span>
                    </div>
                </td>
                <td>${Api.escapeHtml(comment.article_title || 'Untitled article')}</td>
                <td><span class="pill ${comment.is_approved || comment.status === 'approved' ? 'pill-green' : comment.status === 'rejected' ? 'pill-red' : 'pill-orange'}">${Api.escapeHtml(comment.status || 'pending')}</span></td>
                <td class="article-meta-muted">${Api.escapeHtml(Api.formatDate(comment.created_at || comment.updated_at))}</td>
            </tr>
        `).join('');
    }

    async function loadDashboard() {
        renderEmpty(els.recentArticles, 4, 'Loading recent articles...');
        renderEmpty(els.recentComments, 4, 'Loading recent comments...');

        try {
            if (hasAuth) {
                try {
                    cachedUser = await window.NewsPortalSession.fetchCurrentUser();
                } catch {
                    cachedUser = null;
                }
            } else {
                cachedUser = null;
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

            const ownArticles = Utils.sortByNewest(cachedUser
                ? articlesResponse.data.results.filter((article) => ArticleService.articleMatchesUser(article, cachedUser))
                : articlesResponse.data.results);
            const ownComments = Utils.sortByNewest(cachedUser
                ? commentsResponse.data.results.filter((comment) => CommentService.commentMatchesUser(comment, cachedUser))
                : commentsResponse.data.results, ['created_at', 'updated_at']);
            const activeAds = adsResponse.data.results.filter((ad) => AdService.isActiveAdvertisement(ad));

            els.totalArticles.textContent = ownArticles.length;
            els.publishedArticles.textContent = ownArticles.filter((article) => article.status === 'published').length;
            els.draftArticles.textContent = ownArticles.filter((article) => article.status !== 'published').length;
            els.totalAds.textContent = adsResponse.data.results.length;
            els.activeAds.textContent = activeAds.length;
            els.totalComments.textContent = ownComments.length;

            renderRecentArticles(ownArticles.slice(0, 5));
            renderRecentComments(ownComments.slice(0, 5));
        } catch (error) {
            console.error('Unable to load staff dashboard:', error);
            renderEmpty(els.recentArticles, 4, 'Unable to load your articles right now.');
            renderEmpty(els.recentComments, 4, 'Unable to load your comments right now.');
        }
    }

    els.refresh.addEventListener('click', loadDashboard);

    document.addEventListener('DOMContentLoaded', loadDashboard);
})();
