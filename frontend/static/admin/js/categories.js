let currentCategoryPage = 1;
let lastCategoryResponse = null;
let currentCategories = [];
let activeCategoryEndpoint = '/articles/categories/';

const CATEGORY_ENDPOINTS = ['/articles/categories/', 'articles/categories/', '/categories/', 'categories/'];

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
const categoryModalTitle = document.getElementById('categoryModalTitle');
const openCategoryModalBtn = document.getElementById('openCategoryModalBtn');
const closeCategoryModalBtn = document.getElementById('closeCategoryModalBtn');
const saveCategoryBtn = document.getElementById('saveCategoryBtn');
const categoryFormStatus = document.getElementById('categoryFormStatus');

const categoryFields = {
    id: document.getElementById('categoryId'),
    name: document.getElementById('categoryName'),
    slug: document.getElementById('categorySlug'),
    description: document.getElementById('categoryDescription'),
    active: document.getElementById('categoryActive'),
    featured: document.getElementById('categoryFeatured')
};

const { escapeHTML, formatDate, getValue, loadList, setMessage, createItem, updateItem, deleteItem } = ResourceHelpers;

function normalize(value, fallback = 'Not available') {
    return value === null || value === undefined || value === '' ? fallback : String(value);
}

function getCategoryName(category) {
    return normalize(getValue(category, ['name', 'title', 'label', 'category_name']), 'Untitled category');
}

function getCategoryDescription(category) {
    return normalize(getValue(category, ['description', 'summary', 'details']), 'No description added');
}

function getCategorySlug(category) {
    return normalize(
        getValue(category, ['slug', 'code', 'key']),
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

    return normalize(getValue(category, ['status', 'state']), 'Active');
}

function isActive(category) {
    return getCategoryStatus(category).toLowerCase() === 'active';
}

function isFeatured(category) {
    return Boolean(getValue(category, ['is_featured', 'featured', 'show_on_homepage', 'homepage']));
}

function getArticleCount(category) {
    const value = getValue(category, ['article_count', 'articles_count', 'news_count', 'posts_count', 'count'], 0);
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

function getStatusClass(status) {
    const key = status.toLowerCase();

    if (key.includes('active') && !key.includes('inactive')) {
        return 'status-active';
    }

    return 'status-inactive';
}

function renderCategories(categories) {
    const query = categorySearchInput.value.trim().toLowerCase();
    const filteredCategories = categories.filter((category) => [
        getCategoryName(category),
        getCategoryDescription(category),
        getCategorySlug(category),
        getCategoryStatus(category)
    ].join(' ').toLowerCase().includes(query));

    visibleCategoriesCount.textContent = `${filteredCategories.length} categor${filteredCategories.length === 1 ? 'y' : 'ies'} shown`;

    if (!filteredCategories.length) {
        setMessage(categoriesTableBody, 8, query ? 'No categories match your search.' : 'No categories found.');
        return;
    }

    categoriesTableBody.innerHTML = filteredCategories.map((category) => {
        const name = getCategoryName(category);
        const status = getCategoryStatus(category);
        const featured = isFeatured(category);

        return `
            <tr>
                <td>
                    <div class="category-cell">
                        <span class="category-icon">${escapeHTML(name.trim().charAt(0).toUpperCase() || 'C')}</span>
                        <div class="category-title-wrap">
                            <strong>${escapeHTML(name)}</strong>
                            <span class="category-description">${escapeHTML(getCategoryDescription(category))}</span>
                        </div>
                    </div>
                </td>
                <td><span class="slug-pill">${escapeHTML(getCategorySlug(category))}</span></td>
                <td><span class="status-pill ${getStatusClass(status)}">${escapeHTML(status)}</span></td>
                <td><span class="feature-pill ${featured ? 'feature-yes' : 'feature-no'}">${featured ? 'Featured' : 'Standard'}</span></td>
                <td class="category-meta-muted">${escapeHTML(getArticleCount(category))}</td>
                <td class="category-meta-muted">${escapeHTML(formatDate(getValue(category, ['created_at', 'created_on', 'date_created'])))}</td>
                <td class="category-meta-muted">${escapeHTML(formatDate(getValue(category, ['updated_at', 'modified_at', 'created_at'])))}</td>
                <td>
                    <div class="row-actions">
                        <button type="button" data-action="edit" data-id="${escapeHTML(category.id)}" title="Edit category" aria-label="Edit ${escapeHTML(name)}">
                            <i class="fa-regular fa-pen-to-square"></i>
                        </button>
                        <button class="danger-action" type="button" data-action="delete" data-id="${escapeHTML(category.id)}" title="Delete category" aria-label="Delete ${escapeHTML(name)}">
                            <i class="fa-regular fa-trash-can"></i>
                        </button>
                    </div>
                </td>
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

async function loadCategories(page = 1) {
    setMessage(categoriesTableBody, 8, 'Loading categories...', 'loading');

    try {
        const result = await loadList(CATEGORY_ENDPOINTS, page);
        activeCategoryEndpoint = result.endpoint;
        currentCategoryPage = page;
        lastCategoryResponse = result.data;
        currentCategories = result.data.results;

        updateSummary(currentCategories, result.data.count);
        renderCategories(currentCategories);
        updatePagination(result.data);
    } catch (error) {
        console.error('Error loading categories:', error);
        setMessage(categoriesTableBody, 8, 'Unable to load categories. Please check the API token or try again.');
        updateSummary([], 0);
        updatePagination({ previous: null, next: null });
    }
}

function resetForm() {
    categoryFields.id.value = '';
    categoryFields.name.value = '';
    categoryFields.slug.value = '';
    categoryFields.description.value = '';
    categoryFields.active.checked = true;
    categoryFields.featured.checked = false;
    categoryFormStatus.textContent = '';
}

function openCreateModal() {
    resetForm();
    categoryModalTitle.textContent = 'Create New Category';
    saveCategoryBtn.textContent = 'Create Category';
    categoryModal.classList.remove('hidden');
}

function openEditModal(category) {
    resetForm();
    categoryFields.id.value = category.id || '';
    categoryFields.name.value = getCategoryName(category) === 'Untitled category' ? '' : getCategoryName(category);
    categoryFields.slug.value = getCategorySlug(category);
    categoryFields.description.value = getValue(category, ['description', 'summary', 'details'], '');
    categoryFields.active.checked = isActive(category);
    categoryFields.featured.checked = isFeatured(category);
    categoryModalTitle.textContent = 'Edit Category';
    saveCategoryBtn.textContent = 'Save Changes';
    categoryModal.classList.remove('hidden');
}

function closeModal() {
    categoryModal.classList.add('hidden');
}

function buildPayload() {
    return {
        name: categoryFields.name.value.trim()
    };
}

async function saveCategory() {
    const id = categoryFields.id.value;
    const payload = buildPayload();

    if (!payload.name) {
        categoryFormStatus.textContent = 'Name is required.';
        return;
    }

    saveCategoryBtn.disabled = true;
    categoryFormStatus.textContent = id ? 'Saving category...' : 'Creating category...';

    try {
        if (id) {
            await updateItem(activeCategoryEndpoint, id, payload);
        } else {
            await createItem([activeCategoryEndpoint, ...CATEGORY_ENDPOINTS], payload);
        }
        closeModal();
        await loadCategories(currentCategoryPage);
    } catch (error) {
        console.error('Unable to save category:', error);
        categoryFormStatus.textContent = 'Unable to save category. Check required fields and permissions.';
    } finally {
        saveCategoryBtn.disabled = false;
    }
}

async function removeCategory(category) {
    if (!window.confirm(`Delete "${getCategoryName(category)}"? This cannot be undone.`)) {
        return;
    }

    try {
        await deleteItem(activeCategoryEndpoint, category.id);
        await loadCategories(currentCategoryPage);
    } catch (error) {
        console.error('Unable to delete category:', error);
        window.alert('Unable to delete this category. Check your permissions and try again.');
    }
}

categoriesTableBody.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-action]');

    if (!button) {
        return;
    }

    const category = currentCategories.find((item) => String(item.id) === String(button.dataset.id));

    if (!category) {
        return;
    }

    if (button.dataset.action === 'edit') {
        openEditModal(category);
    }

    if (button.dataset.action === 'delete') {
        removeCategory(category);
    }
});

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
openCategoryModalBtn.addEventListener('click', openCreateModal);
closeCategoryModalBtn.addEventListener('click', closeModal);
saveCategoryBtn.addEventListener('click', saveCategory);
categoryModal.addEventListener('click', (event) => {
    if (event.target === categoryModal) {
        closeModal();
    }
});

document.addEventListener('DOMContentLoaded', () => loadCategories());
