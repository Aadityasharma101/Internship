(function () {
    const Api = window.NewsPortalApi;
    const ArticleService = window.NewsPortalArticleService;
    const Utils = window.StaffUtils;

    const state = {
        user: null,
        articles: [],
        endpoint: '/articles/'
    };

    const els = {
        tbody: document.getElementById('articlesTableBody'),
        prev: null,
        next: null,
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
        saveDraft: document.getElementById('saveDraftArticleBtn'),
        publish: document.getElementById('publishArticleBtn'),
        status: document.getElementById('articleFormStatus'),
        id: document.getElementById('articleId'),
        title: document.getElementById('articleTitle'),
        subtitle: document.getElementById('articleSubtitle'),
        category: document.getElementById('articleCategory'),
        thumbnail: document.getElementById('articleThumbnail'),
        featuredImage: document.getElementById('articleFeaturedImage'),
        content: document.getElementById('articleContent'),
        tags: document.getElementById('articleTags'),
        publishDate: document.getElementById('articlePublishDate'),
        articleStatus: document.getElementById('articleStatus')
    };

    function isFeatured(article) {
        return Boolean(Api.getValue(article, ['is_featured', 'featured', 'is_highlighted'], false));
    }

    function toDateInput(value) {
        if (!value) {
            return '';
        }

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {
            return '';
        }

        const pad = (num) => String(num).padStart(2, '0');
        const year = date.getFullYear();
        const month = pad(date.getMonth() + 1);
        const day = pad(date.getDate());
        const hours = pad(date.getHours());
        const minutes = pad(date.getMinutes());

        return `${year}-${month}-${day}T${hours}:${minutes}`;
    }

    function fromTagsValue(value) {
        if (Array.isArray(value)) {
            return value.join(', ');
        }

        if (typeof value === 'string') {
            return value;
        }

        return '';
    }

    function normalizeTagInput(value) {
        return String(value || '')
            .split(',')
            .map((entry) => entry.trim())
            .filter(Boolean);
    }

    function renderSummary(items) {
        els.total.textContent = items.length;
        els.published.textContent = items.filter((article) => article.status === 'published').length;
        els.draft.textContent = items.filter((article) => article.status !== 'published').length;
        els.featured.textContent = items.filter(isFeatured).length;
    }

    function renderArticles() {
        const query = els.search.value.trim().toLowerCase();
        const filtered = state.articles.filter((article) => [
            article.title,
            article.subtitle,
            article.category_label,
            fromTagsValue(article.tags),
            article.status
        ].join(' ').toLowerCase().includes(query));

        els.visible.textContent = `${filtered.length} article${filtered.length === 1 ? '' : 's'} shown`;

        if (!filtered.length) {
            Utils.setTableMessage(els.tbody, 6, query ? 'No articles match your search.' : 'No articles found for your account.');
            return;
        }

        els.tbody.innerHTML = filtered.map((article) => `
            <tr>
                <td>
                    <div class="article-cell">
                        ${article.thumbnail_url || article.featured_image_url ? `
                            <img class="article-thumb" src="${Api.escapeHtml(article.thumbnail_url || article.featured_image_url)}" alt="${Api.escapeHtml(article.title || 'Article')}" loading="lazy">
                        ` : `
                            <div class="article-thumb-fallback">
                                <i class="fa-regular fa-newspaper"></i>
                            </div>
                        `}
                        <div class="article-title-wrap">
                            <strong>${Api.escapeHtml(article.title || 'Untitled article')}</strong>
                            <span class="article-excerpt">${Api.escapeHtml(article.subtitle || article.content || 'No subtitle added')}</span>
                        </div>
                    </div>
                </td>
                <td><span class="category-pill">${Api.escapeHtml(article.category_label || 'Uncategorized')}</span></td>
                <td><span class="status-pill ${article.status === 'published' ? 'status-published' : 'status-draft'}">${Api.escapeHtml(article.status || 'draft')}</span></td>
                <td class="article-meta-muted">${Api.escapeHtml(Api.formatDate(article.publish_date))}</td>
                <td class="article-meta-muted">${Api.escapeHtml(Api.formatDate(article.updated_at || article.created_at))}</td>
                <td>
                    <div class="row-actions">
                        <a href="/news/${Api.escapeHtml(article.id)}/" target="_blank" rel="noopener" title="View article" aria-label="View ${Api.escapeHtml(article.title)}">
                            <i class="fa-regular fa-eye"></i>
                        </a>
                        <button type="button" data-action="edit" data-id="${Api.escapeHtml(article.id)}" title="Edit article" aria-label="Edit ${Api.escapeHtml(article.title)}">
                            <i class="fa-regular fa-pen-to-square"></i>
                        </button>
                        <button type="button" data-action="toggle" data-id="${Api.escapeHtml(article.id)}" title="${article.status === 'published' ? 'Save as draft' : 'Publish article'}" aria-label="${article.status === 'published' ? 'Save as draft' : 'Publish article'}">
                            <i class="fa-solid ${article.status === 'published' ? 'fa-file-pen' : 'fa-paper-plane'}"></i>
                        </button>
                        <button class="danger-action" type="button" data-action="delete" data-id="${Api.escapeHtml(article.id)}" title="Delete article" aria-label="Delete ${Api.escapeHtml(article.title)}">
                            <i class="fa-regular fa-trash-can"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    }

    async function loadArticles() {
        Utils.setTableMessage(els.tbody, 6, 'Loading articles...');

        try {
            state.user = await window.NewsPortalSession.fetchCurrentUser();
            const result = await Utils.loadAllPages((page, options) => ArticleService.loadArticles(page, {
                ...options,
                params: {
                    ...(options.params || {}),
                    ordering: '-id'
                }
            }));

            state.endpoint = result.endpoint || state.endpoint;
            state.articles = Utils.sortByNewest(result.data.results.filter((article) => ArticleService.articleMatchesUser(article, state.user)));

            renderSummary(state.articles);
            renderArticles();
        } catch (error) {
            console.error('Unable to load articles:', error);
            Utils.setTableMessage(els.tbody, 6, 'Unable to load articles. Please check the API token or try again.');
            state.articles = [];
            renderSummary([]);
        }
    }

    function resetForm() {
        els.id.value = '';
        els.title.value = '';
        els.subtitle.value = '';
        els.category.value = '';
        els.thumbnail.value = '';
        els.featuredImage.value = '';
        els.content.value = '';
        els.tags.value = '';
        els.publishDate.value = '';
        els.articleStatus.value = 'draft';
        els.status.textContent = '';
    }

    function fillForm(article) {
        els.id.value = article.id || '';
        els.title.value = article.title || '';
        els.subtitle.value = article.subtitle || '';
        els.category.value = article.category_label || Api.getValue(article, ['category.id', 'category', 'category_name'], '');
        els.thumbnail.value = Api.getValue(article, ['thumbnail_url', 'thumbnail', 'image', 'image_url'], '');
        els.featuredImage.value = Api.getValue(article, ['featured_image_url', 'featured_image', 'cover_image'], '');
        els.content.value = article.content || '';
        els.tags.value = fromTagsValue(article.tags);
        els.publishDate.value = toDateInput(article.publish_date || article.published_at || article.published_on);
        els.articleStatus.value = article.status === 'published' ? 'published' : 'draft';
    }

    function openCreateModal() {
        resetForm();
        els.modalTitle.textContent = 'Create Article';
        els.modal.classList.remove('hidden');
    }

    function openEditModal(article) {
        resetForm();
        fillForm(article);
        els.modalTitle.textContent = 'Edit Article';
        els.modal.classList.remove('hidden');
    }

    function closeModal() {
        els.modal.classList.add('hidden');
    }

    function buildPayload(statusOverride = null) {
        const status = statusOverride || els.articleStatus.value || 'draft';
        const publishDate = els.publishDate.value ? new Date(els.publishDate.value).toISOString() : (status === 'published' ? new Date().toISOString() : '');
        const tags = normalizeTagInput(els.tags.value);

        const payload = {
            title: els.title.value.trim(),
            subtitle: els.subtitle.value.trim(),
            category: /^\d+$/.test(els.category.value.trim()) ? Number(els.category.value.trim()) : els.category.value.trim(),
            thumbnail: els.thumbnail.value.trim(),
            thumbnail_url: els.thumbnail.value.trim(),
            featured_image: els.featuredImage.value.trim(),
            featured_image_url: els.featuredImage.value.trim(),
            content: els.content.value.trim(),
            body: els.content.value.trim(),
            status,
            is_published: status === 'published',
            published: status === 'published',
            publish_date: publishDate,
            published_at: publishDate,
            tags,
            tag_list: tags,
            is_featured: false,
            featured: false
        };

        if (!payload.category) {
            delete payload.category;
        }

        if (!payload.thumbnail) {
            delete payload.thumbnail;
            delete payload.thumbnail_url;
        }

        if (!payload.featured_image) {
            delete payload.featured_image;
            delete payload.featured_image_url;
        }

        if (!payload.publish_date) {
            delete payload.publish_date;
            delete payload.published_at;
        }

        return payload;
    }

    function getCurrentArticle() {
        const id = els.id.value;
        return state.articles.find((article) => String(article.id) === String(id));
    }

    async function saveArticle(statusOverride = null) {
        const id = els.id.value;
        const payload = buildPayload(statusOverride);

        if (!payload.title) {
            els.status.textContent = 'Title is required.';
            return;
        }

        els.saveDraft.disabled = true;
        els.publish.disabled = true;
        els.status.textContent = id ? 'Saving article...' : 'Creating article...';

        try {
            if (id) {
                await ArticleService.updateArticle(id, payload);
            } else {
                await ArticleService.createArticle(payload);
            }

            closeModal();
            await loadArticles();
        } catch (error) {
            console.error('Unable to save article:', error);
            els.status.textContent = 'Unable to save article. Check required fields and permissions.';
        } finally {
            els.saveDraft.disabled = false;
            els.publish.disabled = false;
        }
    }

    async function toggleArticle(article) {
        try {
            if (article.status === 'published') {
                await ArticleService.saveDraftArticle(article.id);
            } else {
                await ArticleService.publishArticle(article.id);
            }

            await loadArticles();
        } catch (error) {
            console.error('Unable to change article status:', error);
            window.alert('Unable to update the article status. Please try again.');
        }
    }

    async function deleteArticle(article) {
        if (!window.confirm(`Delete "${article.title}"? This cannot be undone.`)) {
            return;
        }

        try {
            await ArticleService.deleteArticle(article.id);
            await loadArticles();
        } catch (error) {
            console.error('Unable to delete article:', error);
            window.alert('Unable to delete this article. Check permissions and try again.');
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

        if (button.dataset.action === 'toggle') {
            toggleArticle(article);
        }

        if (button.dataset.action === 'delete') {
            deleteArticle(article);
        }
    });

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

    els.refresh.addEventListener('click', loadArticles);
    els.search.addEventListener('input', renderArticles);
    els.open.addEventListener('click', openCreateModal);
    els.close.addEventListener('click', closeModal);
    els.saveDraft.addEventListener('click', () => saveArticle('draft'));
    els.publish.addEventListener('click', () => saveArticle('published'));
    els.modal.addEventListener('click', (event) => {
        if (event.target === els.modal) {
            closeModal();
        }
    });

    document.addEventListener('DOMContentLoaded', async () => {
        await loadArticles();
        openFromQuery();
    });
})();
