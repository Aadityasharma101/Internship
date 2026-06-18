const preferenceConfig = window.preferenceConfig || {};
const preferenceState = {
    page: 1,
    response: null,
    items: [],
    endpoint: preferenceConfig.endpoints?.[0] || '/'
};

const prefEls = {
    tbody: document.getElementById('preferenceTableBody'),
    prev: document.getElementById('prevPreferenceBtn'),
    next: document.getElementById('nextPreferenceBtn'),
    pageInfo: document.getElementById('preferencePageInfo'),
    refresh: document.getElementById('refreshPreferenceBtn'),
    search: document.getElementById('preferenceSearchInput'),
    visible: document.getElementById('visiblePreferenceCount'),
    total: document.getElementById('totalPreferences'),
    users: document.getElementById('preferenceUsers'),
    articles: document.getElementById('preferenceArticles'),
    latest: document.getElementById('latestPreference')
};

const PR = ResourceHelpers;

function valueFor(item, keys, fallback = '') {
    return PR.getValue(item, keys, fallback);
}

function userName(item) {
    const first = valueFor(item, ['user.first_name', 'author.first_name']);
    const last = valueFor(item, ['user.last_name', 'author.last_name']);
    return `${first || ''} ${last || ''}`.trim() || valueFor(item, [
        'user.full_name',
        'user.name',
        'user.username',
        'user.email',
        'author.name',
        'author.username',
        'email'
    ], 'Unknown user');
}

function articleTitle(item) {
    return valueFor(item, [
        'article.title',
        'article.headline',
        'news.title',
        'post.title',
        'title',
        'article_title'
    ], 'Unknown article');
}

function renderCell(item, column) {
    const value = valueFor(item, column.keys, column.fallback || '');

    if (column.type === 'user') {
        return `<div class="primary-cell"><strong>${PR.escapeHTML(userName(item))}</strong><span>${PR.escapeHTML(valueFor(item, ['user.email', 'email'], 'No email available'))}</span></div>`;
    }

    if (column.type === 'article') {
        return `<div class="primary-cell"><strong>${PR.escapeHTML(articleTitle(item))}</strong><span>${PR.escapeHTML(valueFor(item, ['article.category.name', 'category', 'article.category'], 'Uncategorized'))}</span></div>`;
    }

    if (column.type === 'date') {
        return PR.escapeHTML(PR.formatDate(value));
    }

    if (column.type === 'pill') {
        return `<span class="pill ${column.className || 'pill-blue'}">${PR.escapeHTML(value || column.fallback || 'Not available')}</span>`;
    }

    return PR.escapeHTML(value || column.fallback || 'Not available');
}

function renderPreferences(items) {
    const query = prefEls.search.value.trim().toLowerCase();
    const filtered = items.filter((item) => JSON.stringify(item).toLowerCase().includes(query));

    prefEls.visible.textContent = `${filtered.length} ${preferenceConfig.itemPlural || 'records'} shown`;

    if (!filtered.length) {
        PR.setMessage(prefEls.tbody, preferenceConfig.columns.length, query ? 'No records match your search.' : 'No records found.');
        return;
    }

    prefEls.tbody.innerHTML = filtered.map((item) => `
        <tr>
            ${preferenceConfig.columns.map((column) => `<td>${renderCell(item, column)}</td>`).join('')}
        </tr>
    `).join('');
}

function updateSummary(items, totalCount) {
    prefEls.total.textContent = totalCount ?? items.length;

    const users = new Set(items.map(userName).filter(Boolean));
    const articles = new Set(items.map(articleTitle).filter(Boolean));
    prefEls.users.textContent = users.size;
    prefEls.articles.textContent = articles.size;

    const latest = items
        .map((item) => valueFor(item, ['created_at', 'updated_at', 'reacted_at', 'bookmarked_at']))
        .filter(Boolean)
        .sort()
        .pop();
    prefEls.latest.textContent = latest ? PR.formatDate(latest) : 'None';
}

function updatePagination(data) {
    prefEls.prev.disabled = !data.previous;
    prefEls.next.disabled = !data.next;
    prefEls.pageInfo.textContent = `Page ${preferenceState.page}`;
}

async function loadPreferences(page = 1) {
    PR.setMessage(prefEls.tbody, preferenceConfig.columns.length, `Loading ${preferenceConfig.itemPlural || 'records'}...`, 'loading');

    try {
        const result = await PR.loadList(preferenceConfig.endpoints, page);
        preferenceState.endpoint = result.endpoint;
        preferenceState.page = page;
        preferenceState.response = result.data;
        preferenceState.items = result.data.results;
        updateSummary(preferenceState.items, result.data.count);
        renderPreferences(preferenceState.items);
        updatePagination(result.data);
    } catch (error) {
        console.error(`Unable to load ${preferenceConfig.itemPlural}:`, error);
        PR.setMessage(prefEls.tbody, preferenceConfig.columns.length, `Unable to load ${preferenceConfig.itemPlural || 'records'}. Check the API endpoint or permissions.`);
        updateSummary([], 0);
        updatePagination({ previous: null, next: null });
    }
}

prefEls.prev.addEventListener('click', () => {
    if (preferenceState.response?.previous && preferenceState.page > 1) {
        loadPreferences(preferenceState.page - 1);
    }
});

prefEls.next.addEventListener('click', () => {
    if (preferenceState.response?.next) {
        loadPreferences(preferenceState.page + 1);
    }
});

prefEls.refresh.addEventListener('click', () => loadPreferences(preferenceState.page));
prefEls.search.addEventListener('input', () => renderPreferences(preferenceState.items));

document.addEventListener('DOMContentLoaded', () => loadPreferences());
