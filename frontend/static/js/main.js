// ============================================================
// News Portal — Main JavaScript
// Site-wide utilities: navbar, auth, ads
// ============================================================

const DEFAULT_API_BASE = 'https://news-portal-hvgs.onrender.com';
let ADS_REFRESH_TIMER = null;

function refreshAdvertisements() {
    if (!getAdsEndpoint()) return;
    initAdvertisements().catch(() => { });
}

function startAdvertisementPolling(intervalMs = 15000) {
    if (ADS_REFRESH_TIMER) {
        window.clearInterval(ADS_REFRESH_TIMER);
    }

    if (!getAdsEndpoint()) return;
    ADS_REFRESH_TIMER = window.setInterval(() => {
        refreshAdvertisements();
    }, intervalMs);
}

document.addEventListener('DOMContentLoaded', () => {
    initActiveNav();
    initLiveNavbar();
    // Fetch ads only when an endpoint is configured; missing ad routes create noisy console failures.
    if (getAdsEndpoint()) {
        refreshAdvertisements();
    }
});

window.addEventListener('focus', () => {
    refreshAdvertisements();
});

document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
        refreshAdvertisements();
    }
});

window.addEventListener('online', () => {
    refreshAdvertisements();
});

window.NewsPortalApi?.onDataChanged?.((event) => {
    if (event?.type === 'advertisements' || event?.type === 'articles') {
        refreshAdvertisements();
    }
});

// ============================================================
// API BASE
// ============================================================
function getApiBase() {
    const configured = (typeof window !== 'undefined' && window.NEWS_PORTAL_API_BASE) ? String(window.NEWS_PORTAL_API_BASE) : null;
    const bodyBase = document.body?.dataset?.apiBase || '';
    let base = configured || bodyBase || DEFAULT_API_BASE;
    base = base.replace(/\/+$/, '');
    // Ensure the API base includes the '/api' segment
    if (!/\/api(\/|$)/i.test(base)) {
        base = base + '/api';
    }
    return base;
}

function buildApiUrl(endpoint) {
    if (!endpoint) return '';

    const clean = endpoint.replace(/^\//, '');
    const isLocalAdsEndpoint = /^(api\/ads|ads|advertisements)\//i.test(clean);

    if (isLocalAdsEndpoint) {
        return new URL(`/${clean}`, window.location.origin).toString();
    }

    if (/^https?:\/\//i.test(endpoint)) {
        return endpoint;
    }

    const base = getApiBase();
    return `${base}/${clean}`;
}

// ============================================================
// GENERIC FETCH WITH TIMEOUT
// ============================================================
async function fetchJson(url, options = {}) {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), options.timeoutMs || 15000);

    try {
        const res = await fetch(url, {
            signal: controller.signal,
            headers: {
                Accept: 'application/json',
                ...(options.headers || {}),
            },
            ...(options.body ? { method: options.method || 'POST', body: options.body } : {}),
        });

        if (!res.ok) {
            throw new Error(`HTTP ${res.status}`);
        }
        return await res.json();
    } finally {
        window.clearTimeout(timeoutId);
    }
}

// Legacy alias used by other parts of the codebase
async function fetchFromAPI(endpoint, options = {}) {
    try {
        return await fetchJson(buildApiUrl(endpoint), options);
    } catch {
        return getMock(endpoint.replace(/\?.*$/, '').replace(/^\//, ''));
    }
}

async function fetchJsonEndpoint(endpoint, options = {}) {
    return fetchJson(buildApiUrl(endpoint), options);
}

// ============================================================
// HELPERS
// ============================================================
function extractList(payload) {
    if (Array.isArray(payload)) return payload;
    return payload && Array.isArray(payload.results) ? payload.results : [];
}

function extractCount(payload) {
    if (!payload) return 0;
    if (typeof payload.count === 'number') return payload.count;
    if (Array.isArray(payload)) return payload.length;
    return 0;
}

function escapeHtml(str) {
    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// ============================================================
// LIVE NAVBAR
// ============================================================
function initLiveNavbar() {
    const categoryContainer = document.getElementById('nav-categories');
    const liveChip = document.getElementById('nav-live-count');

    if (!categoryContainer && !liveChip) return;

    Promise.allSettled([
        fetchFromAPI('articles/categories/'),
        fetchFromAPI('articles/feed/?ordering=-id'),
    ]).then(([catResult, feedResult]) => {
        const categories = extractList(catResult.status === 'fulfilled' ? catResult.value : null);
        const count = extractCount(feedResult.status === 'fulfilled' ? feedResult.value : null);

        if (categoryContainer) renderCategoryChips(categoryContainer, categories);

        if (liveChip) {
            const textEl = liveChip.querySelector('.live-text');
            if (textEl) {
                textEl.textContent = count > 0
                    ? `${count} live ${count === 1 ? 'story' : 'stories'}`
                    : 'Live';
            } else {
                liveChip.textContent = count > 0 ? `${count} live stories` : 'Live';
            }
        }
    });
}

function initActiveNav() {
    const currentPath = window.location.pathname.replace(/\/$/, '') || '/';
    document.querySelectorAll('.nav-link').forEach((link) => {
        try {
            const linkPath = new URL(link.href, location.origin).pathname.replace(/\/$/, '') || '/';
            if (linkPath === currentPath) {
                link.setAttribute('aria-current', 'page');
                link.classList.add('active');
            }
        } catch { }
    });
}

function navigateToCategory(category) {
    const url = new URL(window.location.origin);
    url.pathname = '/';
    if (category && category !== 'all') {
        url.searchParams.set('category', category);
    }
    window.location.href = url.toString();
}

function renderCategoryChips(container, categories) {
    container.innerHTML = '';
    if (!categories.length) return;

    categories.forEach((cat) => {
        const label = cat.name || cat.title || cat.label || cat.slug || 'Category';
        const value = encodeURIComponent(cat.slug || label);
        const chip = document.createElement('a');
        chip.href = `/?category=${value}`;
        chip.className = 'category-chip';
        chip.textContent = label;
        chip.setAttribute('data-category', value);
        container.appendChild(chip);
    });
}

// ============================================================
// ADVERTISEMENTS
// Ads endpoint may not exist; silently skip on any error.
// Ad slots remain hidden (display:none) until .has-ad is added.
// ============================================================

function getAdsEndpoint() {
    const configured = document.body?.dataset?.adsEndpoint?.trim() || '';
    if (configured) return configured;
    return '/api/ads/';
}

async function fetchAdvertisements() {
    const endpoint = getAdsEndpoint();
    if (!endpoint) return null;
    const url = buildApiUrl(endpoint);
    // Add cache buster to force fresh ads from server
    const cacheBusterUrl = url + (url.includes('?') ? '&' : '?') + '_=' + Date.now();
    return fetchJson(cacheBusterUrl, { timeoutMs: 8000 });
}

async function initAdvertisements() {
    const adSlots = document.querySelectorAll('[data-ad-slot]');
    if (!adSlots.length) return;

    let payload;
    try {
        payload = await fetchAdvertisements();
    } catch (error) {
        console.warn('Advertisement fetch failed:', error);
        payload = null;
    }

    if (!payload) return;

    const adsByPosition = normalizeAdsPayload(payload);
    let rendered = false;

    adSlots.forEach((slot) => {
        const position = slot.dataset.adSlot;
        const ad = adsByPosition[position] || getFallbackAdForSlot(position, adsByPosition, payload);
        if (ad) {
            renderAdSlot(slot, ad, position);
            rendered = true;
        }
    });

    if (!rendered) {
        console.warn('No visible advertisement could be rendered for the current page.', payload);
    }
}

function getFallbackAdForSlot(position, adsByPosition, payload) {
    if (adsByPosition[position]) {
        return adsByPosition[position];
    }

    if (position === 'between_articles') {
        return adsByPosition.top_banner || adsByPosition.footer_banner || null;
    }

    if (position === 'sidebar') {
        return adsByPosition.top_banner || adsByPosition.footer_banner || null;
    }

    if (position === 'footer_banner') {
        return adsByPosition.footer_banner || adsByPosition.top_banner || null;
    }

    if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
        const remoteAd = payload[position] || payload.top_banner || payload.footer || payload.in_article || null;
        return remoteAd ? normalizeAdvertisement(remoteAd) : null;
    }

    return null;
}

function normalizeAdsPayload(payload) {
    const positions = ['top_banner', 'sidebar', 'between_articles', 'in_article', 'footer_banner', 'footer', 'popup'];
    const grouped = Object.fromEntries(positions.map((p) => [p, null]));

    if (!payload) return grouped;

    const objectPayload = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : null;
    const list = Array.isArray(payload)
        ? payload
        : (Array.isArray(payload?.results) ? payload.results : []);
    const visibleAds = (list || []).filter((ad) => isVisibleAdvertisement(ad));

    if (objectPayload) {
        const objectAds = [];
        positions.forEach((position) => {
            const slotValue = objectPayload[position];
            const candidate = Array.isArray(slotValue)
                ? (slotValue.find((entry) => isVisibleAdvertisement(entry)) || null)
                : (isVisibleAdvertisement(slotValue) ? slotValue : null);

            if (candidate) {
                objectAds.push(candidate);
            }
        });

        if (objectAds.length) {
            objectAds.forEach((ad) => {
                const normalizedPosition = normalizeAdPosition(ad?.position || ad?.placement || ad?.slot);
                if (normalizedPosition && grouped[normalizedPosition] === null) {
                    grouped[normalizedPosition] = normalizeAdvertisement(ad);
                }
            });
        }
    }

    if (visibleAds.length) {
        visibleAds.forEach((ad) => {
            const position = normalizeAdPosition(ad?.position || ad?.placement || ad?.slot);
            if (position && grouped[position] === null) {
                grouped[position] = normalizeAdvertisement(ad);
            }
        });
    }

    if (!visibleAds.length && objectPayload?.results) {
        const fallbackAd = (Array.isArray(objectPayload.results) ? objectPayload.results : []).find((entry) => isVisibleAdvertisement(entry));
        if (fallbackAd) {
            grouped.top_banner = normalizeAdvertisement(fallbackAd);
            grouped.between_articles = normalizeAdvertisement(fallbackAd);
            grouped.footer_banner = normalizeAdvertisement(fallbackAd);
        }
    }

    return grouped;
}

function normalizeAdvertisement(ad) {
    if (!ad) return null;

    const title = ad.title || ad.name || ad.campaign_name || 'Advertisement';
    const image = ad.image || ad.image_url || ad.banner || ad.media || '';
    const targetUrl = ad.target_url || ad.redirect_url || ad.url || ad.link || '#';
    const clientName = ad.client_name || ad.sponsor || ad.company || 'Learn more';

    return {
        ...ad,
        title,
        client_name: clientName,
        image,
        image_url: image,
        target_url: targetUrl,
    };
}

function isVisibleAdvertisement(ad) {
    if (!ad) {
        return false;
    }

    const active = ad.is_active ?? ad.active;
    const status = String(ad.status || '').toLowerCase();

    if (active === false || ['inactive', 'disabled', 'draft', 'archived'].includes(status)) {
        return false;
    }

    const now = new Date();
    const startDate = ad.start_date ? new Date(ad.start_date) : null;
    const endDate = ad.end_date ? new Date(ad.end_date) : null;

    if (startDate && !Number.isNaN(startDate.getTime()) && now < startDate) {
        return false;
    }

    if (endDate && !Number.isNaN(endDate.getTime()) && now > endDate) {
        return false;
    }

    return true;
}

function normalizeAdPosition(value) {
    const raw = String(value || '').trim().toLowerCase().replace(/\s+/g, '_');

    if (!raw) {
        return 'between_articles';
    }

    const aliases = {
        in_article: 'between_articles',
        between_articles: 'between_articles',
        inline: 'between_articles',
        article_strip: 'between_articles',
        article: 'between_articles',
        footer: 'footer_banner',
        footer_banner: 'footer_banner',
        top_banner: 'top_banner',
        top: 'top_banner',
        sidebar: 'sidebar',
        sidebar_box: 'sidebar',
        side: 'sidebar',
        popup: 'popup',
    };

    if (aliases[raw]) {
        return aliases[raw];
    }

    if (raw.includes('top')) {
        return 'top_banner';
    }

    if (raw.includes('side')) {
        return 'sidebar';
    }

    if (raw.includes('footer')) {
        return 'footer_banner';
    }

    if (raw.includes('article') || raw.includes('strip')) {
        return 'between_articles';
    }

    return 'between_articles';
}

function renderAdSlot(slot, ad, position) {
    if (!ad) return; // slot stays hidden
    const isPopup = position === 'popup';

    if (isPopup && sessionStorage.getItem(`dismissed-ad-${ad.id}`)) return;

    slot.classList.remove('has-ad', 'is-empty');
    slot.innerHTML = '';
    slot.classList.add('has-ad');

    const card = buildAdCard(ad);

    if (isPopup) {
        const closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.className = 'ad-popup__close';
        closeBtn.setAttribute('aria-label', 'Close advertisement');
        closeBtn.innerHTML = '&times;';
        closeBtn.addEventListener('click', () => {
            if (ad.id) sessionStorage.setItem(`dismissed-ad-${ad.id}`, '1');
            slot.classList.remove('has-ad');
            slot.innerHTML = '';
        });
        slot.append(closeBtn, card);
    } else {
        slot.appendChild(card);
    }

    trackAdEvent(ad, 'impression');
}

function buildAdCard(ad) {
    const link = document.createElement('a');
    link.className = 'ad-card';
    link.href = ad.target_url || '#';
    link.target = '_blank';
    link.rel = 'noopener sponsored';
    link.setAttribute('aria-label', `${ad.title || 'Advertisement'} — sponsored`);
    link.addEventListener('click', () => trackAdEvent(ad, 'click'));

    const imageUrl = resolveAdMediaUrl(ad.image || ad.image_url || ad.banner || ad.media);
    if (imageUrl) {
        const img = document.createElement('img');
        img.src = imageUrl;
        img.alt = ad.title || 'Advertisement';
        img.loading = 'lazy';
        link.appendChild(img);
        return link;
    }

    const fallback = document.createElement('span');
    fallback.className = 'ad-card__fallback';
    fallback.innerHTML = `
        <span>
            <span class="ad-card__label">Sponsored</span>
            <span class="ad-card__title">${escapeHtml(ad.title || 'Advertisement')}</span>
        </span>
        <span class="ad-card__client">${escapeHtml(ad.client_name || 'Learn more')}</span>
    `;
    link.appendChild(fallback);
    return link;
}

function trackAdEvent(ad, type) {
    const tracker = window.NewsPortalAdvertisementService?.trackAdvertisementEvent;

    if (typeof tracker !== 'function') {
        return;
    }

    Promise.resolve(tracker(ad, type)).catch(() => { });
}

function resolveAdMediaUrl(value) {
    if (!value) return '';
    const url = String(value).trim();
    if (!url) return '';
    if (/^https?:\/\//i.test(url) || url.startsWith('data:')) return url;
    const mediaBase = (document.body?.dataset?.mediaBase || getApiBase()).replace(/\/$/, '');
    return url.startsWith('/') ? `${mediaBase}${url}` : `${mediaBase}/${url}`;
}

function slugifyCategory(label) {
    return String(label || '')
        .toLowerCase()
        .trim()
        .replace(/&/g, 'and')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

// ============================================================
// MOCK DATA (fallback when remote API is unreachable)
// ============================================================
function getMock(endpoint) {
    const e = endpoint.replace(/\?.*$/, '').replace(/^\/+/, '');

    if (e.includes('articles/feed') || e.includes('articles/feed')) {
        return {
            count: 3,
            results: [
                { id: 101, title: 'Breaking: Major Policy Announcement Expected Today', description: 'Officials are set to unveil a sweeping new initiative that could reshape the landscape for millions.', published_at: new Date().toISOString(), category_name: 'Politics' },
                { id: 102, title: 'Tech Giants Report Record Quarter Amid Market Uncertainty', description: 'Despite broader economic headwinds, leading technology companies have posted remarkable earnings.', published_at: new Date(Date.now() - 3600000).toISOString(), category_name: 'Business' },
                { id: 103, title: 'Climate Summit Concludes with Landmark Agreement', description: 'World leaders signed a historic pact aimed at dramatically reducing carbon emissions by 2035.', published_at: new Date(Date.now() - 7200000).toISOString(), category_name: 'World' },
            ],
        };
    }

    if (e.includes('articles/trending')) {
        return [
            { id: 201, title: 'Election Results Live: Every Update as They Come', published_at: new Date().toISOString() },
            { id: 202, title: 'Markets Rally Ahead of Central Bank Decision', published_at: new Date(Date.now() - 1800000).toISOString() },
            { id: 203, title: 'Sport: National Team Secures Historic Victory', published_at: new Date(Date.now() - 3600000).toISOString() },
        ];
    }

    if (e.includes('articles/categories')) {
        return [
            { id: 1, name: 'World' },
            { id: 2, name: 'Politics' },
            { id: 3, name: 'Business' },
            { id: 4, name: 'Sports' },
            { id: 5, name: 'Technology' },
        ];
    }

    if (/articles\/\d+/.test(e)) {
        const id = (e.match(/articles\/(\d+)/) || [])[1] || 999;
        return { id, title: `Article ${id}`, description: 'Full article content (mock).', body: 'This is placeholder content shown while the API is loading.' };
    }

    return null;
}

// ============================================================
// PUBLIC API
// ============================================================
window.NewsAds = {
    refresh: () => initAdvertisements().catch(() => { }),
    slugifyCategory,
};
