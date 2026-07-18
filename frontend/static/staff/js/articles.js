(function () {
    const Api = window.NewsPortalApi;
    const ArticleService = window.NewsPortalArticleService;
    const Utils = window.StaffUtils;

    const hasAuth = Boolean(window.NewsPortalAuth?.hasStoredAuthToken?.());
    const listEndpoints = hasAuth ? ['/articles/reporter/articles/', '/articles/feed/', '/portal/articles/'] : ['/articles/feed/', '/portal/articles/'];
    const createEndpoints = ['/articles/create/', '/portal/articles/create/'];

    const state = {
        user: null,
        articles: [],
        response: null,
        page: 1,
        endpoint: listEndpoints[0],
        imageFile: null,
        imageCleared: false,
        imagePreviewUrl: ''
    };

    const els = {
        tbody: document.getElementById('articlesTableBody'),
        prev: document.getElementById('prevArticleBtn'),
        next: document.getElementById('nextArticleBtn'),
        pageInfo: document.getElementById('articlePageInfo'),
        refresh: document.getElementById('refreshArticlesBtn'),
        search: document.getElementById('articleSearchInput'),
        visible: document.getElementById('visibleArticlesCount'),
        total: document.getElementById('totalArticles'),
        published: document.getElementById('publishedArticles'),
        draft: document.getElementById('draftArticles'),
        featured: document.getElementById('featuredArticles'),
        modal: document.getElementById('articleModal'),
        modalTitle: document.getElementById('articleModalTitle'),
        open: document.getElementById('openArticleModalBtn'),
        close: document.getElementById('closeArticleModalBtn'),
        save: document.getElementById('saveArticleBtn'),
        status: document.getElementById('articleFormStatus'),
        id: document.getElementById('articleId'),
        title: document.getElementById('articleTitle'),
        category: document.getElementById('articleCategory'),
        articleStatus: document.getElementById('articleStatus'),
        image: document.getElementById('articleImage'),
        imageFile: document.getElementById('articleImageFile'),
        clearImage: document.getElementById('clearArticleImageBtn'),
        imagePreview: document.getElementById('articleImagePreview'),
        description: document.getElementById('articleDescription'),
        body: document.getElementById('articleBody'),
        featuredArticle: document.getElementById('articleFeatured'),
        published: document.getElementById('articlePublished')
    };

    function normalizeStatus(article) {
        if (article?.is_published === true || article?.published === true) {
            return 'published';
        }

        const status = Api.getValue(article, ['status', 'state', 'publication_status'], 'draft');
        return String(status || 'draft').toLowerCase();
    }

    function getArticleTitle(article) {
        return Api.getValue(article, ['title', 'headline', 'name'], 'Untitled article');
    }

    function getArticleExcerpt(article) {
        return Api.getValue(article, ['excerpt', 'summary', 'description', 'content', 'body'], 'No summary added');
    }

    function getArticleCategory(article) {
        return Api.getValue(article, ['category.name', 'category.category_name', 'category.title', 'category', 'category_name'], 'Uncategorized');
    }

    function getArticleAuthor(article) {
        const firstName = Api.getValue(article, ['author.first_name', 'user.first_name']);
        const lastName = Api.getValue(article, ['author.last_name', 'user.last_name']);
        const fullName = `${firstName || ''} ${lastName || ''}`.trim();

        return fullName || Api.getValue(article, [
            'author.full_name',
            'author.name',
            'author.username',
            'author.email',
            'author_name',
            'user.full_name',
            'user.name',
            'user.username',
            'created_by.username',
            'created_by.email'
        ], 'Unknown author');
    }

    function getArticleImage(article) {
        return Api.getValue(article, ['image', 'image_url', 'thumbnail', 'thumbnail_url', 'featured_image', 'cover_image', 'media.url'], '');
    }

    function isPublished(article) {
        return normalizeStatus(article) === 'published';
    }

    function isFeatured(article) {
        return Boolean(Api.getValue(article, ['is_featured', 'featured', 'is_trending', 'trending'], false));
    }

    function statusClass(status) {
        const key = String(status || '').toLowerCase();

        if (key.includes('publish')) {
            return 'status-published';
        }

        if (key.includes('archive') || key.includes('inactive')) {
            return 'status-archived';
        }

        return 'status-draft';
    }

    function escape(value) {
        return Api.escapeHtml(value);
    }

    function renderArticleImage(article) {
        const image = getArticleImage(article);

        if (image) {
            return `<img class="article-thumb" src="${escape(image)}" alt="${escape(getArticleTitle(article))}" loading="lazy">`;
        }

        return `<span class="article-thumb-fallback" aria-hidden="true"><i class="fa-regular fa-newspaper"></i></span>`;
    }

    function renderArticles(items) {
        const query = els.search.value.trim().toLowerCase();
        const filtered = items.filter((article) => [
            getArticleTitle(article),
            getArticleExcerpt(article),
            getArticleCategory(article),
            getArticleAuthor(article),
            normalizeStatus(article)
        ].join(' ').toLowerCase().includes(query));

        els.visible.textContent = `${filtered.length} article${filtered.length === 1 ? '' : 's'} shown`;

        if (!filtered.length) {
            Utils.setTableMessage(els.tbody, 8, query ? 'No articles match your search.' : 'No articles found.');
            return;
        }

        els.tbody.innerHTML = filtered.map((article) => {
            const title = getArticleTitle(article);
            const status = normalizeStatus(article);
            const featured = isFeatured(article);

            return `
                <tr>
                    <td>
                        <div class="article-cell">
                            ${renderArticleImage(article)}
                            <div class="article-title-wrap">
                                <strong>${escape(title)}</strong>
                                <span class="article-excerpt">${escape(getArticleExcerpt(article))}</span>
                            </div>
                        </div>
                    </td>
                    <td><span class="category-pill">${escape(getArticleCategory(article))}</span></td>
                    <td>${escape(getArticleAuthor(article))}</td>
                    <td><span class="status-pill ${statusClass(status)}">${escape(status)}</span></td>
                    <td><span class="feature-pill ${featured ? 'feature-yes' : 'feature-no'}">${featured ? 'Featured' : 'Standard'}</span></td>
                    <td class="article-meta-muted">${escape(Api.formatDate(Api.getValue(article, ['published_at', 'publish_date', 'published_on', 'created_at'])))}</td>
                    <td class="article-meta-muted">${escape(Api.formatDate(Api.getValue(article, ['updated_at', 'modified_at', 'created_at'])))}</td>
                    <td>
                        <div class="row-actions">
                            <a href="/news/${escape(article.id)}/" target="_blank" rel="noopener" title="View article" aria-label="View ${escape(title)}">
                                <i class="fa-regular fa-eye"></i>
                            </a>
                            <button type="button" data-action="edit" data-id="${escape(article.id)}" title="Edit article" aria-label="Edit ${escape(title)}">
                                <i class="fa-regular fa-pen-to-square"></i>
                            </button>
                            <button class="danger-action" type="button" data-action="delete" data-id="${escape(article.id)}" title="Delete article" aria-label="Delete ${escape(title)}">
                                <i class="fa-regular fa-trash-can"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    function updateSummary(items, totalCount) {
        els.total.textContent = totalCount ?? items.length;
        els.published.textContent = items.filter(isPublished).length;
        els.draft.textContent = items.filter((article) => !isPublished(article)).length;
        els.featured.textContent = items.filter(isFeatured).length;
    }

    function updatePagination(data) {
        els.prev.disabled = !data.previous;
        els.next.disabled = !data.next;
        els.pageInfo.textContent = `Page ${state.page}`;
    }

    function revokePreviewUrl() {
        if (state.imagePreviewUrl && state.imagePreviewUrl.startsWith('blob:')) {
            URL.revokeObjectURL(state.imagePreviewUrl);
        }
        state.imagePreviewUrl = '';
    }

    function setPreview(url, emptyLabel = 'No image selected') {
        if (!els.imagePreview) {
            return;
        }

        if (!url) {
            els.imagePreview.innerHTML = `<div class="preview-empty">${escape(emptyLabel)}</div>`;
            els.imagePreview.classList.remove('hidden');
            return;
        }

        els.imagePreview.innerHTML = `<img src="${escape(url)}" alt="Article image preview" loading="lazy">`;
        els.imagePreview.classList.remove('hidden');
    }

    function resetImageState() {
        revokePreviewUrl();
        state.imageFile = null;
        state.imageCleared = false;
        els.imageFile.value = '';
        els.image.value = '';
        setPreview('', 'No image selected');
    }

    function openCreateModal() {
        els.id.value = '';
        els.title.value = '';
        els.category.value = '';
        els.articleStatus.value = 'draft';
        els.image.value = '';
        els.description.value = '';
        els.body.value = '';
        els.featuredArticle.checked = false;
        els.published.checked = false;
        els.status.textContent = '';
        els.modalTitle.textContent = 'Create New Article';
        els.save.textContent = 'Create Article';
        resetImageState();
        els.modal.classList.remove('hidden');
    }

    async function loadArticleDetail(id) {
        try {
            const detail = await Api.request('GET', `/articles/${id}/`, { auth: hasAuth });
            return detail || {};
        } catch {
            return {};
        }
    }

    async function openEditModal(article) {
        const detail = await loadArticleDetail(article.id);
        const record = { ...article, ...detail };

        els.id.value = record.id || '';
        els.title.value = getArticleTitle(record) === 'Untitled article' ? '' : getArticleTitle(record);
        els.category.value = Api.getValue(record, ['category.id', 'category.name', 'category.category_name', 'category', 'category_name'], '');
        els.articleStatus.value = normalizeStatus(record);
        els.image.value = getArticleImage(record) || '';
        els.description.value = Api.getValue(record, ['description', 'summary', 'excerpt'], '');
        els.body.value = Api.getValue(record, ['body', 'content'], '');
        els.featuredArticle.checked = isFeatured(record);
        els.published.checked = isPublished(record);
        els.status.textContent = '';
        els.modalTitle.textContent = 'Edit Article';
        els.save.textContent = 'Save Changes';

        state.imageFile = null;
        state.imageCleared = false;
        els.imageFile.value = '';
        setPreview(getArticleImage(record), 'No image selected');
        els.modal.classList.remove('hidden');
    }

    function closeModal() {
        els.modal.classList.add('hidden');
    }

    function collectPayload(statusOverride = null) {
        const formData = new FormData();
        const status = statusOverride || els.articleStatus.value || 'draft';
        const imageUrl = els.image.value.trim();
        const categoryValue = els.category.value.trim();
        const publishedAt = status === 'published' ? new Date().toISOString() : '';

        formData.append('title', els.title.value.trim());
        formData.append('status', status);
        formData.append('body', els.body.value.trim());
        formData.append('description', els.description.value.trim());
        formData.append('is_featured', String(els.featuredArticle.checked));
        formData.append('featured', String(els.featuredArticle.checked));
        formData.append('is_published', String(els.published.checked || status === 'published'));
        formData.append('published', String(els.published.checked || status === 'published'));

        if (publishedAt) {
            formData.append('published_at', publishedAt);
        }

        if (categoryValue) {
            if (/^\d+$/.test(categoryValue)) {
                formData.append('category_id', String(Number(categoryValue)));
            } else {
                formData.append('category_name', categoryValue);
            }
        }

        if (state.imageFile) {
            formData.append('image', state.imageFile);
        } else if (state.imageCleared) {
            formData.append('image', '');
        } else if (imageUrl) {
            formData.append('image', imageUrl);
        }

        return formData;
    }

    async function saveArticle() {
        const id = els.id.value;
        const payload = collectPayload();

        if (!els.title.value.trim()) {
            els.status.textContent = 'Title is required.';
            return;
        }

        els.save.disabled = true;
        els.status.textContent = id ? 'Saving article...' : 'Creating article...';

        try {
            let savedArticle = null;
            if (id) {
                savedArticle = await Api.request('PATCH', `/articles/${id}/update/`, { data: payload, auth: hasAuth });
            } else {
                savedArticle = await Api.request('POST', createEndpoints[0], { data: payload, auth: hasAuth });
            }

            closeModal();
            Api.notifyDataChanged?.('articles', { action: id ? 'update' : 'create', id: savedArticle?.id || id || null });
            await loadArticles(1);
        } catch (error) {
            console.error('Unable to save article:', error);
            els.status.textContent = 'Unable to save article. Check required fields and permissions.';
        } finally {
            els.save.disabled = false;
        }
    }

    async function removeArticle(article) {
        if (!window.confirm(`Delete "${getArticleTitle(article)}"? This cannot be undone.`)) {
            return;
        }

        try {
            await Api.request('DELETE', `/articles/${article.id}/delete/`, { auth: hasAuth });
            Api.notifyDataChanged?.('articles', { action: 'delete', id: article.id });
            await loadArticles(1);
        } catch (error) {
            console.error('Unable to delete article:', error);
            window.alert('Unable to delete this article. Check your permissions and try again.');
        }
    }

    async function loadArticles(page = 1) {
        Utils.setTableMessage(els.tbody, 8, 'Loading articles...', 'loading');

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

            const result = await Api.loadList(listEndpoints, page, {
                auth: hasAuth,
                params: {
                    ordering: '-id'
                }
            });

            state.endpoint = result.endpoint || state.endpoint;
            state.response = result.data;
            state.page = page;

            const records = result.data.results.map((item) => ArticleService.normalizeArticle ? ArticleService.normalizeArticle(item) : item);
            state.articles = state.user
                ? Utils.sortByNewest(records.filter((article) => ArticleService.articleMatchesUser(article, state.user)))
                : Utils.sortByNewest(records);

            updateSummary(state.articles, result.data.count);
            renderArticles(state.articles);
            updatePagination(result.data);
        } catch (error) {
            console.error('Error loading articles:', error);
            Utils.setTableMessage(els.tbody, 8, 'Unable to load articles. Please check the API token or try again.');
            updateSummary([], 0);
            updatePagination({ previous: null, next: null });
        }
    }

    function openFromQuery() {
        const params = new URLSearchParams(window.location.search);
        const newArticle = params.get('new');
        const editId = params.get('edit');

        if (newArticle === '1') {
            openCreateModal();
            return;
        }

        if (editId) {
            const article = state.articles.find((item) => String(item.id) === String(editId));

            if (article) {
                openEditModal(article);
            }
        }
    }

    els.tbody.addEventListener('click', (event) => {
        const button = event.target.closest('button[data-action]');

        if (!button) {
            return;
        }

        const article = state.articles.find((item) => String(item.id) === String(button.dataset.id));

        if (!article) {
            return;
        }

        if (button.dataset.action === 'edit') {
            openEditModal(article);
        }

        if (button.dataset.action === 'delete') {
            removeArticle(article);
        }
    });

    els.prev.addEventListener('click', () => {
        if (state.response?.previous) {
            loadArticles(Math.max(1, state.page - 1));
        }
    });

    els.next.addEventListener('click', () => {
        if (state.response?.next) {
            loadArticles(state.page + 1);
        }
    });

    els.refresh.addEventListener('click', () => loadArticles(state.page));
    els.search.addEventListener('input', () => renderArticles(state.articles));
    els.open.addEventListener('click', openCreateModal);
    els.close.addEventListener('click', closeModal);
    els.save.addEventListener('click', saveArticle);
    els.modal.addEventListener('click', (event) => {
        if (event.target === els.modal) {
            closeModal();
        }
    });

    els.image.addEventListener('input', () => {
        if (state.imageFile) {
            return;
        }

        state.imageCleared = false;
        setPreview(els.image.value.trim(), 'No image selected');
    });

    els.imageFile.addEventListener('change', () => {
        const file = els.imageFile.files?.[0] || null;

        state.imageFile = file;
        state.imageCleared = false;

        if (file) {
            revokePreviewUrl();
            const objectUrl = URL.createObjectURL(file);
            state.imagePreviewUrl = objectUrl;
            els.image.value = '';
            setPreview(objectUrl, 'No image selected');
        } else {
            setPreview(els.image.value.trim(), 'No image selected');
        }
    });

    els.clearImage.addEventListener('click', () => {
        revokePreviewUrl();
        state.imageFile = null;
        state.imageCleared = true;
        els.image.value = '';
        els.imageFile.value = '';
        setPreview('', 'Image removed');
    });

    document.addEventListener('DOMContentLoaded', async () => {
        await loadArticles();
        openFromQuery();
    });

    window.addEventListener('pageshow', () => loadArticles(state.page));
    Api.onDataChanged?.((event) => {
        if (event?.type === 'articles') {
            loadArticles(1);
        }
    });
})();
