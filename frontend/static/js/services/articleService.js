(function (window) {
    const Api = window.NewsPortalApi;
    const ARTICLE_API_BASE = '/remote/api/articles';
    const LIST_ENDPOINTS = [`${ARTICLE_API_BASE}/feed/`];
    const AUTH_LIST_ENDPOINTS = [`${ARTICLE_API_BASE}/reporter/articles/`, `${ARTICLE_API_BASE}/feed/`];
    const CREATE_ENDPOINTS = [`${ARTICLE_API_BASE}/create/`];

    function normalizeStatus(article) {
        const rawStatus = Api.getValue(article, ['status', 'state', 'publication_status'], '');

        if (article?.is_published === true || article?.published === true) {
            return 'published';
        }

        if (rawStatus) {
            return String(rawStatus).toLowerCase();
        }

        return Api.getValue(article, ['published_at', 'publish_date', 'published_on'], '') ? 'published' : 'draft';
    }

    function normalizeArticle(article) {
        const status = normalizeStatus(article);

        return {
            ...article,
            status,
            title: Api.getValue(article, ['title', 'headline', 'name'], 'Untitled article'),
            subtitle: Api.getValue(article, ['subtitle', 'sub_title', 'summary'], ''),
            category_label: Api.getValue(article, ['category.name', 'category.title', 'category_name', 'category'], 'Uncategorized'),
            thumbnail_url: Api.resolveMediaUrl(Api.getValue(article, ['thumbnail', 'thumbnail_url', 'image', 'image_url'], '')),
            featured_image_url: Api.resolveMediaUrl(Api.getValue(article, ['featured_image', 'featured_image_url', 'cover_image'], '')),
            content: Api.getValue(article, ['content', 'body', 'description'], ''),
            tags: Api.getValue(article, ['tags', 'tag_list'], []),
            publish_date: Api.getValue(article, ['publish_date', 'published_at', 'published_on'], ''),
            author_id: Api.getValue(article, ['author.id', 'user.id', 'created_by.id', 'author_id', 'user_id'], ''),
            author_name: Api.getValue(article, ['author.name', 'author.username', 'user.username', 'created_by.username', 'author_name'], ''),
            author_email: Api.getValue(article, ['author.email', 'user.email', 'created_by.email', 'author_email'], ''),
            is_published: status === 'published',
            is_draft: status === 'draft'
        };
    }

    function articleMatchesUser(article, user) {
        if (!user) {
            return true;
        }

        const candidates = [
            Api.getValue(article, ['author.id', 'user.id', 'created_by.id', 'author_id', 'user_id'], ''),
            Api.getValue(article, ['author.username', 'user.username', 'created_by.username', 'author_name'], ''),
            Api.getValue(article, ['author.email', 'user.email', 'created_by.email', 'author_email'], '')
        ].filter(Boolean).map((value) => String(value).toLowerCase());

        const userCandidates = [
            user.id,
            user.username,
            user.email
        ].filter(Boolean).map((value) => String(value).toLowerCase());

        return userCandidates.some((candidate) => candidates.includes(candidate));
    }

    function summarizeArticles(articles) {
        const items = Array.isArray(articles) ? articles : [];
        const published = items.filter((article) => normalizeStatus(article) === 'published').length;
        const drafts = items.filter((article) => normalizeStatus(article) === 'draft').length;

        return {
            total: items.length,
            published,
            drafts,
            recent: items.slice().sort((left, right) => new Date(right.updated_at || right.created_at || right.publish_date || 0) - new Date(left.updated_at || left.created_at || left.publish_date || 0))
        };
    }

    async function loadArticles(page = 1, options = {}) {
        const endpoints = options.auth === false ? LIST_ENDPOINTS : AUTH_LIST_ENDPOINTS;
        const result = await Api.loadList(endpoints, page, options);
        return {
            endpoint: result.endpoint,
            data: {
                ...result.data,
                results: result.data.results.map(normalizeArticle)
            }
        };
    }

    async function createArticle(payload, options = {}) {
        return Api.createItem(CREATE_ENDPOINTS, payload, options);
    }

    async function updateArticle(id, payload, options = {}) {
        return Api.request('PATCH', `${ARTICLE_API_BASE}/${id}/update/`, {
            ...options,
            data: payload
        });
    }

    async function deleteArticle(id, options = {}) {
        return Api.request('DELETE', `${ARTICLE_API_BASE}/${id}/delete/`, options);
    }

    async function publishArticle(id, options = {}) {
        return Api.request('POST', `${ARTICLE_API_BASE}/${id}/publish/`, {
            ...options,
            data: {}
        });
    }

    async function saveDraftArticle(id, options = {}) {
        return updateArticle(id, {}, options);
    }

    window.NewsPortalArticleService = {
        articleMatchesUser,
        createArticle,
        deleteArticle,
        loadArticles,
        normalizeArticle,
        publishArticle,
        saveDraftArticle,
        summarizeArticles,
        updateArticle
    };
})(window);
