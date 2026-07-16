// ============================================================
// News Portal — Homepage News JavaScript
// Loads feed, trending, featured story from the remote API
// ============================================================

const DEFAULT_MEDIA_BASE = 'https://news-portal-hvgs.onrender.com';
const FETCH_TIMEOUT_MS   = 15000;
const DETAIL_TIMEOUT_MS  = 10000;
const MAX_PARALLEL_DETAIL = 3;

let CURRENT_FEED = [];
let HOME_API_BASE = DEFAULT_MEDIA_BASE;

document.addEventListener('DOMContentLoaded', () => {
    const root = document.querySelector('.page-shell');
    if (!root) return;

    const apiBase = root.dataset.apiBase || document.body?.dataset?.apiBase || DEFAULT_MEDIA_BASE;
    HOME_API_BASE = apiBase;
    initializeHomepage(apiBase);
    startFeedPolling(apiBase, 20000);
});

window.addEventListener('pageshow', () => {
    initializeHomepage(HOME_API_BASE);
});

window.NewsPortalApi?.onDataChanged?.((event) => {
    if (event?.type === 'articles') {
        initializeHomepage(HOME_API_BASE);
    }
});

// ============================================================
// MEDIA URL
// ============================================================
function getMediaBase() {
    return (document.body?.dataset?.mediaBase || DEFAULT_MEDIA_BASE).replace(/\/$/, '');
}

// ============================================================
// MAIN INITIALISER
// ============================================================
async function initializeHomepage(apiBase) {
    const featuredHero    = document.getElementById('featured-hero');
    const latestGrid      = document.getElementById('latest-news-grid');
    const trendingGrid    = document.getElementById('trending-news-grid');

    try {
        const [feedResult, trendingResult] = await Promise.allSettled([
            fetchJson(`${apiBase}/articles/feed/?ordering=-id`),
            fetchJson(`${apiBase}/articles/trending/`),
        ]);

        const feedArticles     = extractArticles(feedResult.status     === 'fulfilled' ? feedResult.value     : null);
        const trendingArticles = extractArticles(trendingResult.status === 'fulfilled' ? trendingResult.value : null);

        CURRENT_FEED = feedArticles.slice();

        const latestArticles  = take(feedArticles.length ? feedArticles : trendingArticles, 6).map(mergeArticleData);
        const trendingCards   = take(trendingArticles, 5).map(mergeArticleData);
        const featuredArticle = mergeArticleData(feedArticles[0] || trendingArticles[0] || null);

        renderFeaturedHero(featuredHero, featuredArticle);
        renderNewsGrid(latestGrid, latestArticles);
        renderTrendingGrid(trendingGrid, trendingCards);
        updateBreakingHeadline(featuredArticle);
        updateCategoryFilter(categoriesFromArticles(feedArticles, trendingArticles));

        if (!feedArticles.length && !trendingArticles.length) {
            renderError(latestGrid, 'No articles available at the moment. Please check back soon.');
        }
        if (!trendingArticles.length && !feedArticles.length) {
            renderError(trendingGrid, 'No trending stories available.');
        }

        // Attempt to load article images (detail endpoint)
        hydrateArticleImages(apiBase, [
            { articles: [featuredArticle].filter(Boolean), render: () => renderFeaturedHero(featuredHero, featuredArticle) },
            { articles: latestArticles,                    render: () => renderNewsGrid(latestGrid, latestArticles) },
            { articles: trendingCards,                     render: () => renderTrendingGrid(trendingGrid, trendingCards) },
        ]);

    } catch (err) {
        console.error('Homepage load error:', err);
        renderError(featuredHero, 'Could not load the featured story right now.');
        renderError(latestGrid,   'Latest news is unavailable at the moment.');
        renderError(trendingGrid, 'Trending stories are unavailable.');
    }
}

// ============================================================
// POLLING
// ============================================================
function startFeedPolling(apiBase, intervalMs = 20000) {
    setInterval(async () => {
        try {
            const fresh = await fetchJson(`${apiBase}/articles/feed/?ordering=-id`);
            const articles = extractArticles(fresh);
            if (!articles.length) return;

            const newestId = articles[0]?.id;
            if (newestId && newestId !== CURRENT_FEED[0]?.id) {
                CURRENT_FEED = articles.slice();
                const latest    = take(CURRENT_FEED, 6).map(mergeArticleData);
                const featured  = mergeArticleData(CURRENT_FEED[0]);
                renderFeaturedHero(document.getElementById('featured-hero'), featured);
                renderNewsGrid(document.getElementById('latest-news-grid'), latest);
                updateBreakingHeadline(featured);
            }
        } catch { /* silently ignore polling errors */ }
    }, intervalMs);
}

// ============================================================
// FETCH HELPERS
// ============================================================
async function fetchJson(url, timeoutMs = FETCH_TIMEOUT_MS) {
    const ctrl = new AbortController();
    const tid  = window.setTimeout(() => ctrl.abort(), timeoutMs);
    const freshUrl = addFreshParam(url);
    try {
        const res = await fetch(freshUrl, {
            headers: {
                Accept: 'application/json'
            },
            signal: ctrl.signal,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
    } finally {
        window.clearTimeout(tid);
    }
}

function addFreshParam(url) {
    const target = new URL(url, window.location.origin);
    target.searchParams.set('_', String(Date.now()));
    return target.toString();
}

function extractArticles(payload) {
    if (!payload)                          return [];
    if (Array.isArray(payload))            return payload;
    if (Array.isArray(payload.results))    return payload.results;
    if (payload.id || payload.title)       return [payload];
    return [];
}

function take(arr, n) { return arr.slice(0, n); }

// ============================================================
// ARTICLE DATA NORMALISATION
// ============================================================
function mergeArticleData(base, detail = null) {
    if (!base && !detail) return null;
    const combined = { ...(base || {}), ...(detail || {}) };
    combined.summary       = getSummary(combined);
    combined.displayDate   = formatDate(combined.published_at);
    combined.imageUrl      = resolveMediaUrl(extractImageSource(combined));
    combined.categoryLabel = combined.category_name || combined.category || 'News';
    combined.authorLabel   = combined.author_name || 'News Desk';
    return combined;
}

function extractImageSource(article) {
    if (!article) return '';
    const keys = ['image','image_url','thumbnail','thumbnail_url','photo','photo_url',
                  'cover_image','cover_image_url','featured_image','featured_image_url',
                  'banner','banner_url','media','media_url','preview','preview_url'];
    for (const k of keys) {
        if (article[k]) return article[k];
    }
    return '';
}

function resolveMediaUrl(url) {
    if (!url) return '';
    if (typeof url === 'object') {
        return resolveMediaUrl(url.url || url.src || url.path || url.file || url.image || '');
    }
    const v = String(url).trim();
    if (!v) return '';
    if (/^https?:\/\//i.test(v) || v.startsWith('data:')) return v;
    const base = getMediaBase();
    if (v.startsWith('/media/')) return `${base}${v}`;
    if (v.startsWith('media/'))  return `${base}/${v}`;
    if (v.startsWith('/'))       return `${base}${v}`;
    return `${base}/media/${v}`;
}

function getSummary(article) {
    if (!article) return '';
    if (article.summary) return article.summary;
    const src = article.body || article.description || '';
    if (!src) return 'Read the full story for more details.';
    return truncate(src, 160);
}

function truncate(text, limit) {
    const clean = String(text).replace(/\s+/g, ' ').trim();
    return clean.length <= limit ? clean : `${clean.slice(0, limit).trimEnd()}...`;
}

function formatDate(dateStr) {
    if (!dateStr) return 'Recently';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'Recently';
    const now  = new Date();
    const diff = Math.floor((now - d) / 1000);
    if (diff < 60)    return 'Just now';
    if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function categoriesFromArticles(...lists) {
    const seen = new Set();
    const cats = [];
    lists.flat().forEach((a) => {
        const label = a?.category_name || a?.category || a?.categoryLabel;
        if (label && !seen.has(label)) { seen.add(label); cats.push(label); }
    });
    return cats;
}

// ============================================================
// RENDER FUNCTIONS
// ============================================================
function escapeHtml(str) {
    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function renderError(container, message) {
    if (!container) return;
    container.classList.remove('loading-state');
    container.innerHTML = `<div class="error-message"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-bottom:8px;opacity:.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg><br>${escapeHtml(message)}</div>`;
}

function renderFeaturedHero(container, article) {
    if (!container) return;
    container.classList.remove('loading-state');

    if (!article) {
        container.innerHTML = '<p style="padding:24px;color:var(--muted)">No featured story available.</p>';
        return;
    }
    const imgUrl = article.imageUrl || '/static/images/placeholder.svg';
    const img = `<img src="${escapeHtml(imgUrl)}" alt="${escapeHtml(article.title)}" class="featured-image">`;
    container.innerHTML = `
        <a href="/news/${escapeHtml(article.id)}/" class="featured-link">
            ${img}
            <h3 class="featured-title">${escapeHtml(article.title)}</h3>
            <p class="featured-summary">${escapeHtml(article.summary || article.description || '')}</p>
        </a>
    `;
}

function renderNewsGrid(container, articles) {
    if (!container) return;
    container.classList.remove('loading-state');

    if (!articles || !articles.length) {
        container.innerHTML = '<p style="color:var(--muted);padding:20px;text-align:center">No articles available.</p>';
        return;
    }

    container.innerHTML = articles.map((a, i) => {
        const thumb   = a.imageUrl || '';
        const imgHtml = thumb
            ? `<img src="${escapeHtml(thumb)}" alt="${escapeHtml(a.title)}" loading="${i < 3 ? 'eager' : 'lazy'}" onerror="this.parentElement.classList.add('no-img')">`
            : '';
        return `
        <article class="news-card">
            <a href="/news/${escapeHtml(a.id)}/">
                <div class="thumb"><img src="${escapeHtml(thumb)}" alt="${escapeHtml(a.title)}"></div>
                <h4>${escapeHtml(a.title)}</h4>
                <p class="excerpt">${escapeHtml(a.summary || a.description || '')}</p>
            </a>
        </article>
    `}).join('');
}

function renderTrendingGrid(container, cards) {
    if (!container) return;
    container.classList.remove('loading-state');

    if (!cards || !cards.length) {
        container.innerHTML = '<p style="color:var(--muted);font-size:13px">No trending stories.</p>';
        return;
    }

    container.innerHTML = cards.map((c, i) => `
        <div class="trending-item">
            <a href="/news/${escapeHtml(String(c.id))}/">
                <span class="trending-num">${i + 1}</span>
                <span>${escapeHtml(c.title || 'Story')}</span>
            </a>
        </div>
    `).join('');
}

function updateBreakingHeadline(article) {
    const el = document.getElementById('breaking-headline');
    if (el) el.textContent = article?.title || 'No breaking stories at this moment.';
}

function updateCategoryFilter(categories) {
    const container = document.getElementById('category-filter');
    if (!container) return;

    const labels = categories.length ? categories : [];
    const allBtn = `<button class="category-btn active" type="button" data-category="all">All</button>`;
    const catBtns = labels.map((label) =>
        `<button class="category-btn" type="button" data-category="${escapeHtml(label)}">${escapeHtml(label)}</button>`
    ).join('');

    container.innerHTML = allBtn + catBtns;

    container.querySelectorAll('.category-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
            container.querySelectorAll('.category-btn').forEach((b) => b.classList.remove('active'));
            btn.classList.add('active');
            // Category filtering is visual-only for now; full API filter can be wired here
        });
    });
}

// ============================================================
// IMAGE HYDRATION (fetch detail to get images not in feed)
// ============================================================
async function hydrateArticleImages(apiBase, sections) {
    const articleMap = new Map();
    sections.forEach(({ articles }) => {
        articles.forEach((a) => {
            if (a?.id && !articleMap.has(a.id)) articleMap.set(a.id, a);
        });
    });

    const needingImages = [...articleMap.values()].filter((a) => !a.imageUrl);
    if (!needingImages.length) return;

    const details = await mapConcurrent(
        needingImages.map((a) => a.id),
        MAX_PARALLEL_DETAIL,
        (id) => fetchArticleDetail(apiBase, id)
    );

    const detailMap = new Map();
    needingImages.forEach((a, i) => {
        if (details[i]) detailMap.set(a.id, details[i]);
    });

    if (!detailMap.size) return;

    sections.forEach(({ articles, render }) => {
        let updated = false;
        articles.forEach((a) => {
            const d = detailMap.get(a.id);
            if (!d) return;
            const merged = mergeArticleData(a, d);
            if (merged.imageUrl && merged.imageUrl !== a.imageUrl) {
                Object.assign(a, merged);
                updated = true;
            }
        });
        if (updated) render();
    });
}

async function fetchArticleDetail(apiBase, id) {
    if (!id) return null;
    try {
        const data = await fetchJson(`${apiBase}/articles/${id}/`, DETAIL_TIMEOUT_MS);
        if (!data || typeof data !== 'object' || !Object.keys(data).length) return null;
        return data;
    } catch {
        return null;
    }
}

async function mapConcurrent(items, limit, worker) {
    const results = new Array(items.length);
    let next = 0;

    async function run() {
        while (next < items.length) {
            const i = next++;
            results[i] = await worker(items[i], i);
        }
    }

    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
    return results;
}
