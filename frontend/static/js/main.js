// Main JavaScript for News Portal Frontend
// This file keeps site-wide utilities and live navbar data in sync with the API.

const DEFAULT_API_BASE = '/api';

document.addEventListener('DOMContentLoaded', () => {
    initActiveNav();
    initLiveNavbar();
    // refresh navbar data periodically so counts/categories reflect new backend inserts
    setInterval(initLiveNavbar, 15000);
});

function getApiBase() {
    return document.body?.dataset?.apiBase || DEFAULT_API_BASE;
}

// Utility function to fetch data from REST API with mock fallback
async function fetchFromAPI(endpoint, options = {}) {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 15000);

    const baseUrl = getApiBase().replace(/\/$/, '');
    const cleanEndpoint = endpoint.replace(/^\//, '');

    try {
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
        console.warn('Error fetching from API, attempting mock fallback:', error);
        const mock = getMock(cleanEndpoint);
        if (mock) {
            return mock;
        }
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

// --- Mock data and helpers (used when remote API returns 404/unavailable) ---
function getMock(endpoint) {
    const e = endpoint.replace(/\?.*$/, '').replace(/^\/+/, '');

    // Feed mock
    if (e.startsWith('articles/feed')) {
        return {
            count: 3,
            results: [
                { id: 101, title: 'Mock: City inaugurates new park', description: 'A new public park opened today...', published_at: '2026-06-10T12:00:00Z', image_url: '', category_name: 'Local' },
                { id: 102, title: 'Mock: Tech startup raises funds', description: 'Startup secures seed round...', published_at: '2026-06-09T09:30:00Z', image_url: '', category_name: 'Business' },
                { id: 103, title: 'Mock: Sports team wins final', description: 'Local team clinches the championship...', published_at: '2026-06-08T20:15:00Z', image_url: '', category_name: 'Sports' },
            ],
        };
    }

    // Trending mock
    if (e.startsWith('articles/trending')) {
        return [
            { id: 201, title: 'Mock Trending: Election updates', description: 'Key moments from the election...', published_at: '2026-06-10T18:00:00Z' },
            { id: 202, title: 'Mock Trending: Weather alert', description: 'Severe weather expected...', published_at: '2026-06-10T06:00:00Z' },
        ];
    }

    // Categories mock
    if (e.startsWith('articles/categories')) {
        return [
            { id: 1, name: 'Top' },
            { id: 2, name: 'Local' },
            { id: 3, name: 'Business' },
            { id: 4, name: 'Sports' },
        ];
    }

    // Article detail mock
    if (/^articles\/\d+\/$/.test(e) || /^articles\/\d+$/.test(e)) {
        const idMatch = e.match(/articles\/(\d+)/);
        const id = idMatch ? Number(idMatch[1]) : 999;
        return { id, title: `Mock Article ${id}`, description: 'Full article content (mock).', body: 'This is mock article content used when the API is unreachable.' };
    }

    return null;
}
