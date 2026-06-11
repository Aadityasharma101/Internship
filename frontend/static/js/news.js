const DEFAULT_API_BASE = '/api';
const DEFAULT_MEDIA_BASE = 'https://news-portal-hvgs.onrender.com';
const FETCH_TIMEOUT_MS = 15000;
const DETAIL_FETCH_TIMEOUT_MS = 10000;
const MAX_DETAIL_REQUESTS = 2;

document.addEventListener('DOMContentLoaded', () => {
    const appRoot = document.querySelector('.page-shell');
    if (!appRoot) {
        return;
    }

    initializeHomepage(appRoot.dataset.apiBase || DEFAULT_API_BASE);
});

function getMediaBase() {
    const mediaBase = document.body?.dataset?.mediaBase || DEFAULT_MEDIA_BASE;
    return mediaBase.replace(/\/$/, '');
}

async function initializeHomepage(apiBase) {
    const featuredHero = document.getElementById('featured-hero');
    const latestNewsGrid = document.getElementById('latest-news-grid');
    const trendingNewsGrid = document.getElementById('trending-news-grid');

    try {
        const [feedResponse, trendingResponse] = await Promise.allSettled([
            fetchJson(`${apiBase}/articles/feed/`),
            fetchJson(`${apiBase}/articles/trending/`),
        ]);

        const feedArticles = extractArticles(feedResponse.status === 'fulfilled' ? feedResponse.value : null);
        const trendingArticles = extractArticles(trendingResponse.status === 'fulfilled' ? trendingResponse.value : null);

        const latestArticles = take(feedArticles.length ? feedArticles : trendingArticles, 6).map((article) => mergeArticleData(article));
        const trendingCards = take(trendingArticles, 4).map((article) => mergeArticleData(article));
        const featuredArticle = mergeArticleData(feedArticles[0] || trendingArticles[0] || null);

        renderFeaturedHero(featuredHero, featuredArticle);
        renderNewsGrid(latestNewsGrid, latestArticles, { compact: false });
        renderTrendingGrid(trendingNewsGrid, trendingCards);
        updateBreakingHeadline(featuredArticle);
        updateCategoryFilter(categoriesFromArticles(feedArticles, trendingArticles));

        if (!feedArticles.length && !trendingArticles.length) {
            renderError(latestNewsGrid, 'Latest news is unavailable at the moment.');
        }
        if (!trendingArticles.length) {
            renderError(trendingNewsGrid, 'Trending stories are unavailable at the moment.');
        }

        hydrateArticleImages(apiBase, [
            {
                articles: [featuredArticle].filter(Boolean),
                render: () => renderFeaturedHero(featuredHero, featuredArticle),
            },
            {
                articles: latestArticles,
                render: () => renderNewsGrid(latestNewsGrid, latestArticles, { compact: false }),
            },
            {
                articles: trendingCards,
                render: () => renderTrendingGrid(trendingNewsGrid, trendingCards),
            },
        ]);
    } catch (error) {
        console.error('Failed to load homepage news:', error);
        renderError(featuredHero, 'We could not load the featured story right now.');
        renderError(latestNewsGrid, 'Latest news is unavailable at the moment.');
        renderError(trendingNewsGrid, 'Trending stories are unavailable at the moment.');
    }
}

async function fetchJson(url, allowNotFound = false, timeoutMs = FETCH_TIMEOUT_MS) {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(url, {
            headers: {
                Accept: 'application/json',
            },
            signal: controller.signal,
        });

        if (allowNotFound && response.status === 404) {
            return null;
        }

        if (!response.ok) {
            throw new Error(`Request failed with status ${response.status}`);
        }

        return response.json();
    } finally {
        window.clearTimeout(timeoutId);
    }
}

function extractArticles(payload) {
    if (!payload) {
        return [];
    }

    if (Array.isArray(payload)) {
        return payload;
    }

    if (Array.isArray(payload.results)) {
        return payload.results;
    }

    if (payload.id || payload.title) {
        return [payload];
    }

    return [];
}

function take(items, count) {
    return items.slice(0, count);
}

async function hydrateArticleImages(apiBase, sections) {
    const articleMap = new Map();

    sections.forEach(({ articles }) => {
        articles.forEach((article) => {
            if (!article?.id || articleMap.has(article.id)) {
                return;
            }
            articleMap.set(article.id, article);
        });
    });

    const articlesNeedingImages = [...articleMap.values()].filter((article) => !article.imageUrl);
    if (!articlesNeedingImages.length) {
        return;
    }

    const detailEntries = await mapConcurrent(
        articlesNeedingImages.map((article) => article.id),
        MAX_DETAIL_REQUESTS,
        async (articleId) => {
            const detail = await fetchArticleDetail(apiBase, articleId);
            return detail ? [articleId, detail] : null;
        }
    );

    const detailMap = new Map(
        detailEntries.filter(Boolean).map(([articleId, detail]) => [articleId, detail])
    );

    if (!detailMap.size) {
        return;
    }

    sections.forEach(({ articles, render }) => {
        let sectionUpdated = false;

        articles.forEach((article) => {
            const detail = detailMap.get(article.id);
            if (!detail) {
                return;
            }

            const merged = mergeArticleData(article, detail);
            if (merged.imageUrl && merged.imageUrl !== article.imageUrl) {
                Object.assign(article, merged);
                sectionUpdated = true;
            }
        });

        if (sectionUpdated) {
            render();
        }
    });
}

async function mapConcurrent(items, limit, worker) {
    const results = new Array(items.length);
    let nextIndex = 0;

    async function runWorker() {
        while (nextIndex < items.length) {
            const currentIndex = nextIndex;
            nextIndex += 1;
            results[currentIndex] = await worker(items[currentIndex], currentIndex);
        }
    }

    const workers = Array.from({ length: Math.min(limit, items.length) }, () => runWorker());
    await Promise.all(workers);
    return results;
}

async function fetchArticleDetail(apiBase, articleId) {
    if (!articleId) {
        return null;
    }

    try {
        const detail = await fetchJson(
            `${apiBase}/articles/${articleId}/`,
            true,
            DETAIL_FETCH_TIMEOUT_MS
        );

        if (!detail || typeof detail !== 'object' || !Object.keys(detail).length) {
            return null;
        }

        return detail;
    } catch (error) {
        console.warn(`Could not load detail for article ${articleId}`, error);
        return null;
    }
}

function mergeArticleData(baseArticle, detailArticle = null) {
    if (!baseArticle && !detailArticle) {
        return null;
    }

    const combined = {
        ...(baseArticle || {}),
        ...(detailArticle || {}),
    };

    combined.summary = getSummary(combined);
    combined.displayDate = formatDate(combined.published_at);
    combined.imageUrl = resolveMediaUrl(extractImageSource(combined));
    combined.categoryLabel = combined.category_name || combined.category || 'Top Story';
    combined.authorLabel = combined.author_name || 'News Desk';

    return combined;
}

function extractImageSource(article) {
    if (!article) {
        return '';
    }

    const candidates = [
        article.image,
        article.image_url,
        article.thumbnail,
        article.thumbnail_url,
        article.photo,
        article.photo_url,
        article.cover_image,
        article.cover_image_url,
        article.preview,
        article.preview_url,
        article.featured_image,
        article.featured_image_url,
        article.banner,
        article.banner_url,
        article.media,
        article.media_url,
    ];

    for (const candidate of candidates) {
        if (candidate) {
            return candidate;
        }
    }

    return '';
}

function resolveMediaUrl(url) {
    if (!url) {
        return '';
    }

    if (typeof url === 'object') {
        return resolveMediaUrl(
            url.url ||
            url.src ||
            url.path ||
            url.file ||
            url.image ||
            url.media ||
            url.secure_url ||
            url.absolute_url ||
            ''
        );
    }

    const value = String(url).trim();
    if (!value) {
        return '';
    }

    if (/^https?:\/\//i.test(value) || value.startsWith('data:')) {
        return value;
    }

    const mediaBase = getMediaBase();

    if (value.startsWith('/media-proxy/')) {
        return value;
    }

    if (value.startsWith('/media/')) {
        return `${mediaBase}${value}`;
    }

    if (value.startsWith('media/')) {
        return `${mediaBase}/${value}`;
    }

    if (value.startsWith('/')) {
        return `${mediaBase}${value}`;
    }

    return `${mediaBase}/media/${value}`;
}

function getSummary(article) {
    if (!article) {
        return '';
    }

    if (article.summary) {
        return article.summary;
    }

    const sourceText = article.body || article.description || '';
    if (!sourceText) {
        return 'Read the full article for more details.';
    }

    return truncateText(sourceText, 140);
}

function truncateText(text, limit) {
    const cleanText = String(text).replace(/\s+/g, ' ').trim();
    if (cleanText.length <= limit) {
        return cleanText;
    }

    return `${cleanText.slice(0, limit).trimEnd()}...`;
}

function formatDate(dateString) {
    if (!dateString) {
        return 'Updated recently';
    }

    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) {
        return 'Updated recently';
    }

    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
}

function categoriesFromArticles(...articleLists) {
    const seen = new Set();
    const categories = [];

    articleLists.flat().forEach((article) => {
        const label = article.category_name || article.category || article.categoryLabel;
        if (!label || seen.has(label)) {
            return;
        }
        seen.add(label);
        categories.push(label);
    });

    return categories;
}

function updateBreakingHeadline(article) {
    const headline = document.getElementById('breaking-headline');
    if (!headline) {
        return;
    }

    headline.textContent = article?.title || 'No breaking stories available right now.';
}

function updateCategoryFilter(categories) {
    const container = document.getElementById('category-filter');
    if (!container) {
        return;
    }

    const labels = categories.length ? categories : ['All'];
    container.innerHTML = labels
        .map((label, index) => `<span class="category-btn${index === 0 ? ' active' : ''}">${escapeHtml(label)}</span>`)
        .join('');
}
