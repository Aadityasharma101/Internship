(function () {
    const Api = window.NewsPortalApi;
    const Utils = window.StaffUtils;

    if (!Api || !Utils) {
        return;
    }

    function getApiBase() {
        let base = window.NEWS_PORTAL_API_BASE || document.body?.dataset?.apiBase || 'https://news-portal-hvgs.onrender.com/api';
        base = String(base).replace(/\/+$/, '');

        if (!/\/api(\/|$)/i.test(base)) {
            base = `${base}/api`;
        }

        return base;
    }

    const ARTICLE_API_BASE = `${getApiBase().replace(/\/+$/, '')}/articles`;
    const CATEGORY_ENDPOINTS = [`${ARTICLE_API_BASE}/categories/`];
    const PUBLIC_ARTICLE_ENDPOINTS = [`${ARTICLE_API_BASE}/feed/`, `${ARTICLE_API_BASE}/`];
    const STAFF_ARTICLE_ENDPOINTS = [
        `${ARTICLE_API_BASE}/reporter/articles/`,
        `${ARTICLE_API_BASE}/drafts/`,
        `${ARTICLE_API_BASE}/pending/`
    ];
    const MAX_PAGES = 25;
    const TABLE_COLSPAN = 6;

    const state = {
        categories: [],
        articles: [],
        counts: new Map()
    };

    const els = {
        tbody: document.getElementById('categoriesTableBody'),
        refresh: document.getElementById('refreshCategoriesBtn'),
        search: document.getElementById('categorySearchInput'),
        visible: document.getElementById('visibleCategoriesCount'),
        total: document.getElementById('totalCategories'),
        linked: document.getElementById('linkedArticles'),
        empty: document.getElementById('emptyCategories'),
        top: document.getElementById('topCategory'),
        prev: document.getElementById('prevCategoryBtn'),
        next: document.getElementById('nextCategoryBtn'),
        pageInfo: document.getElementById('categoryPageInfo')
    };

    function hasAuth() {
        return Boolean(
            window.NewsPortalAuth?.hasStoredAuthToken?.()
            || window.NewsPortalSession?.getStoredAccessToken?.()
            || window.NewsPortalSession?.getStoredRefreshToken?.()
        );
    }

    function normalize(value, fallback = 'Not available') {
        return value === null || value === undefined || value === '' ? fallback : String(value);
    }

    function normalizeToken(value) {
        return String(value ?? '').trim().toLowerCase();
    }

    function toBoolean(value) {
        if (typeof value === 'boolean') {
            return value;
        }

        if (typeof value === 'number') {
            return value > 0;
        }

        return ['1', 'true', 'yes', 'active', 'featured', 'enabled'].includes(normalizeToken(value));
    }

    function getCategoryName(category) {
        return normalize(Api.getValue(category, ['name', 'title', 'label', 'category_name']), 'Untitled category');
    }

    function getCategoryDescription(category) {
        return normalize(Api.getValue(category, ['description', 'summary', 'details', 'body']), 'No description added');
    }

    function getCategorySlug(category) {
        const fallback = getCategoryName(category)
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '');

        return normalize(Api.getValue(category, ['slug', 'code', 'key']), fallback || 'category');
    }

    function getCategoryStatus(category) {
        const activeValue = Api.getValue(category, ['is_active', 'active', 'enabled'], null);

        if (activeValue !== null) {
            return toBoolean(activeValue) ? 'Active' : 'Inactive';
        }

        return normalize(Api.getValue(category, ['status', 'state']), 'Active');
    }

    function getStatusClass(status) {
        const key = normalizeToken(status);

        if (key.includes('active') && !key.includes('inactive')) {
            return 'status-active';
        }

        if (key.includes('archive')) {
            return 'status-archived';
        }

        return 'status-inactive';
    }

    function isFeatured(category) {
        return toBoolean(Api.getValue(category, ['is_featured', 'featured', 'show_on_homepage', 'homepage'], false));
    }

    function getRemoteArticleCount(category) {
        const keys = ['article_count', 'articles_count', 'news_count', 'posts_count', 'total_articles', 'total_news', 'count'];

        for (const key of keys) {
            const value = Api.getValue(category, [key], null);

            if (value !== null) {
                const parsed = Number(value);

                if (Number.isFinite(parsed)) {
                    return parsed;
                }
            }
        }

        return 0;
    }

    function getCategoryKey(category) {
        return normalize(Api.getValue(category, ['id'], '') || getCategorySlug(category) || getCategoryName(category), '');
    }

    function uniqueTokens(values) {
        return [...new Set(values.map(normalizeToken).filter(Boolean))];
    }

    function getCategoryTokens(category) {
        return uniqueTokens([
            Api.getValue(category, ['id'], ''),
            getCategorySlug(category),
            getCategoryName(category),
            Api.getValue(category, ['code', 'key'], '')
        ]);
    }

    function getArticleCategoryTokens(article) {
        const category = article?.category;
        const values = [
            Api.getValue(article, ['category_id', 'categoryId'], ''),
            Api.getValue(article, ['category_slug', 'categorySlug'], ''),
            Api.getValue(article, ['category_name', 'categoryName'], ''),
            Api.getValue(article, ['category_label', 'categoryLabel'], ''),
            Api.getValue(article, ['category_title', 'categoryTitle'], '')
        ];

        if (category && typeof category === 'object') {
            values.push(category.id, category.slug, category.name, category.title, category.label, category.category_name);
        } else {
            values.push(category);
        }

        return uniqueTokens(values);
    }

    function articleMatchesCategory(article, category) {
        const categoryTokens = getCategoryTokens(category);
        const articleTokens = getArticleCategoryTokens(article);

        return categoryTokens.some((token) => articleTokens.includes(token));
    }

    function getArticleKey(article, index) {
        return normalize(Api.getValue(article, ['id', 'slug'], '') || `${Api.getValue(article, ['title'], '')}-${index}`, '');
    }

    function mergeArticles(...lists) {
        const byKey = new Map();

        lists.flat().forEach((article, index) => {
            if (!article || typeof article !== 'object') {
                return;
            }

            const key = getArticleKey(article, index);
            const existing = byKey.get(key);
            byKey.set(key, existing ? { ...existing, ...article } : article);
        });

        return [...byKey.values()].map((article) => (
            window.NewsPortalArticleService?.normalizeArticle
                ? window.NewsPortalArticleService.normalizeArticle(article)
                : article
        ));
    }

    function computeArticleCounts(categories, articles) {
        const counts = new Map();

        categories.forEach((category) => {
            const computed = articles.filter((article) => articleMatchesCategory(article, category)).length;
            counts.set(getCategoryKey(category), Math.max(getRemoteArticleCount(category), computed));
        });

        return counts;
    }

    function getArticleCount(category) {
        return state.counts.get(getCategoryKey(category)) || 0;
    }

    async function loadAllFromEndpoints(endpoints, options = {}) {
        const result = await Utils.loadAllPages((page, pageOptions) => Api.loadList(endpoints, page, {
            ...options,
            ...pageOptions,
            params: {
                ...(options.params || {}),
                ...(pageOptions.params || {})
            }
        }), {}, MAX_PAGES);

        return result?.data?.results || [];
    }

    async function loadAllFromEndpoint(endpoint, options = {}) {
        return loadAllFromEndpoints([endpoint], options);
    }

    async function hydrateCategoryDetails(categories) {
        const items = categories || [];

        return Promise.all(items.map(async (category) => {
            const id = Api.getValue(category, ['id'], '');

            if (!id) {
                return category;
            }

            try {
                const detail = await Api.request('GET', `${ARTICLE_API_BASE}/categories/${id}/`, {
                    auth: false,
                    timeoutMs: 10000
                });
                return detail && typeof detail === 'object' ? { ...category, ...detail } : category;
            } catch {
                return category;
            }
        }));
    }

    async function loadArticleRecords() {
        const publicRecords = await loadAllFromEndpoints(PUBLIC_ARTICLE_ENDPOINTS, {
            auth: false,
            params: {
                ordering: '-id'
            }
        }).catch((error) => {
            console.warn('Public article list unavailable for category counts.', error);
            return [];
        });

        const staffLists = [];

        if (hasAuth()) {
            for (const endpoint of STAFF_ARTICLE_ENDPOINTS) {
                try {
                    staffLists.push(await loadAllFromEndpoint(endpoint, {
                        auth: true,
                        params: {
                            ordering: '-id'
                        }
                    }));
                } catch (error) {
                    console.warn('Staff article endpoint unavailable for category counts:', endpoint, error);
                }
            }
        }

        return mergeArticles(publicRecords, ...staffLists);
    }

    function renderSummary(categories) {
        const total = categories.length;
        const enriched = categories.map((category) => ({
            category,
            count: getArticleCount(category)
        }));
        const linked = enriched.reduce((sum, item) => sum + item.count, 0);
        const empty = enriched.filter((item) => item.count === 0).length;
        const top = enriched.sort((left, right) => right.count - left.count)[0];

        if (els.total) {
            els.total.textContent = String(total);
        }

        if (els.linked) {
            els.linked.textContent = String(linked);
        }

        if (els.empty) {
            els.empty.textContent = String(empty);
        }

        if (els.top) {
            els.top.textContent = top && top.count > 0 ? `${getCategoryName(top.category)} (${top.count})` : 'None';
            els.top.title = els.top.textContent;
        }
    }

    function renderCategories(categories) {
        const query = normalizeToken(els.search?.value || '');
        const filtered = categories.filter((category) => [
            Api.getValue(category, ['id'], ''),
            getCategoryName(category),
            getCategoryDescription(category),
            getCategorySlug(category),
            getCategoryStatus(category),
            getArticleCount(category)
        ].join(' ').toLowerCase().includes(query));

        if (els.visible) {
            els.visible.textContent = `${filtered.length} categor${filtered.length === 1 ? 'y' : 'ies'} shown`;
        }

        if (!filtered.length) {
            Utils.setTableMessage(els.tbody, TABLE_COLSPAN, query ? 'No categories match your search.' : 'No categories found.');
            return;
        }

        els.tbody.innerHTML = filtered.map((category) => {
            const name = getCategoryName(category);
            const status = getCategoryStatus(category);
            const featured = isFeatured(category);
            const id = normalize(Api.getValue(category, ['id'], ''), 'Not available');

            return `
                <tr>
                    <td>
                        <div class="category-cell">
                            <span class="category-icon">${Api.escapeHtml(name.trim().charAt(0).toUpperCase() || 'C')}</span>
                            <div class="category-title-wrap">
                                <strong>${Api.escapeHtml(name)}</strong>
                                <span class="category-description">${Api.escapeHtml(getCategoryDescription(category))}</span>
                            </div>
                        </div>
                    </td>
                    <td><span class="slug-pill">${Api.escapeHtml(getCategorySlug(category))}</span></td>
                    <td class="category-meta-muted">${Api.escapeHtml(id)}</td>
                    <td class="category-meta-muted">${Api.escapeHtml(getArticleCount(category))}</td>
                    <td><span class="status-pill ${getStatusClass(status)}">${Api.escapeHtml(status)}</span></td>
                    <td><span class="feature-pill ${featured ? 'feature-yes' : 'feature-no'}">${featured ? 'Featured' : 'Standard'}</span></td>
                </tr>
            `;
        }).join('');
    }

    function updatePagination() {
        if (els.prev) {
            els.prev.disabled = true;
        }

        if (els.next) {
            els.next.disabled = true;
        }

        if (els.pageInfo) {
            els.pageInfo.textContent = 'All categories loaded';
        }
    }

    function setLoading(message) {
        Utils.setTableMessage(els.tbody, TABLE_COLSPAN, message);

        if (els.refresh) {
            els.refresh.disabled = true;
        }
    }

    function setLoaded() {
        if (els.refresh) {
            els.refresh.disabled = false;
        }
    }

    async function loadCategories() {
        setLoading('Loading categories...');

        try {
            const [categoryRecords, articleRecords] = await Promise.all([
                loadAllFromEndpoints(CATEGORY_ENDPOINTS, { auth: false }),
                loadArticleRecords()
            ]);

            state.categories = await hydrateCategoryDetails(categoryRecords);
            state.articles = articleRecords;
            state.counts = computeArticleCounts(state.categories, state.articles);

            renderSummary(state.categories);
            renderCategories(state.categories);
            updatePagination();
        } catch (error) {
            console.error('Unable to load staff categories:', error);
            state.categories = [];
            state.articles = [];
            state.counts = new Map();
            renderSummary([]);
            Utils.setTableMessage(els.tbody, TABLE_COLSPAN, 'Unable to load categories right now.');
            updatePagination();
        } finally {
            setLoaded();
        }
    }

    els.search?.addEventListener('input', () => renderCategories(state.categories));
    els.refresh?.addEventListener('click', loadCategories);
    document.addEventListener('DOMContentLoaded', loadCategories);
    Api.onDataChanged?.((event) => {
        if (event?.type === 'articles' || event?.type === 'categories') {
            loadCategories();
        }
    });
})();
