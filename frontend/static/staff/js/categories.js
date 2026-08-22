(function () {
    const Api = window.NewsPortalApi;
    const Utils = window.StaffUtils;
    const ArticleService = window.NewsPortalArticleService;

    let remoteApiBase = window.NEWS_PORTAL_API_BASE || window.document?.body?.dataset?.apiBase || 'https://news-portal-hvgs.onrender.com/api';
    remoteApiBase = String(remoteApiBase).replace(/\/+$/, '');
    if (!/\/api(\/|$)/i.test(remoteApiBase)) {
        remoteApiBase = `${remoteApiBase}/api`;
    }

    const articleApiBase = `${remoteApiBase}/articles`;
    const categoryEndpoints = [`${articleApiBase}/categories/`, '/articles/categories/', '/api/articles/categories/'];
    const publicArticleEndpoints = [`${articleApiBase}/feed/`, `${articleApiBase}/`];
    const reporterArticleEndpoints = ['/api/articles/reporter/articles/', `${articleApiBase}/reporter/articles/`];

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
        totalCategories: document.getElementById('totalCategories'),
        totalArticles: document.getElementById('totalCategoryArticles'),
        linkedArticles: document.getElementById('linkedArticles'),
        emptyCategories: document.getElementById('emptyCategories')
    };

    function escape(value) {
        return Api.escapeHtml(value);
    }

    function hasStaffAuth() {
        return Boolean(
            window.NewsPortalAuth?.hasStoredAuthToken?.()
            || window.NewsPortalSession?.getStoredAccessToken?.()
            || window.NewsPortalSession?.getStoredRefreshToken?.()
        );
    }

    function slugify(value) {
        return String(value || '')
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '');
    }

    function normalizeKey(value) {
        if (value === null || value === undefined || value === '') {
            return '';
        }

        return String(value).trim().toLowerCase();
    }

    function uniqueKeys(values) {
        return [...new Set(values.flatMap((value) => {
            const normalized = normalizeKey(value);
            const slug = slugify(value);
            return [normalized, slug].filter(Boolean);
        }))];
    }

    function getCategoryName(category) {
        return Api.getValue(category, ['name', 'title', 'label', 'category_name'], 'Untitled category');
    }

    function getCategorySlug(category) {
        return Api.getValue(category, ['slug', 'code', 'key'], slugify(getCategoryName(category)));
    }

    function getCategoryDescription(category) {
        return Api.getValue(category, ['description', 'summary', 'details'], '');
    }

    function categoryKeys(category) {
        return uniqueKeys([
            Api.getValue(category, ['id'], ''),
            getCategorySlug(category),
            getCategoryName(category),
            Api.getValue(category, ['category_name'], '')
        ]);
    }

    function articleCategoryKeys(article) {
        const categoryValue = Api.getValue(article, ['category'], '');
        const simpleCategory = categoryValue && typeof categoryValue !== 'object' ? categoryValue : '';

        return uniqueKeys([
            Api.getValue(article, ['category.id', 'category_id'], ''),
            Api.getValue(article, ['category.slug', 'category_slug'], ''),
            Api.getValue(article, ['category.name', 'category.title', 'category_name', 'category_label'], ''),
            simpleCategory
        ]);
    }

    function mergeArticles(...lists) {
        const byKey = new Map();

        lists.flat().forEach((article) => {
            const key = article?.id || article?.slug || `${article?.title || ''}-${article?.created_at || article?.published_at || ''}`;
            if (key) {
                byKey.set(String(key), article);
            }
        });

        return [...byKey.values()];
    }

    function normalizeArticle(article) {
        return ArticleService?.normalizeArticle ? ArticleService.normalizeArticle(article) : article;
    }

    function buildCounts(articles) {
        const counts = new Map();

        articles.forEach((article) => {
            articleCategoryKeys(article).forEach((key) => {
                counts.set(key, (counts.get(key) || 0) + 1);
            });
        });

        return counts;
    }

    function countForCategory(category) {
        return categoryKeys(category).reduce((total, key) => Math.max(total, state.counts.get(key) || 0), 0);
    }

    async function loadAllCategories() {
        const result = await Utils.loadAllPages((page, options) => Api.loadList(categoryEndpoints, page, {
            auth: false,
            ...options
        }));

        return result.data.results || [];
    }

    async function loadAllArticles() {
        const publicResult = await Utils.loadAllPages((page, options) => Api.loadList(publicArticleEndpoints, page, {
            auth: false,
            ...options,
            params: {
                ordering: '-id',
                ...(options.params || {})
            }
        }));

        let reporterRecords = [];
        if (hasStaffAuth()) {
            try {
                const reporterResult = await Utils.loadAllPages((page, options) => Api.loadList(reporterArticleEndpoints, page, {
                    auth: true,
                    ...options,
                    params: {
                        ordering: '-id',
                        ...(options.params || {})
                    }
                }));
                reporterRecords = reporterResult.data.results || [];
            } catch (error) {
                console.warn('Unable to load staff draft articles for category counts.', error);
            }
        }

        return mergeArticles(publicResult.data.results || [], reporterRecords).map(normalizeArticle);
    }

    function renderSummary() {
        const counts = state.categories.map(countForCategory);
        const linkedTotal = counts.reduce((total, count) => total + count, 0);

        els.totalCategories.textContent = state.categories.length;
        els.totalArticles.textContent = state.articles.length;
        els.linkedArticles.textContent = linkedTotal;
        els.emptyCategories.textContent = counts.filter((count) => count === 0).length;
    }

    function renderCategories() {
        const query = els.search.value.trim().toLowerCase();
        const filtered = state.categories.filter((category) => {
            const count = countForCategory(category);
            return [
                getCategoryName(category),
                getCategorySlug(category),
                getCategoryDescription(category),
                String(count)
            ].join(' ').toLowerCase().includes(query);
        });

        els.visible.textContent = `${filtered.length} categor${filtered.length === 1 ? 'y' : 'ies'} shown`;

        if (!filtered.length) {
            Utils.setTableMessage(els.tbody, 3, query ? 'No categories match your search.' : 'No categories found.');
            return;
        }

        els.tbody.innerHTML = filtered.map((category) => {
            const name = getCategoryName(category);
            const description = getCategoryDescription(category);
            const count = countForCategory(category);

            return `
                <tr>
                    <td>
                        <div class="category-cell">
                            <span class="category-icon">${escape(name.trim().charAt(0).toUpperCase() || 'C')}</span>
                            <div class="category-title-wrap">
                                <strong>${escape(name)}</strong>
                                <span class="category-description">${escape(description || `${count} article${count === 1 ? '' : 's'}`)}</span>
                            </div>
                        </div>
                    </td>
                    <td><span class="slug-pill">${escape(getCategorySlug(category))}</span></td>
                    <td class="category-meta-muted">${escape(count)}</td>
                </tr>
            `;
        }).join('');
    }

    async function loadCategories() {
        Utils.setTableMessage(els.tbody, 3, 'Loading categories...');

        try {
            const [categories, articles] = await Promise.all([
                loadAllCategories(),
                loadAllArticles()
            ]);

            state.categories = categories;
            state.articles = articles;
            state.counts = buildCounts(articles);

            renderSummary();
            renderCategories();
        } catch (error) {
            console.error('Unable to load categories:', error);
            state.categories = [];
            state.articles = [];
            state.counts = new Map();
            renderSummary();
            Utils.setTableMessage(els.tbody, 3, 'Unable to load categories right now.');
            els.visible.textContent = '0 categories shown';
        }
    }

    document.addEventListener('DOMContentLoaded', loadCategories);
    els.refresh?.addEventListener('click', loadCategories);
    els.search?.addEventListener('input', renderCategories);
    Api.onDataChanged?.((event) => {
        if (event?.type === 'articles') {
            loadCategories();
        }
    });
})();
