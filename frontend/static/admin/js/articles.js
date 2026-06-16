let currentArticlePage = 1;
let lastArticleResponse = null;
let currentArticles = [];
let activeArticleEndpoint = null;

const ARTICLE_ENDPOINTS = ['/articles/feed/'];

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
const openArticleModalBtn = document.getElementById('openArticleModalBtn');
const closeArticleModalBtn = document.getElementById('closeArticleModalBtn');

function escapeHTML(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function formatDate(value) {
    if (!value) {
        return 'Not available';
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return 'Not available';
    }

    return new Intl.DateTimeFormat('en', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    }).format(date);
}

function normalizeText(value, fallback = 'Not available') {
    if (value === null || value === undefined || value === '') {
        return fallback;
    }

    return String(value);
}

function getNestedValue(source, keys) {
    for (const key of keys) {
        const value = key.split('.').reduce((item, part) => item?.[part], source);

        if (value !== null && value !== undefined && value !== '') {
            return value;
        }
    }

    return null;
}

function getArticleTitle(article) {
    return normalizeText(getNestedValue(article, ['title', 'headline', 'name']), 'Untitled article');
}

function getArticleExcerpt(article) {
    return normalizeText(
        getNestedValue(article, ['excerpt', 'summary', 'description', 'content', 'body']),
        'No summary added'
    );
}

function getArticleCategory(article) {
    return normalizeText(
        getNestedValue(article, [
            'category.name',
            'category.category_name',
            'category.title',
            'category',
            'category_name'
        ]),
        'Uncategorized'
    );
}

function getArticleAuthor(article) {
    const firstName = getNestedValue(article, ['author.first_name', 'user.first_name']);
    const lastName = getNestedValue(article, ['author.last_name', 'user.last_name']);
    const fullName = `${firstName || ''} ${lastName || ''}`.trim();

    return normalizeText(
        fullName || getNestedValue(article, [
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
        ]),
        'Unknown author'
    );
}

function getArticleImage(article) {
    return getNestedValue(article, [
        'image',
        'image_url',
        'thumbnail',
        'thumbnail_url',
        'featured_image',
        'cover_image',
        'media.url'
    ]);
}

function getArticleStatus(article) {
    if (article.is_published === true || article.published === true) {
        return 'Published';
    }

    if (article.is_published === false || article.published === false) {
        return 'Draft';
    }

    return normalizeText(getNestedValue(article, ['status', 'state', 'publication_status']), 'Draft');
}

function isPublished(article) {
    return getArticleStatus(article).toLowerCase() === 'published';
}

function isFeatured(article) {
    return Boolean(getNestedValue(article, ['is_featured', 'featured', 'is_trending', 'trending']));
}

function getPublishedDate(article) {
    return getNestedValue(article, ['published_at', 'publish_date', 'published_on', 'created_at']);
}

function getUpdatedDate(article) {
    return getNestedValue(article, ['updated_at', 'modified_at', 'created_at']);
}

function getArticleUrl(article) {
    return getNestedValue(article, ['url', 'absolute_url', 'link', 'slug']) || (article.id ? `/news/${article.id}/` : null);
}

function setTableMessage(message, type = 'muted') {
    articlesTableBody.innerHTML = `
        <tr class="${type}-row">
            <td colspan="8">${escapeHTML(message)}</td>
        </tr>
    `;
}

function getStatusClass(status) {
    const key = status.toLowerCase();

    if (key.includes('publish')) {
        return 'status-published';
    }

    if (key.includes('archive') || key.includes('inactive')) {
        return 'status-archived';
    }

    return 'status-draft';
}

function renderArticleImage(article) {
    const image = getArticleImage(article);
    const title = getArticleTitle(article);

    if (image) {
        return `<img class="article-thumb" src="${escapeHTML(image)}" alt="${escapeHTML(title)}">`;
    }

    return `
        <span class="article-thumb-fallback" aria-hidden="true">
            <i class="fa-regular fa-newspaper"></i>
        </span>
    `;
}

function renderArticleActions(article) {
    const url = getArticleUrl(article);
    const title = getArticleTitle(article);
    const viewAction = url
        ? `<a href="${escapeHTML(url)}" target="_blank" rel="noopener" title="View article" aria-label="View ${escapeHTML(title)}">
                <i class="fa-regular fa-eye"></i>
            </a>`
        : `<button type="button" title="View article" aria-label="View ${escapeHTML(title)}">
                <i class="fa-regular fa-eye"></i>
            </button>`;

    return `
        <div class="row-actions">
            ${viewAction}
            <button type="button" title="Edit article" aria-label="Edit ${escapeHTML(title)}">
                <i class="fa-regular fa-pen-to-square"></i>
            </button>
        </div>
    `;
}

function renderArticles(articles) {
    const query = articleSearchInput.value.trim().toLowerCase();
    const filteredArticles = articles.filter((article) => {
        const searchable = [
            getArticleTitle(article),
            getArticleExcerpt(article),
            getArticleCategory(article),
            getArticleAuthor(article),
            getArticleStatus(article)
        ].join(' ').toLowerCase();

        return searchable.includes(query);
    });

    visibleArticlesCount.textContent = `${filteredArticles.length} article${filteredArticles.length === 1 ? '' : 's'} shown`;

    if (!filteredArticles.length) {
        setTableMessage(query ? 'No articles match your search.' : 'No articles found.');
        return;
    }

    articlesTableBody.innerHTML = filteredArticles.map((article) => {
        const title = getArticleTitle(article);
        const excerpt = getArticleExcerpt(article);
        const category = getArticleCategory(article);
        const author = getArticleAuthor(article);
        const status = getArticleStatus(article);
        const featured = isFeatured(article);

        return `
            <tr>
                <td>
                    <div class="article-cell">
                        ${renderArticleImage(article)}
                        <div class="article-title-wrap">
                            <strong>${escapeHTML(title)}</strong>
                            <span class="article-excerpt">${escapeHTML(excerpt)}</span>
                        </div>
                    </div>
                </td>
                <td><span class="category-pill">${escapeHTML(category)}</span></td>
                <td>${escapeHTML(author)}</td>
                <td>
                    <span class="status-pill ${getStatusClass(status)}">
                        ${escapeHTML(status)}
                    </span>
                </td>
                <td>
                    <span class="feature-pill ${featured ? 'feature-yes' : 'feature-no'}">
                        ${featured ? 'Featured' : 'Standard'}
                    </span>
                </td>
                <td class="article-meta-muted">${escapeHTML(formatDate(getPublishedDate(article)))}</td>
                <td class="article-meta-muted">${escapeHTML(formatDate(getUpdatedDate(article)))}</td>
                <td>${renderArticleActions(article)}</td>
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

async function fetchArticlesFromEndpoint(endpoint, page) {
    const separator = endpoint.includes('?') ? '&' : '?';
    const response = await api.get(apiUrl(`${endpoint}${separator}page=${page}`));

    return response.data;
}

async function fetchArticles(page) {
    const endpoints = activeArticleEndpoint
        ? [activeArticleEndpoint, ...ARTICLE_ENDPOINTS.filter((endpoint) => endpoint !== activeArticleEndpoint)]
        : ARTICLE_ENDPOINTS;

    let lastError = null;

    for (const endpoint of endpoints) {
        try {
            const data = await fetchArticlesFromEndpoint(endpoint, page);
            activeArticleEndpoint = endpoint;
            return data;
        } catch (error) {
            lastError = error;
        }
    }

    throw lastError;
}

async function loadArticles(page = 1) {
    setTableMessage('Loading articles...', 'loading');

    try {
        const data = await fetchArticles(page);
        const articles = Array.isArray(data) ? data : (data.results || []);

        currentArticlePage = page;
        lastArticleResponse = Array.isArray(data)
            ? { previous: null, next: null, count: articles.length }
            : data;
        currentArticles = articles;

        updateSummary(currentArticles, lastArticleResponse.count);
        renderArticles(currentArticles);
        updatePagination(lastArticleResponse);
    } catch (error) {
        console.error('Error loading articles:', error);
        const notFound = error?.response?.status === 404;
        const message = notFound
            ? 'Article API endpoint is not available yet.'
            : 'Unable to load articles. Please check the API token or try again.';

        setTableMessage(message);
        updateSummary([], 0);
        updatePagination({ previous: null, next: null });
    }
}

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

openArticleModalBtn.addEventListener('click', () => articleModal.classList.remove('hidden'));
closeArticleModalBtn.addEventListener('click', () => articleModal.classList.add('hidden'));
articleModal.addEventListener('click', (event) => {
    if (event.target === articleModal) {
        articleModal.classList.add('hidden');
    }
});

document.addEventListener('DOMContentLoaded', () => loadArticles());
