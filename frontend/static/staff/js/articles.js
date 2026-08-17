(function () {
    const Api = window.NewsPortalApi;
    const ArticleService = window.NewsPortalArticleService;
    const Utils = window.StaffUtils;

    const hasAuth = Boolean(window.NewsPortalAuth?.hasStoredAuthToken?.());
    // Prefer global `NEWS_PORTAL_API_BASE` if set, otherwise fall back to server-provided data-api-base
    // or the known remote default. Ensure the base includes the '/api' segment.
    let REMOTE_API_BASE = '';
    if (typeof window !== 'undefined') {
        REMOTE_API_BASE = (window.NEWS_PORTAL_API_BASE || window.document?.body?.dataset?.apiBase || 'https://news-portal-hvgs.onrender.com/api');
        REMOTE_API_BASE = String(REMOTE_API_BASE).replace(/\/+$/, '');
        if (!/\/api(\/|$)/i.test(REMOTE_API_BASE)) {
            REMOTE_API_BASE = REMOTE_API_BASE + '/api';
        }
    }
    const articleApiBase = `${REMOTE_API_BASE.replace(/\/+$/,'')}/articles`;
    // Standard REST endpoints: list/feed, detail, create (POST to /articles/)
    const publicListEndpoints = [`${articleApiBase}/feed/`, `${articleApiBase}/`];
    const reporterListEndpoints = [`${articleApiBase}/reporter/articles/`, `${articleApiBase}/`];
    // Try the explicit 'create' action endpoint first (some API deployments
    // require POST to '/articles/create/') and fall back to the collection
    // root '/articles/' for compatibility.
    const createEndpoints = [`${articleApiBase}/create/`, `${articleApiBase}/`];
    const statusActionMap = {
        submitted: 'submit',
        under_review: 'start-review',
        approved: 'approve',
        published: 'publish',
        rejected: 'reject',
        archived: 'archive'
    };

    const state = {
        user: null,
        articles: [],
        response: null,
        page: 1,
        endpoint: publicListEndpoints[0],
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
        publishedCount: document.getElementById('publishedArticles'),
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
        publishedCheckbox: document.getElementById('articlePublished')
    };

    function normalizeStatus(article) {
        if (article?.is_published === true || article?.published === true) {
            return 'published';
        }

        const status = Api.getValue(article, ['status', 'state', 'publication_status'], '');
        if (status) {
            return String(status).toLowerCase();
        }

        return Api.getValue(article, ['published_at', 'publish_date', 'published_on'], '') ? 'published' : 'draft';
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
        const staffFirstName = Api.getValue(state.user, ['first_name'], '');
        const staffLastName = Api.getValue(state.user, ['last_name'], '');
        const staffName = `${staffFirstName || ''} ${staffLastName || ''}`.trim();

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
        ], staffName || Api.getValue(state.user, ['full_name', 'name', 'username', 'email'], 'Unknown author'));
    }

    function getArticleImage(article) {
        return Api.getValue(article, ['image', 'image_url', 'thumbnail', 'thumbnail_url', 'featured_image', 'cover_image', 'media.url'], '');
    }

    function getPublishedDisplay(article) {
        const dateValue = Api.getValue(article, ['published_at', 'publish_date', 'published_on', 'created_at'], '');
        const formattedDate = Api.formatDate(dateValue);

        if (formattedDate !== 'Not available') {
            return formattedDate;
        }

        return isPublished(article) ? 'Published' : 'Not published';
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
                    <td class="article-meta-muted">${escape(getPublishedDisplay(article))}</td>
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
        els.publishedCount.textContent = items.filter(isPublished).length;
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
        const defaultStatus = els.modal?.dataset?.defaultStatus || 'submitted';
        els.id.value = '';
        els.title.value = '';
        els.category.value = '';
        els.articleStatus.value = defaultStatus;
        els.image.value = '';
        els.description.value = '';
        els.body.value = '';
        els.featuredArticle.checked = false;
        els.publishedCheckbox.checked = defaultStatus === 'published';
        els.status.textContent = '';
        els.modalTitle.textContent = 'Create New Article';
        els.save.textContent = 'Create Article';
        resetImageState();
        els.modal.classList.remove('hidden');
    }

    async function loadArticleDetail(id) {
        try {
            const detail = await Api.request('GET', `${articleApiBase}/${id}/`, { auth: hasAuth });
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
        els.publishedCheckbox.checked = isPublished(record);
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

    function normalizeCreateStatus(value) {
        const status = String(value || 'submitted').trim().toLowerCase().replace(/[\s-]+/g, '_');
        if (status === 'pending' || status === 'pending_review') {
            return 'submitted';
        }
        if (['draft', 'submitted', 'under_review', 'approved', 'published', 'rejected', 'archived'].includes(status)) {
            return status;
        }
        return 'submitted';
    }

    function collectPayload(statusOverride = null) {
        const status = normalizeCreateStatus(
            statusOverride || (els.publishedCheckbox.checked ? 'published' : els.articleStatus.value) || 'submitted'
        );
        const imageUrl = els.image.value.trim();
        const categoryValue = els.category.value.trim();
        const body = els.body.value.trim();
        const summary = els.description.value.trim() || body.slice(0, 500);

        // If an image file is attached, use FormData so binary upload is supported.
        if (state.imageFile) {
            const formData = new FormData();
            formData.append('title', els.title.value.trim());
            formData.append('body', body);
            formData.append('summary', summary);

            if (categoryValue) {
                if (/^\d+$/.test(categoryValue)) {
                    formData.append('category_id', String(Number(categoryValue)));
                } else {
                    formData.append('category_name', categoryValue);
                }
            }

            formData.append('image', state.imageFile);

            return { data: formData, desiredStatus: status, isForm: true };
        }

        // Otherwise send a plain object (JSON) — many APIs expect JSON for
        // non-file requests and stricter validation may reject multipart.
        const payload = {
            title: els.title.value.trim(),
            body,
            summary
        };

        if (categoryValue) {
            if (/^\d+$/.test(categoryValue)) {
                payload.category_id = Number(categoryValue);
            } else {
                payload.category_name = categoryValue;
            }
        }

        if (state.imageCleared) {
            payload.image = '';
        } else if (imageUrl) {
            payload.image = imageUrl;
        }

        return { data: payload, desiredStatus: status, isForm: false };
    }

    async function appendCurrentStaffAuthor(formData) {
        if (!hasAuth) {
            return;
        }

        try {
            const user = state.user || await window.NewsPortalSession.fetchCurrentUser();
            const name = [
                Api.getValue(user, ['first_name'], ''),
                Api.getValue(user, ['last_name'], '')
            ].filter(Boolean).join(' ').trim()
                || Api.getValue(user, ['full_name', 'name', 'username', 'email'], '');

            if (!name) return;

            // Support both FormData and plain object payloads.
            if (formData instanceof FormData || (typeof FormData !== 'undefined' && formData instanceof FormData)) {
                if (!formData.has('author_name')) {
                    formData.append('author_name', name);
                }
            } else if (typeof formData === 'object' && formData !== null) {
                if (!formData.author_name) {
                    formData.author_name = name;
                }
            }
        } catch {}
    }

    async function applyArticleStatus(article, desiredStatus) {
        const articleId = Api.getValue(article, ['id'], null);
        const normalizedStatus = normalizeCreateStatus(desiredStatus);
        const action = statusActionMap[normalizedStatus];

        if (!articleId || !action || normalizeStatus(article) === normalizedStatus) {
            return article;
        }

        const updated = await Api.request('POST', `${articleApiBase}/${articleId}/${action}/`, {
            data: {},
            auth: true,
            timeoutMs: 30000
        });

        return updated || { ...article, status: normalizedStatus };
    }

    async function saveArticle() {
        const id = els.id.value;
        const payload = collectPayload();

        if (!els.title.value.trim()) {
            els.status.textContent = 'Title is required.';
            return;
        }

        // Log intent and key payload info for debugging in DevTools
        // minimal logging: keep silent unless errors occur

        els.save.disabled = true;
        els.status.textContent = id ? 'Saving article...' : 'Creating article...';

        try {
            let savedArticle = null;
            if (id) {
                savedArticle = await ArticleService.updateArticle(id, payload.data, { auth: true });
                try {
                    savedArticle = await applyArticleStatus(savedArticle || { id }, payload.desiredStatus);
                } catch (statusError) {
                    console.warn('Failed to apply desired status after update:', statusError);
                    // keep savedArticle as returned from update; do not fail the whole flow
                }
            } else {
                await appendCurrentStaffAuthor(payload.data);
                // create attempt
                    try {
                        savedArticle = await Api.request('POST', createEndpoints[0], { data: payload.data, auth: true, timeoutMs: 30000 });
                    } catch (createError) {
                        console.warn('Staff: create failed', createError?.response || createError);
                        // If the create failed due to validation (400) and we used FormData (image attached),
                        // try creating without the image (JSON) and then upload the image via PATCH.
                        if (createError?.response?.status === 400 && payload.isForm && state.imageFile) {
                            try {
                                // build JSON payload from FormData entries excluding image
                                const jsonPayload = {};
                                try {
                                    for (const [k, v] of payload.data.entries()) {
                                        if (k === 'image') continue;
                                        // coerce single-value File/Blob references to strings where appropriate
                                        jsonPayload[k] = (v instanceof File || (typeof Blob !== 'undefined' && v instanceof Blob)) ? '' : v;
                                    }
                                } catch (e) {
                                    console.warn('Staff: failed to serialize FormData to JSON', e);
                                }

                                await appendCurrentStaffAuthor(jsonPayload);
                                savedArticle = await Api.request('POST', createEndpoints[0], { data: jsonPayload, auth: true, timeoutMs: 30000 });

                                // attempt to upload image via update
                                try {
                                    const imgForm = new FormData();
                                    imgForm.append('image', state.imageFile);
                                    await ArticleService.updateArticle(savedArticle?.id, imgForm, { auth: true });
                                } catch (imgErr) {
                                    console.warn('Staff: image upload after create failed', imgErr);
                                }

                            } catch (retryError) {
                                console.error('Staff: retry create without image failed', retryError);
                                throw createError;
                            }
                        } else {
                            throw createError;
                        }
                    }
                try {
                    savedArticle = await applyArticleStatus(savedArticle, payload.desiredStatus);
                } catch (statusError) {
                    console.warn('Failed to apply desired status after create:', statusError);
                    // creation succeeded; continue and show success to user
                }
            }

            // show a success toast so the user gets immediate feedback
            if (id) {
                showToast('Article updated successfully.', 'success');
            } else {
                showToast('Article created successfully.', 'success');
            }
            closeModal();
            Api.notifyDataChanged?.('articles', { action: id ? 'update' : 'create', id: savedArticle?.id || id || null });
            await loadArticles(1);
        } catch (error) {
            console.error('Unable to save article:', error);
            try { console.error('Staff save error response', error?.response || error); } catch (e) {}
            const apiDetail = error?.response?.data?.detail || error?.response?.data?.message || '';
            els.status.textContent = apiDetail || 'Unable to save article. Check required fields and permissions.';
        } finally {
            els.save.disabled = false;
        }
    }

    async function removeArticle(article) {
        if (!window.confirm(`Delete "${getArticleTitle(article)}"? This cannot be undone.`)) {
            return;
        }

        try {
            await ArticleService.deleteArticle(article.id, { auth: true });
            Api.notifyDataChanged?.('articles', { action: 'delete', id: article.id });
            await loadArticles(1);
        } catch (error) {
            console.error('Unable to delete article:', error);
            window.alert('Unable to delete this article. Check your permissions and try again.');
        }
    }

    function mergeArticleLists(...lists) {
        const byKey = new Map();

        lists.flat().forEach((article) => {
            const key = article?.id || article?.slug || `${article?.title || ''}-${article?.published_at || ''}`;
            if (key) {
                byKey.set(String(key), article);
            }
        });

        return [...byKey.values()];
    }

    async function hydrateArticleDetails(records) {
        const items = records || [];
        const details = await Promise.all(items.map(async (article) => {
            if (!article?.id) {
                return article;
            }

            try {
                const detail = await Api.request('GET', `${articleApiBase}/${article.id}/`, { auth: false, timeoutMs: 10000 });
                return { ...article, ...(detail || {}) };
            } catch {
                return article;
            }
        }));

        return details;
    }

    async function loadVisibleArticles(page) {
        const publicResult = await Api.loadList(publicListEndpoints, page, {
            auth: false,
            params: {
                ordering: '-id'
            }
        });

        let reporterRecords = [];
        if (hasAuth) {
            try {
                const reporterResult = await Api.loadList(reporterListEndpoints, page, {
                    auth: true,
                    params: {
                        ordering: '-id'
                    }
                });
                reporterRecords = reporterResult.data.results || [];
            } catch (error) {
                console.warn('Reporter article list unavailable; showing public feed.', error);
            }
        }

        return {
            endpoint: publicResult.endpoint,
            data: {
                ...publicResult.data,
                count: undefined,
                results: await hydrateArticleDetails(mergeArticleLists(publicResult.data.results || [], reporterRecords))
            }
        };
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
            const result = await loadVisibleArticles(page);

            state.endpoint = result.endpoint || state.endpoint;
            state.response = result.data;
            state.page = page;

            const records = result.data.results.map((item) => ArticleService.normalizeArticle ? ArticleService.normalizeArticle(item) : item);
            state.articles = Utils.sortByNewest(records);

            updateSummary(state.articles, state.articles.length);
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
    els.articleStatus.addEventListener('change', () => {
        els.publishedCheckbox.checked = normalizeCreateStatus(els.articleStatus.value) === 'published';
    });
    els.publishedCheckbox.addEventListener('change', () => {
        if (els.publishedCheckbox.checked) {
            els.articleStatus.value = 'published';
        } else if (normalizeCreateStatus(els.articleStatus.value) === 'published') {
            els.articleStatus.value = els.modal?.dataset?.defaultStatus || 'submitted';
        }
    });
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

    // Simple toast helper
    function showToast(message, type = 'info', timeout = 3000) {
        try {
            const existing = document.getElementById('staff-toast-container') || (() => {
                const el = document.createElement('div');
                el.id = 'staff-toast-container';
                el.className = 'staff-toast-container';
                document.body.appendChild(el);
                return el;
            })();

            const t = document.createElement('div');
            t.className = `staff-toast staff-toast--${type}`;
            t.textContent = message;
            existing.appendChild(t);

            window.setTimeout(() => {
                t.classList.add('staff-toast--hide');
                window.setTimeout(() => t.remove(), 350);
            }, timeout);
        } catch (e) {
            console.warn('Toast failed', e);
        }
    }

    window.addEventListener('pageshow', () => loadArticles(state.page));
    Api.onDataChanged?.((event) => {
        if (event?.type === 'articles') {
            loadArticles(1);
        }
    });
})();
