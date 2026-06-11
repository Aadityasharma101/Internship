// Main JavaScript for News Portal Frontend
// This file keeps site-wide utilities and live navbar data in sync with the API.

const DEFAULT_API_BASE = '/api';

document.addEventListener('DOMContentLoaded', () => {
    initActiveNav();
    initLiveNavbar();
});

function getApiBase() {
    return document.body?.dataset?.apiBase || DEFAULT_API_BASE;
}

// Utility function to fetch data from REST API
async function fetchFromAPI(endpoint, options = {}) {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 15000);

    try {
        const baseUrl = getApiBase().replace(/\/$/, '');
        const cleanEndpoint = endpoint.replace(/^\//, '');
        const response = await fetch(`${baseUrl}/${cleanEndpoint}`, {
            ...options,
            signal: controller.signal,
            headers: {
                Accept: 'application/json',
                ...(options.headers || {}),
            },
        });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error('Error fetching from API:', error);
        return null;
    } finally {
        window.clearTimeout(timeoutId);
    }
}

function extractList(payload) {
    if (Array.isArray(payload)) {
        return payload;
    }
    return payload && Array.isArray(payload.results) ? payload.results : [];
}

function extractCount(payload) {
    if (!payload) {
        return 0;
    }
    if (typeof payload.count === 'number') {
        return payload.count;
    }
    if (Array.isArray(payload)) {
        return payload.length;
    }
    return 0;
}

function initLiveNavbar() {
    const categoryContainer = document.getElementById('nav-categories');
    const statusChipText = document.getElementById('nav-live-count');

    if (!categoryContainer && !statusChipText) {
        return;
    }


    Promise.allSettled([
        fetchFromAPI('articles/categories/'),
        fetchFromAPI('articles/feed/'),
    ]).then(([categoriesResult, feedResult]) => {
        const categoriesPayload = categoriesResult.status === 'fulfilled' ? categoriesResult.value : null;
        const feedPayload = feedResult.status === 'fulfilled' ? feedResult.value : null;

        const categories = extractList(categoriesPayload);
        const articleCount = extractCount(feedPayload);

        if (categoryContainer) {
            renderCategoryChips(categoryContainer, categories);
        }

        if (statusChipText) {
            statusChipText.textContent = articleCount > 0
                ? `${articleCount} live ${articleCount === 1 ? 'story' : 'stories'}`
                : '0 live stories';
        }

    });
}

function initActiveNav() {
    const currentPath = window.location.pathname.replace(/\/$/, '') || '/';
    document.querySelectorAll('.site-nav__links a').forEach((link) => {
        const linkPath = new URL(link.href).pathname.replace(/\/$/, '') || '/';
        if (linkPath === currentPath) {
            link.setAttribute('aria-current', 'page');
        }
    });
}

function renderCategoryChips(container, categories) {
    container.innerHTML = '';

    if (!categories.length) {
        const emptyChip = document.createElement('span');
        emptyChip.className = 'category-chip';
        emptyChip.textContent = 'No live categories yet';
        container.appendChild(emptyChip);
        return;
    }

    categories.slice(0, 5).forEach((category) => {
        const chip = document.createElement('span');
        chip.className = 'category-chip';
        chip.textContent = category.name || category.title || category.label || category.slug || 'Category';
        container.appendChild(chip);
    });
}

// Utility function to handle API errors
function handleAPIError(error) {
    console.error('API Error:', error);
    // Display user-friendly error message
}
