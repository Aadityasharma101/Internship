let currentArticlePage = 1;
let lastArticleResponse = null;
let currentArticles = [];
let activeArticleEndpoint = '/articles/feed/';

// The article service is mounted at the site root, unlike Users/Roles/Ads
// which are mounted below /api/.
const ARTICLE_ENDPOINTS = ['/articles/feed/', '/articles/reporter/articles/'];
const ARTICLE_MUTATION_ENDPOINTS = ['/articles/create/'];

const articlesTableBody = document.getElementById('articlesTableBody');
const prevArticleBtn = document.getElementById('prevArticleBtn');
const nextArticleBtn = document.getElementById('nextArticleBtn');
const articlePageInfo = document.getElementById('articlePageInfo');
const refreshArticlesBtn = document.getElementById('refreshArticlesBtn');
const articleSearchInput = document.getElementById('articleSearchInput');
const totalArticles = document.getElementById('totalArticles');
const publishedArticles = document.getElementById('publishedArticles');
const draftArticles = document.getElementById('draftArticles');
const featuredArticles = document.getElementById('featuredArticles');
const visibleArticlesCount = document.getElementById('visibleArticlesCount');
const articleModal = document.getElementById('articleModal');
const articleModalTitle = document.getElementById('articleModalTitle');
const openArticleModalBtn = document.getElementById('openArticleModalBtn');
const closeArticleModalBtn = document.getElementById('closeArticleModalBtn');
const saveArticleBtn = document.getElementById('saveArticleBtn');
const articleFormStatus = document.getElementById('articleFormStatus');

const articleFields = {
    id: document.getElementById('articleId'),
    title: document.getElementById('articleTitle'),
    category: document.getElementById('articleCategory'),
    status: document.getElementById('articleStatus'),
    image: document.getElementById('articleImage'),
    description: document.getElementById('articleDescription'),
    body: document.getElementById('articleBody'),
    featured: document.getElementById('articleFeatured'),
    published: document.getElementById('articlePublished')
};

const { escapeHTML, formatDate, formatApiError, getValue, loadList, setMessage, createItem, updateItem, deleteItem } = ResourceHelpers;

function text(value, fallback = 'Not available') {
    return value === null || value === undefined || value === '' ? fallback : String(value);
}

function getArticleTitle(article) {
    return text(getValue(article, ['title', 'headline', 'name']), 'Untitled article');
}

function getArticleExcerpt(article) {
    return text(getValue(article, ['excerpt', 'summary', 'description', 'content', 'body']), 'No summary added');
}

function getArticleCategory(article) {
    return text(getValue(article, ['category.name', 'category.category_name', 'category.title', 'category', 'category_name']), 'Uncategorized');
}

function getArticleAuthor(article) {
    const firstName = getValue(article, ['author.first_name', 'user.first_name']);
    const lastName = getValue(article, ['author.last_name', 'user.last_name']);
    const fullName = `${firstName || ''} ${lastName || ''}`.trim();

    return text(fullName || getValue(article, [
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
    ]), 'Unknown author');
}

function getArticleImage(article) {
    return getValue(article, ['image', 'image_url', 'thumbnail', 'thumbnail_url', 'featured_image', 'cover_image', 'media.url']);
}

function getArticleStatus(article) {
    if (article.is_published === true || article.published === true) {
        return 'Published';
    }

    if (article.is_published === false || article.published === false) {
        return 'Draft';
    }

    return text(getValue(article, ['status', 'state', 'publication_status']), 'Draft');
}

function isPublished(article) {
    return getArticleStatus(article).toLowerCase() === 'published';
}

function isFeatured(article) {
    return Boolean(getValue(article, ['is_featured', 'featured', 'is_trending', 'trending']));
}

function renderArticleImage(article) {
    const image = getArticleImage(article);
    const title = getArticleTitle(article);

    if (image) {
        return `<img class="article-thumb" src="${escapeHTML(image)}" alt="${escapeHTML(title)}">`;
    }

    return `<span class="article-thumb-fallback" aria-hidden="true"><i class="fa-regular fa-newspaper"></i></span>`;
}

function statusClass(status) {
    const key = status.toLowerCase();

    if (key.includes('publish')) {
        return 'status-published';
    }

    if (key.includes('archive') || key.includes('inactive')) {
        return 'status-archived';
    }

    return 'status-draft';
}

function renderArticles(articles) {
    const query = articleSearchInput.value.trim().toLowerCase();
    const filteredArticles = articles.filter((article) => [
        getArticleTitle(article),
        getArticleExcerpt(article),
        getArticleCategory(article),
        getArticleAuthor(article),
        getArticleStatus(article)
    ].join(' ').toLowerCase().includes(query));

    visibleArticlesCount.textContent = `${filteredArticles.length} article${filteredArticles.length === 1 ? '' : 's'} shown`;

    if (!filteredArticles.length) {
        setMessage(articlesTableBody, 8, query ? 'No articles match your search.' : 'No articles found.');
        return;
    }

    articlesTableBody.innerHTML = filteredArticles.map((article) => {
        const title = getArticleTitle(article);
        const status = getArticleStatus(article);
        const featured = isFeatured(article);
        const url = article.id ? `/news/${article.id}/` : getValue(article, ['url', 'absolute_url', 'link']);

        return `
            <tr>
                <td>
                    <div class="article-cell">
                        ${renderArticleImage(article)}
                        <div class="article-title-wrap">
                            <strong>${escapeHTML(title)}</strong>
                            <span class="article-excerpt">${escapeHTML(getArticleExcerpt(article))}</span>
                        </div>
                    </div>
                </td>
                <td><span class="category-pill">${escapeHTML(getArticleCategory(article))}</span></td>
                <td>${escapeHTML(getArticleAuthor(article))}</td>
                <td><span class="status-pill ${statusClass(status)}">${escapeHTML(status)}</span></td>
                <td><span class="feature-pill ${featured ? 'feature-yes' : 'feature-no'}">${featured ? 'Featured' : 'Standard'}</span></td>
                <td class="article-meta-muted">${escapeHTML(formatDate(getValue(article, ['published_at', 'publish_date', 'published_on', 'created_at'])))}</td>
                <td class="article-meta-muted">${escapeHTML(formatDate(getValue(article, ['updated_at', 'modified_at', 'created_at'])))}</td>
                <td>
                    <div class="row-actions">
                        <a href="${escapeHTML(url || '#')}" target="_blank" rel="noopener" title="View article" aria-label="View ${escapeHTML(title)}">
                            <i class="fa-regular fa-eye"></i>
                        </a>
                        <button type="button" data-action="edit" data-id="${escapeHTML(article.id)}" title="Edit article" aria-label="Edit ${escapeHTML(title)}">
                            <i class="fa-regular fa-pen-to-square"></i>
                        </button>
                        <button class="danger-action" type="button" data-action="delete" data-id="${escapeHTML(article.id)}" title="Delete article" aria-label="Delete ${escapeHTML(title)}">
                            <i class="fa-regular fa-trash-can"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function updateSummary(articles, totalCount) {
    totalArticles.textContent = totalCount ?? articles.length;
    publishedArticles.textContent = articles.filter(isPublished).length;
    draftArticles.textContent = articles.filter((article) => !isPublished(article)).length;
    featuredArticles.textContent = articles.filter(isFeatured).length;
}

function updatePagination(data) {
    prevArticleBtn.disabled = !data.previous;
    nextArticleBtn.disabled = !data.next;
    articlePageInfo.textContent = `Page ${currentArticlePage}`;
}

async function loadArticles(page = 1) {
    setMessage(articlesTableBody, 8, 'Loading articles...', 'loading');

    try {
        const result = await loadList(ARTICLE_ENDPOINTS, page);
        activeArticleEndpoint = result.endpoint;
        currentArticlePage = page;
        lastArticleResponse = result.data;
        currentArticles = result.data.results;

        updateSummary(currentArticles, result.data.count);
        renderArticles(currentArticles);
        updatePagination(result.data);
    } catch (error) {
        console.error('Error loading articles:', error);
        setMessage(articlesTableBody, 8, 'Unable to load articles. Please check the API token or try again.');
        updateSummary([], 0);
        updatePagination({ previous: null, next: null });
    }
}

function resetForm() {
    Object.values(articleFields).forEach((field) => {
        if (field.type === 'checkbox') {
            field.checked = false;
        } else {
            field.value = '';
        }
    });
    articleFields.status.value = 'draft';
    articleFormStatus.textContent = '';
}

function openCreateModal() {
    resetForm();
    articleModalTitle.textContent = 'Create New Article';
    saveArticleBtn.textContent = 'Create Article';
    articleModal.classList.remove('hidden');
}

function openEditModal(article) {
    resetForm();
    articleFields.id.value = article.id || '';
    articleFields.title.value = getArticleTitle(article) === 'Untitled article' ? '' : getArticleTitle(article);
    articleFields.category.value = getValue(article, ['category.id', 'category.name', 'category.category_name', 'category', 'category_name'], '');
    articleFields.status.value = getArticleStatus(article).toLowerCase();
    articleFields.image.value = getArticleImage(article) || '';
    articleFields.description.value = getValue(article, ['description', 'summary', 'excerpt'], '');
    articleFields.body.value = getValue(article, ['body', 'content'], '');
    articleFields.featured.checked = isFeatured(article);
    articleFields.published.checked = isPublished(article);
    articleModalTitle.textContent = 'Edit Article';
    saveArticleBtn.textContent = 'Save Changes';
    articleModal.classList.remove('hidden');
}

function closeModal() {
    articleModal.classList.add('hidden');
}

function buildPayload() {
    const category = articleFields.category.value.trim();
    const payload = {
        title: articleFields.title.value.trim(),
        status: articleFields.status.value,
        description: articleFields.description.value.trim(),
        body: articleFields.body.value.trim(),
        is_featured: articleFields.featured.checked,
        featured: articleFields.featured.checked,
        is_published: articleFields.published.checked || articleFields.status.value === 'published',
        published: articleFields.published.checked || articleFields.status.value === 'published'
    };

    if (category) {
        payload.category = /^\d+$/.test(category) ? Number(category) : category;
    }

    if (articleFields.image.value.trim()) {
        payload.image = articleFields.image.value.trim();
        payload.image_url = articleFields.image.value.trim();
    }

    return payload;
}

function buildCreatePayload(payload) {
    const createPayload = { ...payload };

    if (payload.status === 'published') {
        createPayload.published_at = new Date().toISOString();
    }

    return createPayload;
}

async function saveArticle() {
    const id = articleFields.id.value;
    const payload = buildPayload();

    if (!payload.title) {
        articleFormStatus.textContent = 'Title is required.';
        return;
    }

    saveArticleBtn.disabled = true;
    articleFormStatus.textContent = id ? 'Saving article...' : 'Creating article...';

    try {
        if (id) {
            try {
                await api.patch(apiUrl(`/articles/${id}/update/`), payload);
            } catch (error) {
                if (error?.response?.status !== 405) {
                    throw error;
                }
                await api.put(apiUrl(`/articles/${id}/update/`), payload);
            }
        } else {
            await createItem(ARTICLE_MUTATION_ENDPOINTS, buildCreatePayload(payload));
        }
        closeModal();
        await loadArticles(currentArticlePage);
    } catch (error) {
        console.error('Unable to save article:', error);
        articleFormStatus.textContent = formatApiError(error, 'Unable to save article. Check required fields and permissions.');
    } finally {
        saveArticleBtn.disabled = false;
    }
}

async function removeArticle(article) {
    if (!window.confirm(`Delete "${getArticleTitle(article)}"? This cannot be undone.`)) {
        return;
    }

    try {
        await api.delete(apiUrl(`/articles/${article.id}/delete/`));
        await loadArticles(currentArticlePage);
    } catch (error) {
        console.error('Unable to delete article:', error);
        window.alert('Unable to delete this article. Check your permissions and try again.');
    }
}

articlesTableBody.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-action]');

    if (!button) {
        return;
    }

    const article = currentArticles.find((item) => String(item.id) === String(button.dataset.id));

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

prevArticleBtn.addEventListener('click', () => {
    if (lastArticleResponse?.previous && currentArticlePage > 1) {
        loadArticles(currentArticlePage - 1);
    }
});

nextArticleBtn.addEventListener('click', () => {
    if (lastArticleResponse?.next) {
        loadArticles(currentArticlePage + 1);
    }
});

refreshArticlesBtn.addEventListener('click', () => loadArticles(currentArticlePage));
articleSearchInput.addEventListener('input', () => renderArticles(currentArticles));
openArticleModalBtn.addEventListener('click', openCreateModal);
closeArticleModalBtn.addEventListener('click', closeModal);
saveArticleBtn.addEventListener('click', saveArticle);
articleModal.addEventListener('click', (event) => {
    if (event.target === articleModal) {
        closeModal();
    }
});

document.addEventListener('DOMContentLoaded', () => loadArticles());
