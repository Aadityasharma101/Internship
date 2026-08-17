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
        recentComments: document.getElementById('recentCommentsBody'),
        recentAds: document.getElementById('recentAdsBody')
    };

    let cachedUser = null;
    const hasAuth = Boolean(window.NewsPortalAuth?.hasStoredAuthToken?.());
    const state = {
        articles: [],
        ads: []
    };

    function renderEmpty(tbody, colspan, message) {
        Utils.setTableMessage(tbody, colspan, message);
    }

    function renderRecentArticles(items) {
        if (!els.recentArticles) {
            return;
        }

        if (!items.length) {
            renderEmpty(els.recentArticles, 5, 'No articles found for your account.');
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
                <td>
                    <div class="row-actions">
                        <a href="/staff/articles/?edit=${Api.escapeHtml(article.id)}" title="Edit article" aria-label="Edit article">
                            <i class="fa-regular fa-pen-to-square"></i>
                        </a>
                        <button class="danger-action" type="button" data-dashboard-action="delete-article" data-id="${Api.escapeHtml(article.id)}" title="Delete article" aria-label="Delete article">
                            <i class="fa-regular fa-trash-can"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    }

    function renderRecentComments(items) {
        if (!els.recentComments) {
            return;
        }

        if (!items.length) {
            renderEmpty(els.recentComments, 4, 'No comments found.');
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

    function renderRecentAds(items) {
        if (!els.recentAds) return;

        if (!items.length) {
            Utils.setTableMessage(els.recentAds, 5, 'No advertisements found.');
            return;
        }

        els.recentAds.innerHTML = items.map((ad) => `
            <tr>
                <td>
                    <div class="primary-cell">
                        <strong>${Api.escapeHtml(ad.title || ad.name || 'Untitled')}</strong>
                        <span>${Api.escapeHtml(ad.description || ad.client_name || '')}</span>
                    </div>
                </td>
                <td><span class="pill pill-blue">${Api.escapeHtml(ad.position_label || ad.position || 'Between Articles')}</span></td>
                <td><span class="pill ${AdService.isActiveAdvertisement(ad) ? 'pill-green' : 'pill-orange'}">${Api.escapeHtml(ad.status || (ad.is_active ? 'active' : 'inactive'))}</span></td>
                <td class="article-meta-muted">${Api.escapeHtml(Api.formatDate(ad.start_date) || '')} — ${Api.escapeHtml(Api.formatDate(ad.end_date) || 'ongoing')}</td>
                <td>
                    <div class="row-actions">
                        <a href="/staff/advertisements/?edit=${Api.escapeHtml(ad.id)}" title="Edit advertisement" aria-label="Edit advertisement">
                            <i class="fa-regular fa-pen-to-square"></i>
                        </a>
                        <button class="danger-action" type="button" data-dashboard-action="delete-ad" data-id="${Api.escapeHtml(ad.id)}" title="Delete advertisement" aria-label="Delete advertisement">
                            <i class="fa-regular fa-trash-can"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    }

    function findArticle(id) {
        return state.articles.find((item) => String(item.id) === String(id));
    }

    function findAd(id) {
        return state.ads.find((item) => String(item.id) === String(id));
    }

    async function deleteDashboardArticle(article) {
        if (!article || !window.confirm(`Delete "${article.title || 'this article'}"? This cannot be undone.`)) {
            return;
        }

        try {
            await ArticleService.deleteArticle(article.id, { auth: true });
            Api.notifyDataChanged?.('articles', { action: 'delete', id: article.id });
            await loadDashboard();
        } catch (error) {
            console.error('Unable to delete article from dashboard:', error);
            window.alert('Unable to delete this article. Check your permissions and try again.');
        }
    }

    async function deleteDashboardAd(ad) {
        if (!ad || !window.confirm(`Delete "${ad.title || 'this advertisement'}"? This cannot be undone.`)) {
            return;
        }

        try {
            await AdService.deleteAdvertisement(ad.id);
            Api.notifyDataChanged?.('advertisements', { action: 'delete', id: ad.id });
            await loadDashboard();
        } catch (error) {
            console.error('Unable to delete advertisement from dashboard:', error);
            window.alert('Unable to delete this advertisement. Check your permissions and try again.');
        }
    }

    async function loadDashboard() {
        renderEmpty(els.recentArticles, 4, 'Loading recent articles...');
        renderEmpty(els.recentComments, 4, 'Loading recent comments...');
        if (els.recentAds) Utils.setTableMessage(els.recentAds, 4, 'Loading recent advertisements...');

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
            const articleRequestOptions = {
                auth: false,
                params: {
                    ordering: '-id'
                }
            };

            const [articlesResponse, commentsResponse, adsResponse] = await Promise.all([
                Utils.loadAllPages((page, options) => ArticleService.loadArticles(page, {
                    ...articleRequestOptions,
                    ...options,
                    params: {
                        ...(articleRequestOptions.params || {}),
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

            // Debug: inspect ads payload returned for dashboard
            try {
                console.debug('staff dashboard: adsResponse', adsResponse);
            } catch (e) { /* ignore */ }

            const ownArticles = Utils.sortByNewest(articlesResponse.data.results);
            const allComments = Utils.sortByNewest(commentsResponse.data.results, ['created_at', 'updated_at']);
            const activeAds = adsResponse.data.results.filter((ad) => AdService.isActiveAdvertisement(ad));

            els.totalArticles.textContent = ownArticles.length;
            els.publishedArticles.textContent = ownArticles.filter((article) => article.status === 'published').length;
            els.draftArticles.textContent = ownArticles.filter((article) => article.status !== 'published').length;
            els.totalAds.textContent = adsResponse.data.results.length;
            els.activeAds.textContent = activeAds.length;
            els.totalComments.textContent = allComments.length;

            renderRecentArticles(ownArticles.slice(0, 5));
            renderRecentComments(allComments.slice(0, 5));
            renderRecentAds(adsResponse.data.results.slice(0, 5));
        } catch (error) {
            console.error('Unable to load staff dashboard:', error);
            renderEmpty(els.recentArticles, 4, 'Unable to load your articles right now.');
            renderEmpty(els.recentComments, 4, 'Unable to load your comments right now.');
        }
    }

    els.refresh.addEventListener('click', loadDashboard);

    document.addEventListener('DOMContentLoaded', loadDashboard);
    window.addEventListener('pageshow', loadDashboard);
    Api.onDataChanged?.((event) => {
        if (['articles', 'advertisements', 'comments'].includes(event?.type)) {
            loadDashboard();
        }
    });
})();
