let currentCategoryPage = 1;
let lastCategoryResponse = null;
let currentCategories = [];
let activeCategoryEndpoint = null;

const CATEGORY_ENDPOINTS = ['/articles/categories/'];

const categoriesTableBody = document.getElementById('categoriesTableBody');
const prevCategoryBtn = document.getElementById('prevCategoryBtn');
const nextCategoryBtn = document.getElementById('nextCategoryBtn');
const categoryPageInfo = document.getElementById('categoryPageInfo');
const refreshCategoriesBtn = document.getElementById('refreshCategoriesBtn');
const categorySearchInput = document.getElementById('categorySearchInput');
const totalCategories = document.getElementById('totalCategories');
const activeCategories = document.getElementById('activeCategories');
const featuredCategories = document.getElementById('featuredCategories');
const linkedArticles = document.getElementById('linkedArticles');
const visibleCategoriesCount = document.getElementById('visibleCategoriesCount');
const categoryModal = document.getElementById('categoryModal');
const openCategoryModalBtn = document.getElementById('openCategoryModalBtn');
const closeCategoryModalBtn = document.getElementById('closeCategoryModalBtn');

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

function getCategoryName(category) {
    return normalizeText(
        getNestedValue(category, ['name', 'title', 'label', 'category_name']),
        'Untitled category'
    );
}

function getCategoryDescription(category) {
    return normalizeText(
        getNestedValue(category, ['description', 'summary', 'details']),
        'No description added'
    );
}

function getCategorySlug(category) {
    return normalizeText(
        getNestedValue(category, ['slug', 'code', 'key']),
        getCategoryName(category).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    );
}

function getCategoryStatus(category) {
    if (category.is_active === true || category.active === true) {
        return 'Active';
    }

    if (category.is_active === false || category.active === false) {
        return 'Inactive';
    }

    return normalizeText(getNestedValue(category, ['status', 'state']), 'Active');
}

function isActive(category) {
    return getCategoryStatus(category).toLowerCase() === 'active';
}

function isFeatured(category) {
    return Boolean(getNestedValue(category, ['is_featured', 'featured', 'show_on_homepage', 'homepage']));
}

function getArticleCount(category) {
    const value = getNestedValue(category, [
        'article_count',
        'articles_count',
        'news_count',
        'posts_count',
        'count'
    ]);

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

function getCreatedDate(category) {
    return getNestedValue(category, ['created_at', 'created_on', 'date_created']);
}

function getUpdatedDate(category) {
    return getNestedValue(category, ['updated_at', 'modified_at', 'created_at']);
}

function getCategoryUrl(category) {
    return getNestedValue(category, ['url', 'absolute_url', 'link']);
}

function getCategoryInitial(category) {
    return getCategoryName(category).trim().charAt(0).toUpperCase() || 'C';
}

function setTableMessage(message, type = 'muted') {
    categoriesTableBody.innerHTML = `
        <tr class="${type}-row">
            <td colspan="8">${escapeHTML(message)}</td>
        </tr>
    `;
}

function getStatusClass(status) {
    const key = status.toLowerCase();

    if (key.includes('active') && !key.includes('inactive')) {
        return 'status-active';
    }

    if (key.includes('archive')) {
        return 'status-archived';
    }

    return 'status-inactive';
}

function renderCategoryActions(category) {
    const url = getCategoryUrl(category);
    const name = getCategoryName(category);
    const viewAction = url
        ? `<a href="${escapeHTML(url)}" target="_blank" rel="noopener" title="View category" aria-label="View ${escapeHTML(name)}">
                <i class="fa-regular fa-eye"></i>
            </a>`
        : `<button type="button" title="View category" aria-label="View ${escapeHTML(name)}">
                <i class="fa-regular fa-eye"></i>
            </button>`;

    return `
        <div class="row-actions">
            ${viewAction}
            <button type="button" title="Edit category" aria-label="Edit ${escapeHTML(name)}">
                <i class="fa-regular fa-pen-to-square"></i>
            </button>
        </div>
    `;
}

function renderCategories(categories) {
    const query = categorySearchInput.value.trim().toLowerCase();
    const filteredCategories = categories.filter((category) => {
        const searchable = [
            getCategoryName(category),
            getCategoryDescription(category),
            getCategorySlug(category),
            getCategoryStatus(category)
        ].join(' ').toLowerCase();

        return searchable.includes(query);
    });

    visibleCategoriesCount.textContent = `${filteredCategories.length} categor${filteredCategories.length === 1 ? 'y' : 'ies'} shown`;

    if (!filteredCategories.length) {
        setTableMessage(query ? 'No categories match your search.' : 'No categories found.');
        return;
    }

    categoriesTableBody.innerHTML = filteredCategories.map((category) => {
        const name = getCategoryName(category);
        const description = getCategoryDescription(category);
        const status = getCategoryStatus(category);
        const featured = isFeatured(category);

        return `
            <tr>
                <td>
                    <div class="category-cell">
                        <span class="category-icon">${escapeHTML(getCategoryInitial(category))}</span>
                        <div class="category-title-wrap">
                            <strong>${escapeHTML(name)}</strong>
                            <span class="category-description">${escapeHTML(description)}</span>
                        </div>
                    </div>
                </td>
                <td><span class="slug-pill">${escapeHTML(getCategorySlug(category))}</span></td>
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
                <td class="category-meta-muted">${escapeHTML(getArticleCount(category))}</td>
                <td class="category-meta-muted">${escapeHTML(formatDate(getCreatedDate(category)))}</td>
                <td class="category-meta-muted">${escapeHTML(formatDate(getUpdatedDate(category)))}</td>
                <td>${renderCategoryActions(category)}</td>
            </tr>
        `;
    }).join('');
}

function updateSummary(categories, totalCount) {
    totalCategories.textContent = totalCount ?? categories.length;
    activeCategories.textContent = categories.filter(isActive).length;
    featuredCategories.textContent = categories.filter(isFeatured).length;
    linkedArticles.textContent = categories.reduce((total, category) => total + getArticleCount(category), 0);
}

function updatePagination(data) {
    prevCategoryBtn.disabled = !data.previous;
    nextCategoryBtn.disabled = !data.next;
    categoryPageInfo.textContent = `Page ${currentCategoryPage}`;
}

async function fetchCategoriesFromEndpoint(endpoint, page) {
    const separator = endpoint.includes('?') ? '&' : '?';
    const response = await api.get(apiUrl(`${endpoint}${separator}page=${page}`));

    return response.data;
}

async function fetchCategories(page) {
    const endpoints = activeCategoryEndpoint
        ? [activeCategoryEndpoint, ...CATEGORY_ENDPOINTS.filter((endpoint) => endpoint !== activeCategoryEndpoint)]
        : CATEGORY_ENDPOINTS;

    let lastError = null;

    for (const endpoint of endpoints) {
        try {
            const data = await fetchCategoriesFromEndpoint(endpoint, page);
            activeCategoryEndpoint = endpoint;
            return data;
        } catch (error) {
            lastError = error;
        }
    }

    throw lastError;
}

async function loadCategories(page = 1) {
    setTableMessage('Loading categories...', 'loading');

    try {
        const data = await fetchCategories(page);
        const categories = Array.isArray(data) ? data : (data.results || []);

        currentCategoryPage = page;
        lastCategoryResponse = Array.isArray(data)
            ? { previous: null, next: null, count: categories.length }
            : data;
        currentCategories = categories;

        updateSummary(currentCategories, lastCategoryResponse.count);
        renderCategories(currentCategories);
        updatePagination(lastCategoryResponse);
    } catch (error) {
        console.error('Error loading categories:', error);
        const notFound = error?.response?.status === 404;
        const message = notFound
            ? 'Category API endpoint is not available yet.'
            : 'Unable to load categories. Please check the API token or try again.';

        setTableMessage(message);
        updateSummary([], 0);
        updatePagination({ previous: null, next: null });
    }
}

prevCategoryBtn.addEventListener('click', () => {
    if (lastCategoryResponse?.previous && currentCategoryPage > 1) {
        loadCategories(currentCategoryPage - 1);
    }
});

nextCategoryBtn.addEventListener('click', () => {
    if (lastCategoryResponse?.next) {
        loadCategories(currentCategoryPage + 1);
    }
});

refreshCategoriesBtn.addEventListener('click', () => loadCategories(currentCategoryPage));
categorySearchInput.addEventListener('input', () => renderCategories(currentCategories));

openCategoryModalBtn.addEventListener('click', () => categoryModal.classList.remove('hidden'));
closeCategoryModalBtn.addEventListener('click', () => categoryModal.classList.add('hidden'));
categoryModal.addEventListener('click', (event) => {
    if (event.target === categoryModal) {
        categoryModal.classList.add('hidden');
    }
});

document.addEventListener('DOMContentLoaded', () => loadCategories());
