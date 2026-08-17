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
let HOME_REFRESH_TIMER = null;
let CATEGORY_LABELS_BY_KEY = new Map();
let IS_LOADING = false; // Prevent concurrent re-initialization

// Debug helper: inspect article data from console
window.DEBUG_ARTICLES = {
    showFeed: () => console.table(CURRENT_FEED.slice(0, 3).map(a => ({ id: a.id, title: a.title, image: a.image, image_url: a.image_url, imageUrl: a.imageUrl }))),
    showFirst: () => console.log('First article:', CURRENT_FEED[0]),
    testExtract: (idx = 0) => { const a = CURRENT_FEED[idx]; console.log('Extracted image:', extractImageSource(a)); console.log('Article data:', a); }
};

function normalizeCategoryKey(value) {
    return String(value || '').trim().toLowerCase();
}

function getQueryParam(name) {
    return new URLSearchParams(window.location.search).get(name) || '';
}

function getSelectedCategoryKey() {
    const raw = getQueryParam('category');
    const normalized = normalizeCategoryKey(raw);
    return normalized || 'all';
}

function getCategoryLabelForKey(key) {
    if (!key) return '';
    const normalized = normalizeCategoryKey(key);
    return CATEGORY_LABELS_BY_KEY.get(normalized) || '';
}

function extractCategoryLabel(category) {
    if (!category) return '';
    return String(category.name || category.title || category.label || category.category_name || category.category || '').trim();
}

function extractCategoryKey(category) {
    if (!category) return '';
    return normalizeCategoryKey(category.slug || category.code || category.key || extractCategoryLabel(category));
}

function articleMatchesCategory(article, categoryKey) {
    if (!article || !categoryKey) return false;
    const normalizedCategory = normalizeCategoryKey(article.category_name || article.category || article.categoryLabel || '');
    const normalizedSlug = normalizeCategoryKey(
        (article.category && article.category.slug) || article.category_slug || article.categorySlug || ''
    );
    if (categoryKey === 'all') return true;
    if (normalizedCategory === categoryKey || normalizedSlug === categoryKey) return true;

    const mappedLabel = getCategoryLabelForKey(categoryKey);
    return mappedLabel ? normalizeCategoryKey(mappedLabel) === normalizedCategory : false;
}

function filterArticlesByCategory(articles, categoryKey) {
    if (!Array.isArray(articles) || !categoryKey || categoryKey === 'all') return articles || [];
    return articles.filter((article) => articleMatchesCategory(article, categoryKey));
}

function getCategoriesFromPayload(payload) {
    if (!payload) return [];
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload.results)) return payload.results;
    return [];
}

document.addEventListener('DOMContentLoaded', () => {
    const root = document.querySelector('.page-shell');
    if (!root) return;

    const apiBase = root.dataset.apiBase || document.body?.dataset?.apiBase || DEFAULT_MEDIA_BASE;
    HOME_API_BASE = apiBase;
    initializeHomepage(apiBase);
});

window.addEventListener('pageshow', () => {
    initializeHomepage(HOME_API_BASE);
});

window.addEventListener('focus', () => {
    initializeHomepage(HOME_API_BASE);
});

document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
        initializeHomepage(HOME_API_BASE);
    }
});

window.addEventListener('online', () => {
    initializeHomepage(HOME_API_BASE);
});

window.NewsPortalApi?.onDataChanged?.((event) => {
    if (event?.type === 'articles' || event?.type === 'advertisements') {
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
    // Prevent concurrent initialization (stops articles from disappearing)
    if (IS_LOADING) {
        console.log('⏳ Already loading, skipping duplicate request');
        return;
    }
    IS_LOADING = true;

    const featuredHero       = document.getElementById('featured-hero');
    const latestGrid         = document.getElementById('latest-news-grid');
    const trendingGrid       = document.getElementById('trending-news-grid');
    const editorialGrid      = document.getElementById('editorial-grid');
    const categoryGrid       = document.getElementById('category-sections-grid');
    const videoSection       = document.getElementById('video-section-content');

    try {
        // Step 1: Fetch all data in parallel
        const [feedResult, trendingResult, categoryResult] = await Promise.allSettled([
            fetchAllPages(`${apiBase}/api/articles/feed/?ordering=-id`),
            fetchJsonApi(`${apiBase}/api/articles/trending/`),
            fetchJsonApi(`${apiBase}/api/articles/categories/`),
        ]);

        const feedArticles     = feedResult.status === 'fulfilled' ? feedResult.value : [];
        const trendingArticles = extractArticles(trendingResult.status === 'fulfilled' ? trendingResult.value : null);
        const categoriesPayload = getCategoriesFromPayload(categoryResult.status === 'fulfilled' ? categoryResult.value : null);

        console.log(`✓ Feed: ${feedArticles.length} articles, Trending: ${trendingArticles.length}, Categories: ${categoriesPayload.length}`);

        CURRENT_FEED = feedArticles.slice();

        const selectedCategory = getSelectedCategoryKey();
        const filteredFeed = selectedCategory === 'all' ? feedArticles : filterArticlesByCategory(feedArticles, selectedCategory);
        const allCategories = categoriesPayload.length
            ? categoriesPayload.map(extractCategoryLabel).filter(Boolean)
            : categoriesFromArticles(feedArticles, trendingArticles);

        CATEGORY_LABELS_BY_KEY.clear();
        if (categoriesPayload.length) {
            categoriesPayload.forEach((category) => {
                const label = extractCategoryLabel(category);
                const key = extractCategoryKey(category);
                if (label) {
                    CATEGORY_LABELS_BY_KEY.set(normalizeCategoryKey(label), label);
                }
                if (key) {
                    CATEGORY_LABELS_BY_KEY.set(key, label || key);
                }
            });
        } else {
            allCategories.forEach((label) => {
                CATEGORY_LABELS_BY_KEY.set(normalizeCategoryKey(label), label);
            });
        }

        const sourceArticles = selectedCategory === 'all' ? (feedArticles.length ? feedArticles : trendingArticles) : filteredFeed;
        const latestArticles   = take(sourceArticles, 9).map(mergeArticleData);
        const editorialArticles = take(selectedCategory === 'all' ? feedArticles.slice(1) : filteredFeed.slice(1), 6).map(mergeArticleData);
        
        // Ensure featured article always has a valid source
        let featuredArticleData = null;
        if (selectedCategory === 'all') {
            featuredArticleData = feedArticles[0] || trendingArticles[0];
        } else {
            featuredArticleData = filteredFeed[0];
        }
        const featuredArticle = featuredArticleData ? mergeArticleData(featuredArticleData) : null;
        
        const trendingCards    = take(trendingArticles, 8).map(mergeArticleData);
        const videoArticles    = take(feedArticles.filter(hasVideoContent), 3).map(mergeArticleData);

        // Step 2: Hydrate article details BEFORE rendering (critical fix)
        console.log('🔄 Pre-loading article details for all sections...');
        await hydrateArticleImagesPrioritized(apiBase, [
            { articles: [featuredArticle].filter(Boolean), priority: 'high' },
            { articles: latestArticles,                    priority: 'high' },
            { articles: trendingCards,                     priority: 'medium' },
            { articles: editorialArticles,                 priority: 'medium' },
            { articles: selectedCategory === 'all' ? feedArticles : filteredFeed, priority: 'low' },
            { articles: videoArticles,                     priority: 'medium' },
        ]);
        console.log('✓ All article details loaded');

        // Step 3: Render everything at once (no delays)
        renderFeaturedHero(featuredHero, featuredArticle, selectedCategory);
        renderNewsGrid(latestGrid, latestArticles, selectedCategory);
        renderTrendingGrid(trendingGrid, trendingCards);
        renderEditorialGrid(editorialGrid, editorialArticles);
        renderCategorySectionsGrid(categoryGrid, selectedCategory === 'all' ? feedArticles : filteredFeed, selectedCategory);
        renderVideoSection(videoSection, videoArticles);
        updateBreakingHeadline(featuredArticle, selectedCategory);
        updateCategoryFilter(allCategories);

        if (!feedArticles.length && !trendingArticles.length) {
            renderError(latestGrid, 'No articles available at the moment. Please check back soon.');
        }
        if (!trendingArticles.length && !feedArticles.length) {
            renderError(trendingGrid, 'No trending stories available.');
        }

    } catch (err) {
        console.error('Homepage load error:', err);
        renderError(featuredHero, 'Could not load the featured story right now.');
        renderError(latestGrid,   'Latest news is unavailable at the moment.');
        renderError(trendingGrid, 'Trending stories are unavailable.');
    } finally {
        IS_LOADING = false; // Allow next load to proceed
    }
}

// ============================================================
// POLLING
// ============================================================

// ============================================================
// FETCH HELPERS
// ============================================================
async function fetchJsonApi(url, timeoutMs = FETCH_TIMEOUT_MS) {
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

async function fetchAllPages(url, maxPages = 5) {
    console.log(`🔄 Fetching all pages from ${url}...`);
    let allArticles = [];
    let nextUrl = url;
    let pageCount = 0;
    
    while (nextUrl && pageCount < maxPages) {
        try {
            const data = await fetchJsonApi(nextUrl);
            pageCount++;
            
            if (Array.isArray(data)) {
                allArticles.push(...data);
                break;
            } else if (data?.results && Array.isArray(data.results)) {
                allArticles.push(...data.results);
                console.log(`  Page ${pageCount}: ${data.results.length} articles (total: ${allArticles.length})`);
                nextUrl = data.next || null;
            } else {
                console.warn('Unexpected response format:', typeof data);
                break;
            }
        } catch (err) {
            console.error(`Error fetching page ${pageCount}:`, err.message);
            // Return what we have so far instead of failing completely
            if (allArticles.length === 0 && pageCount === 1) {
                console.warn('Failed to fetch any articles, trying single fetch...');
                try {
                    const data = await fetchJsonApi(url);
                    allArticles = extractArticles(data);
                } catch (retryErr) {
                    console.error('Retry failed:', retryErr.message);
                }
            }
            break;
        }
    }
    
    console.log(`✓ Fetched ${allArticles.length} articles in ${pageCount} pages`);
    return allArticles;
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
    combined.displayDate   = formatDate(combined.published_at || combined.publishedAt || combined.publish_date);
    
    // Try to extract image from the data
    let extractedUrl = resolveMediaUrl(extractImageSource(combined));
    
    // DO NOT set placeholder here - let hydration run first
    // Only use placeholder if extraction finds nothing
    if (extractedUrl) {
        console.log(`✅ Real image found for article ${combined.id}:`, extractedUrl);
        combined.imageUrl = extractedUrl;
    } else {
        // Mark for hydration - don't set imageUrl yet
        combined.needsImageHydration = true;
        console.log(`📌 Article ${combined.id} marked for image hydration`);
    }
    
    combined.categoryLabel = combined.category_name || combined.category || 'News';
    combined.authorLabel   = combined.author_name || 'News Desk';
    return combined;
}

function extractImageSource(article) {
    if (!article) return '';
    const keys = [
        'image', 'image_url', 'thumbnail', 'thumbnail_url', 'photo', 'photo_url',
        'cover_image', 'cover_image_url', 'featured_image', 'featured_image_url',
        'banner', 'banner_url', 'media', 'media_url', 'preview', 'preview_url',
        'imageUrl', 'thumbnailUrl', 'featuredImage', 'featuredImageUrl',
        'coverImage', 'coverImageUrl', 'photoUrl', 'bannerUrl'
    ];

    for (const k of keys) {
        const value = article?.[k];
        if (value) {
            console.log(`✓ Found image in field "${k}":`, value);
            return value;
        }
    }

    const deepCandidates = [
        article?.image?.url,
        article?.image?.src,
        article?.image?.path,
        article?.image?.file,
        article?.image?.data?.url,
        article?.thumbnail?.url,
        article?.thumbnail?.src,
        article?.featured_image?.url,
        article?.featured_image?.src,
        article?.cover_image?.url,
        article?.cover_image?.src,
        article?.media?.url,
        article?.media?.src,
        article?.photo?.url,
        article?.photo?.src,
    ];

    for (const nested of deepCandidates) {
        if (nested) return nested;
    }

    const fallbackSource = article?.image_url || article?.imageUrl || article?.thumbnail_url || article?.thumbnailUrl || '';
    if (fallbackSource) return fallbackSource;

    console.warn(`⚠️  No image found for article:`, article.id, article.title);
    return '';
}

function resolveMediaUrl(url) {
    if (!url) {
        console.log('❌ Empty URL passed to resolveMediaUrl');
        return '';
    }
    if (typeof url === 'object') {
        return resolveMediaUrl(url.url || url.src || url.path || url.file || url.image || '');
    }
    const v = String(url).trim();
    if (!v) return '';
    if (/^https?:\/\//i.test(v) || v.startsWith('data:')) {
        console.log('✓ Full URL:', v);
        return v;
    }

    const base = getMediaBase();
    let resolved = '';
    if (v.startsWith('/media/')) resolved = `${base}${v}`;
    else if (v.startsWith('/static/')) resolved = `${base}${v}`;
    else if (v.startsWith('media/'))  resolved = `${base}/${v}`;
    else if (v.startsWith('static/')) resolved = `${base}/${v}`;
    else if (v.startsWith('/'))       resolved = `${base}${v}`;
    else resolved = `${base}/media/${v}`;
    
    console.log('📍 Resolved URL:', resolved, '(from:', v, 'base:', base, ')');
    return resolved;
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
    if (diff < 0) return 'Recently';  // Future dates
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

function groupArticlesByCategory(articles) {
    const grouped = new Map();
    (articles || []).forEach((article) => {
        const category = article?.categoryLabel || article?.category_name || article?.category || 'News';
        if (!grouped.has(category)) grouped.set(category, []);
        grouped.get(category).push(article);
    });
    return [...grouped.entries()].filter(([, items]) => items.length);
}

function hasVideoContent(article) {
    if (!article) return false;
    const videoFields = ['video', 'video_url', 'videoUrl', 'embed_url', 'embedUrl', 'youtube_url', 'youtubeUrl'];
    return videoFields.some((field) => Boolean(article[field]));
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

function renderFeaturedHero(container, article, selectedCategory = 'all') {
    if (!container) return;
    container.classList.remove('loading-state');

    if (!article) {
        const message = selectedCategory !== 'all'
            ? `No stories are available for the ${escapeHtml(getCategoryLabelForKey(selectedCategory) || selectedCategory)} category.`
            : 'No featured story available.';
        container.innerHTML = `<p style="padding:24px;color:var(--muted)">${message}</p>`;
        return;
    }

    const imgUrl = article.imageUrl || article.image || '/static/images/placeholder.svg';
    const title = article.title || 'Untitled Article';
    const summary = article.summary || article.description || article.body || 'Read the full story';
    const categoryLabel = article.categoryLabel || article.category_name || 'News';
    const displayDate = article.displayDate || 'Recently';

    container.innerHTML = `
        <a href="/news/${escapeHtml(article.id)}/" class="featured-link">
            <img src="${escapeHtml(imgUrl)}" alt="${escapeHtml(title)}" class="featured-image" loading="eager" onerror="this.onerror=null;this.src='/static/images/placeholder.svg'">
            <div class="featured-text">
                <div class="featured-meta">
                    <span class="featured-category">${escapeHtml(categoryLabel)}</span>
                    <span class="featured-time">${escapeHtml(displayDate)}</span>
                </div>
                <h3 class="featured-title">${escapeHtml(title)}</h3>
                <p class="featured-summary">${escapeHtml(summary.slice(0, 200))}</p>
            </div>
        </a>
    `;
}

function renderNewsGrid(container, articles, selectedCategory = 'all') {
    if (!container) return;
    container.classList.remove('loading-state');

    if (!articles || !articles.length) {
        const message = selectedCategory !== 'all'
            ? `No articles were found in the ${escapeHtml(getCategoryLabelForKey(selectedCategory) || selectedCategory)} category.`
            : 'No articles available.';
        container.innerHTML = `<p style="color:var(--muted);padding:20px;text-align:center">${message}</p>`;
        return;
    }

    container.innerHTML = articles.map((a, i) => {
        const thumb = a.imageUrl || '/static/images/placeholder.svg';
        return `
        <article class="news-card">
            <a href="/news/${escapeHtml(a.id)}/">
                <div class="news-card__media">
                    <img src="${escapeHtml(thumb)}" alt="${escapeHtml(a.title)}" loading="${i < 3 ? 'eager' : 'lazy'}" onerror="this.onerror=null;this.src='/static/images/placeholder.svg'">
                </div>
                <div class="news-card__body">
                    <div class="news-card__meta">
                        <span class="category-pill">${escapeHtml(a.categoryLabel || 'News')}</span>
                        <span>${escapeHtml(a.displayDate || 'Recently')}</span>
                    </div>
                    <h4 class="news-card__title">${escapeHtml(a.title)}</h4>
                    <p class="news-card__summary">${escapeHtml(a.summary || a.description || '')}</p>
                    <div class="news-card__footer">
                        <span>${escapeHtml(a.authorLabel || 'News Desk')}</span>
                        <span>Read more →</span>
                    </div>
                </div>
            </a>
        </article>
    `;}).join('');
}

function renderEditorialGrid(container, articles) {
    if (!container) return;
    container.classList.remove('loading-state');

    if (!articles || !articles.length) {
        container.innerHTML = '<p style="color:var(--muted);padding:20px;text-align:center">No editorial picks available.</p>';
        return;
    }

    container.innerHTML = articles.map((a) => {
        const imageUrl = a.imageUrl || '/static/images/placeholder.svg';
        return `
        <article class="editorial-card">
            <a href="/news/${escapeHtml(a.id)}/">
                <div class="editorial-card__media">
                    <img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(a.title)}" loading="lazy" onerror="this.onerror=null;this.src='/static/images/placeholder.svg'">
                </div>
                <div class="editorial-card__body">
                    <div class="editorial-card__meta">
                        <span class="category-pill">${escapeHtml(a.categoryLabel || 'News')}</span>
                        <span>${escapeHtml(a.displayDate || 'Recently')}</span>
                    </div>
                    <h4 class="editorial-card__title">${escapeHtml(a.title)}</h4>
                    <p class="editorial-card__summary">${escapeHtml(a.summary || a.description || '')}</p>
                </div>
            </a>
        </article>
    `;
    }).join('');
}

function renderCategorySectionsGrid(container, articles, selectedCategory = 'all') {
    if (!container) return;
    container.innerHTML = '';

    const grouped = groupArticlesByCategory(articles);
    if (!grouped.length) {
        const message = selectedCategory !== 'all'
            ? `No stories are available for the ${escapeHtml(getCategoryLabelForKey(selectedCategory) || selectedCategory)} category.`
            : 'No category coverage available.';
        container.innerHTML = `<p style="color:var(--muted);padding:20px;text-align:center">${message}</p>`;
        return;
    }

    container.innerHTML = grouped.slice(0, 8).map(([category, items]) => `
        <section class="category-card">
            <div class="category-card__body">
                <div class="editorial-card__meta">
                    <span class="category-pill">${escapeHtml(category)}</span>
                    <span>${items.length} stories</span>
                </div>
                <h4 class="category-card__title">${escapeHtml(category)} coverage</h4>
                <ul class="hero-preview-list">
                    ${items.slice(0, 4).map((item) => `<li><a href="/news/${escapeHtml(item.id)}/">${escapeHtml(item.title)}</a></li>`).join('')}
                </ul>
            </div>
        </section>
    `).join('');
}

function renderVideoSection(container, articles) {
    if (!container) return;

    if (!articles || !articles.length) {
        container.innerHTML = '<div class="editorial-card"><div class="editorial-card__body"><p style="color:var(--muted)">No video highlights are available right now.</p></div></div>';
        return;
    }

    const article = articles[0];
    const videoImage = article.imageUrl || '/static/images/placeholder.svg';
    container.innerHTML = `
        <article class="video-section-card">
            <a href="/news/${escapeHtml(article.id)}/">
                <div class="editorial-card__media">
                    <img src="${escapeHtml(videoImage)}" alt="${escapeHtml(article.title)}" loading="lazy" onerror="this.onerror=null;this.src='/static/images/placeholder.svg'">
                </div>
                <div class="editorial-card__body">
                    <div class="editorial-card__meta">
                        <span class="category-pill">Video</span>
                        <span>${escapeHtml(article.displayDate || 'Recently')}</span>
                    </div>
                    <h4 class="editorial-card__title">${escapeHtml(article.title)}</h4>
                    <p class="editorial-card__summary">${escapeHtml(article.summary || article.description || '')}</p>
                </div>
            </a>
        </article>
    `;
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

function updateBreakingHeadline(article, selectedCategory = 'all') {
    const el = document.getElementById('breaking-headline');
    if (el) {
        if (article && article.title) {
            el.textContent = article.title;
        } else {
            el.textContent = selectedCategory !== 'all' 
                ? `No stories for ${selectedCategory} right now.`
                : 'No breaking stories at this moment.';
        }
    }
}

function getQueryParam(name) {
    return new URLSearchParams(window.location.search).get(name) || '';
}

function updateCategoryFilter(categories) {
    const container = document.getElementById('category-filter');
    if (!container) return;

    const selectedCategory = getQueryParam('category') || 'all';
    const labels = categories.length ? categories : [];
    const allBtn = `<button class="category-btn${selectedCategory === 'all' ? ' active' : ''}" type="button" data-category="all">All</button>`;
    const catBtns = labels.map((label) => {
        const value = escapeHtml(label);
        return `<button class="category-btn${selectedCategory === value ? ' active' : ''}" type="button" data-category="${value}">${escapeHtml(label)}</button>`;
    }).join('');

    container.innerHTML = allBtn + catBtns;

    container.querySelectorAll('.category-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
            const category = btn.dataset.category || 'all';
            container.querySelectorAll('.category-btn').forEach((b) => b.classList.remove('active'));
            btn.classList.add('active');
            navigateToCategory(category);
        });
    });
}

function navigateToCategory(categoryKey) {
    const url = new URL(window.location);
    if (categoryKey === 'all') {
        url.searchParams.delete('category');
    } else {
        url.searchParams.set('category', categoryKey);
    }
    window.history.pushState({}, '', url);
    initializeHomepage(HOME_API_BASE);
}

// ============================================================
// IMAGE HYDRATION (fetch detail to get images not in feed)
// ============================================================
async function hydrateArticleImagesPrioritized(apiBase, sections) {
    try {
        // Collect all articles from all sections
        const articleMap = new Map();
        sections.forEach(({ articles }) => {
            if (!Array.isArray(articles)) return;
            articles.forEach((a) => {
                if (a?.id && !articleMap.has(a.id)) {
                    articleMap.set(a.id, a);
                }
            });
        });

        const needingImages = [...articleMap.values()].filter((a) => a.needsImageHydration || !a.imageUrl);
        console.log(`� Pre-loading article details...`);
        console.log(`   Total articles: ${articleMap.size}`);
        console.log(`   Need image hydration: ${needingImages.length}`);
        
        if (!needingImages.length) {
            console.log('✓ All articles already have images');
            return;
        }

        // Fetch all article details in parallel
        const details = await mapConcurrent(
            needingImages.map((a) => a.id),
            MAX_PARALLEL_DETAIL,
            (id) => fetchArticleDetail(apiBase, id)
        );

        const detailMap = new Map();
        needingImages.forEach((a, i) => {
            if (details[i]) {
                detailMap.set(a.id, details[i]);
            }
        });

        if (detailMap.size) {
            console.log(`✅ Fetched details for ${detailMap.size} articles`);

            // Update all articles with fetched details
            let updated = 0;
            articleMap.forEach((article) => {
                const detail = detailMap.get(article.id);
                if (detail) {
                    const merged = mergeArticleData(article, detail);
                    Object.assign(article, merged);
                    updated++;
                }
            });
            console.log(`   Updated ${updated} articles with detail data`);
        } else {
            console.warn('⚠️ No article details fetched');
        }
    } catch (err) {
        console.error('Hydration error:', err);
        // Continue rendering even if hydration fails
    }
}

async function hydrateArticleImages(apiBase, sections) {
    const articleMap = new Map();
    sections.forEach(({ articles }) => {
        articles.forEach((a) => {
            if (a?.id && !articleMap.has(a.id)) articleMap.set(a.id, a);
        });
    });

    const needingImages = [...articleMap.values()].filter((a) => !a.imageUrl);
    console.log(`🔄 Hydrating ${needingImages.length} articles with images...`);
    
    if (!needingImages.length) {
        console.log('✓ All articles already have images');
        return;
    }

    const details = await mapConcurrent(
        needingImages.map((a) => a.id),
        MAX_PARALLEL_DETAIL,
        (id) => fetchArticleDetail(apiBase, id)
    );

    const detailMap = new Map();
    needingImages.forEach((a, i) => {
        if (details[i]) {
            detailMap.set(a.id, details[i]);
            console.log(`  ✓ Hydrated article ${a.id}`);
        }
    });

    if (!detailMap.size) {
        console.log('⚠ No article details fetched');
        return;
    }

    console.log(`✓ Hydrated ${detailMap.size} articles with image data`);

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
        if (updated) {
            console.log('  Re-rendering section with hydrated images');
            render();
        }
    });
}

async function fetchArticleDetail(apiBase, id) {
    if (!id) return null;
    try {
        const detailUrl = `${apiBase}/api/articles/${id}/`;
        const data = await fetchJsonApi(detailUrl, DETAIL_TIMEOUT_MS);
        if (!data || typeof data !== 'object' || !Object.keys(data).length) return null;
        
        // DEBUG: Log all fields and their values
        console.log(`📄 Article ${id} detail API response:`, data);
        console.log(`   Fields:`, Object.keys(data).join(', '));
        
        // Log any image-related fields
        const imageFields = Object.keys(data).filter(k => 
            k.toLowerCase().includes('image') || 
            k.toLowerCase().includes('photo') ||
            k.toLowerCase().includes('thumbnail') ||
            k.toLowerCase().includes('media') ||
            k.toLowerCase().includes('cover')
        );
        if (imageFields.length) {
            console.log(`   Image fields found:`, imageFields);
            imageFields.forEach(f => console.log(`     ${f}:`, data[f]));
        } else {
            console.warn(`   ⚠️ No image fields found in response!`);
        }
        
        return data;
    } catch (err) {
        console.warn(`Failed to fetch article ${id}:`, err.message);
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
