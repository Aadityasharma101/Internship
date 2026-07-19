let currentMediaPage = 1;
let lastMediaResponse = null;
let currentMedia = [];
let activeMediaEndpoint = null;
let currentMediaView = 'grid';

const ARTICLE_MEDIA_ENDPOINT = 'articles/feed/';
const ADS_MEDIA_ENDPOINT = '/api/ads/';

const mediaGrid = document.getElementById('mediaGrid');
const mediaTableWrapper = document.getElementById('mediaTableWrapper');
const mediaTableBody = document.getElementById('mediaTableBody');
const prevMediaBtn = document.getElementById('prevMediaBtn');
const nextMediaBtn = document.getElementById('nextMediaBtn');
const mediaPageInfo = document.getElementById('mediaPageInfo');
const refreshMediaBtn = document.getElementById('refreshMediaBtn');
const mediaSearchInput = document.getElementById('mediaSearchInput');
const totalMedia = document.getElementById('totalMedia');
const imageMedia = document.getElementById('imageMedia');
const documentMedia = document.getElementById('documentMedia');
const storageUsed = document.getElementById('storageUsed');
const visibleMediaCount = document.getElementById('visibleMediaCount');
const gridViewBtn = document.getElementById('gridViewBtn');
const tableViewBtn = document.getElementById('tableViewBtn');
const mediaModal = document.getElementById('mediaModal');
const openMediaModalBtn = document.getElementById('openMediaModalBtn');
const closeMediaModalBtn = document.getElementById('closeMediaModalBtn');
const uploadMediaBtn = document.getElementById('uploadMediaBtn');
const mediaFileInput = document.getElementById('mediaFileInput');
const mediaTitleInput = document.getElementById('mediaTitleInput');
const mediaAltInput = document.getElementById('mediaAltInput');
const mediaUploadStatus = document.getElementById('mediaUploadStatus');

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

function getMediaTitle(media) {
    const url = getMediaUrl(media);
    const fileName = url ? url.split('/').filter(Boolean).pop() : null;

    return normalizeText(
        getNestedValue(media, ['title', 'name', 'filename', 'file_name', 'original_name']) || fileName,
        'Untitled media'
    );
}

function getMediaUrl(media) {
    return resolveMediaUrl(getNestedValue(media, [
        'url',
        'file',
        'file_url',
        'image',
        'image_url',
        'media',
        'media_url',
        'path',
        'attachment'
    ]));
}

function getMediaBase() {
    if (typeof API_ORIGIN_URL === 'string') {
        return API_ORIGIN_URL.replace(/\/$/, '');
    }

    if (typeof API_BASE_URL === 'string') {
        return API_BASE_URL.replace(/\/api\/?$/, '').replace(/\/$/, '');
    }

    return '';
}

function resolveMediaUrl(url) {
    if (!url) {
        return null;
    }

    if (typeof url === 'object') {
        return resolveMediaUrl(
            url.url ||
            url.file ||
            url.image ||
            url.media ||
            url.path
        );
    }

    const value = String(url).trim();

    if (!value) {
        return null;
    }

    if (/^https?:\/\//i.test(value) || value.startsWith('data:')) {
        return value;
    }

    const mediaBase = getMediaBase();

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

function getMediaAlt(media) {
    return normalizeText(getNestedValue(media, ['alt', 'alt_text', 'description', 'caption']), getMediaTitle(media));
}

function getMediaMime(media) {
    return normalizeText(getNestedValue(media, ['mime_type', 'content_type', 'type', 'file_type', 'extension']), 'Unknown');
}

function getMediaSize(media) {
    const value = getNestedValue(media, ['size', 'file_size', 'bytes']);

    if (!value || Number.isNaN(Number(value))) {
        return null;
    }

    return Number(value);
}

function getUploadedBy(media) {
    const firstName = getNestedValue(media, ['uploaded_by.first_name', 'user.first_name']);
    const lastName = getNestedValue(media, ['uploaded_by.last_name', 'user.last_name']);
    const fullName = `${firstName || ''} ${lastName || ''}`.trim();

    return normalizeText(
        fullName || getNestedValue(media, [
            'uploaded_by.full_name',
            'uploaded_by.name',
            'uploaded_by.username',
            'user.full_name',
            'user.name',
            'user.username',
            'created_by.username'
        ]),
        'Admin'
    );
}

function getUploadedDate(media) {
    return getNestedValue(media, ['uploaded_at', 'created_at', 'date_uploaded', 'updated_at']);
}

function isImage(media) {
    const type = getMediaMime(media).toLowerCase();
    const url = String(getMediaUrl(media) || '').toLowerCase();

    return type.includes('image') || /\.(avif|gif|jpe?g|png|webp|svg)$/i.test(url);
}

function getMediaTypeLabel(media) {
    if (isImage(media)) {
        return 'Image';
    }

    const type = getMediaMime(media);

    if (type.includes('/')) {
        return type.split('/').pop().toUpperCase();
    }

    return type === 'Unknown' ? 'File' : type;
}

function formatFileSize(bytes) {
    if (!bytes) {
        return 'Unknown';
    }

    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex += 1;
    }

    return `${size.toFixed(size >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function setMediaMessage(message, type = 'muted') {
    mediaGrid.innerHTML = `<div class="media-message ${type}-row">${escapeHTML(message)}</div>`;
    mediaTableBody.innerHTML = `
        <tr class="${type}-row">
            <td colspan="6">${escapeHTML(message)}</td>
        </tr>
    `;
}

function renderMediaPreview(media, className = 'media-preview') {
    const url = getMediaUrl(media);
    const title = getMediaTitle(media);

    if (url && isImage(media)) {
        return `<div class="${className}"><img src="${escapeHTML(url)}" alt="${escapeHTML(getMediaAlt(media))}" loading="lazy"></div>`;
    }

    const icon = getMediaTypeLabel(media).toLowerCase().includes('pdf') ? 'fa-file-pdf' : 'fa-file-lines';

    return `
        <div class="${className}">
            <i class="fa-regular ${icon}" title="${escapeHTML(title)}"></i>
        </div>
    `;
}

function renderMediaThumb(media) {
    const url = getMediaUrl(media);

    if (url && isImage(media)) {
        return `<img class="media-thumb" src="${escapeHTML(url)}" alt="${escapeHTML(getMediaAlt(media))}" loading="lazy">`;
    }

    return `
        <span class="media-thumb-fallback" aria-hidden="true">
            <i class="fa-regular fa-file-lines"></i>
        </span>
    `;
}

function renderMediaActions(media) {
    const url = getMediaUrl(media);
    const title = getMediaTitle(media);
    const viewAction = url
        ? `<a href="${escapeHTML(url)}" target="_blank" rel="noopener" title="Open media" aria-label="Open ${escapeHTML(title)}">
                <i class="fa-regular fa-eye"></i>
            </a>`
        : `<button type="button" title="Open media" aria-label="Open ${escapeHTML(title)}">
                <i class="fa-regular fa-eye"></i>
            </button>`;
    const copyAction = url
        ? `<button type="button" data-copy-url="${escapeHTML(url)}" title="Copy URL" aria-label="Copy URL for ${escapeHTML(title)}">
                <i class="fa-regular fa-copy"></i>
            </button>`
        : '';

    return `
        <div class="row-actions">
            ${viewAction}
            ${copyAction}
            <button type="button" title="Edit media" aria-label="Edit ${escapeHTML(title)}">
                <i class="fa-regular fa-pen-to-square"></i>
            </button>
        </div>
    `;
}

function getFilteredMedia(mediaItems) {
    const query = mediaSearchInput.value.trim().toLowerCase();

    return mediaItems.filter((media) => {
        const searchable = [
            getMediaTitle(media),
            getMediaTypeLabel(media),
            getMediaMime(media),
            getUploadedBy(media),
            formatDate(getUploadedDate(media))
        ].join(' ').toLowerCase();

        return searchable.includes(query);
    });
}

function renderMediaGrid(mediaItems) {
    mediaGrid.innerHTML = mediaItems.map((media) => {
        const title = getMediaTitle(media);
        const size = formatFileSize(getMediaSize(media));

        return `
            <article class="media-card">
                ${renderMediaPreview(media)}
                <div class="media-card-body">
                    <strong class="media-title">${escapeHTML(title)}</strong>
                    <div class="media-meta">
                        <span>${escapeHTML(getMediaTypeLabel(media))}</span>
                        <span>${escapeHTML(size)}</span>
                    </div>
                    ${renderMediaActions(media)}
                </div>
            </article>
        `;
    }).join('');
}

function renderMediaTable(mediaItems) {
    mediaTableBody.innerHTML = mediaItems.map((media) => {
        const title = getMediaTitle(media);
        const url = getMediaUrl(media);

        return `
            <tr>
                <td>
                    <div class="media-cell">
                        ${renderMediaThumb(media)}
                        <div class="media-title-wrap">
                            <strong>${escapeHTML(title)}</strong>
                            <span>${escapeHTML(url || 'No URL available')}</span>
                        </div>
                    </div>
                </td>
                <td><span class="type-pill">${escapeHTML(getMediaTypeLabel(media))}</span></td>
                <td class="media-meta-muted">${escapeHTML(formatFileSize(getMediaSize(media)))}</td>
                <td>${escapeHTML(getUploadedBy(media))}</td>
                <td class="media-meta-muted">${escapeHTML(formatDate(getUploadedDate(media)))}</td>
                <td>${renderMediaActions(media)}</td>
            </tr>
        `;
    }).join('');
}

function renderMedia(mediaItems) {
    const filteredMedia = getFilteredMedia(mediaItems);

    visibleMediaCount.textContent = `${filteredMedia.length} file${filteredMedia.length === 1 ? '' : 's'} shown`;

    if (!filteredMedia.length) {
        setMediaMessage(mediaSearchInput.value ? 'No media files match your search.' : 'No media files found.');
        return;
    }

    renderMediaGrid(filteredMedia);
    renderMediaTable(filteredMedia);
}

function updateSummary(mediaItems, totalCount) {
    const storageBytes = mediaItems.reduce((total, media) => total + (getMediaSize(media) || 0), 0);

    totalMedia.textContent = totalCount ?? mediaItems.length;
    imageMedia.textContent = mediaItems.filter(isImage).length;
    documentMedia.textContent = mediaItems.filter((media) => !isImage(media)).length;
    storageUsed.textContent = formatFileSize(storageBytes);
}

function updatePagination(data) {
    prevMediaBtn.disabled = !data.previous;
    nextMediaBtn.disabled = !data.next;
    mediaPageInfo.textContent = `Page ${currentMediaPage}`;
}

function setMediaView(view) {
    currentMediaView = view;
    mediaGrid.classList.toggle('hidden', view !== 'grid');
    mediaTableWrapper.classList.toggle('hidden', view !== 'table');
    gridViewBtn.classList.toggle('active', view === 'grid');
    tableViewBtn.classList.toggle('active', view === 'table');
}

function flattenAdsPayload(payload) {
    if (Array.isArray(payload)) {
        return payload;
    }

    if (Array.isArray(payload?.results)) {
        return payload.results;
    }

    if (!payload || typeof payload !== 'object') {
        return [];
    }

    return Object.values(payload)
        .flatMap((value) => Array.isArray(value) ? value : [value])
        .filter(Boolean);
}

function articleToMedia(article) {
    const url = getNestedValue(article, ['image', 'image_url', 'featured_image', 'thumbnail', 'cover_image']);

    if (!url) {
        return null;
    }

    return {
        id: `article-${article.id}`,
        title: article.title || `Article ${article.id}`,
        file: url,
        mime_type: 'image',
        uploaded_by: { name: article.author_name || 'Article' },
        uploaded_at: article.published_at,
        alt_text: article.title,
        source_type: 'Article'
    };
}

function adToMedia(ad) {
    const url = getNestedValue(ad, ['image', 'image_url']);

    if (!url) {
        return null;
    }

    return {
        id: `ad-${ad.id}`,
        title: ad.title || ad.client_name || `Advertisement ${ad.id}`,
        file: url,
        mime_type: 'image',
        uploaded_by: { name: ad.client_name || 'Advertisement' },
        uploaded_at: ad.start_date,
        alt_text: ad.title || ad.client_name,
        source_type: ad.position_display || ad.position || 'Advertisement'
    };
}

async function fetchArticleMedia(page) {
    const response = await api.get(apiUrl(`${ARTICLE_MEDIA_ENDPOINT}?page=${page}`));
    const data = response.data;
    const articles = Array.isArray(data) ? data : (data.results || []);
    const articleDetails = await Promise.all(articles.map(async (article) => {
        if (!article.id) {
            return article;
        }

        try {
            const detailResponse = await api.get(apiUrl(`articles/${article.id}/`));
            return { ...article, ...detailResponse.data };
        } catch (error) {
            return article;
        }
    }));

    return {
        response: Array.isArray(data) ? { previous: null, next: null, count: articleDetails.length } : data,
        media: articleDetails.map(articleToMedia).filter(Boolean)
    };
}

async function fetchAdMedia() {
    try {
        const response = await api.get(apiUrl(ADS_MEDIA_ENDPOINT));
        return flattenAdsPayload(response.data).map(adToMedia).filter(Boolean);
    } catch (error) {
        console.error('Error loading advertisement media:', error);
        return [];
    }
}

async function fetchMedia(page) {
    const [articleMedia, adMedia] = await Promise.all([
        fetchArticleMedia(page),
        fetchAdMedia()
    ]);
    const mediaItems = [...articleMedia.media, ...adMedia];

    activeMediaEndpoint = ARTICLE_MEDIA_ENDPOINT;

    return {
        ...articleMedia.response,
        results: mediaItems,
        count: mediaItems.length
    };
}

async function loadMedia(page = 1) {
    setMediaMessage('Loading media...', 'loading');

    try {
        const data = await fetchMedia(page);
        const mediaItems = Array.isArray(data) ? data : (data.results || []);

        currentMediaPage = page;
        lastMediaResponse = Array.isArray(data)
            ? { previous: null, next: null, count: mediaItems.length }
            : data;
        currentMedia = mediaItems;

        updateSummary(currentMedia, lastMediaResponse.count);
        renderMedia(currentMedia);
        updatePagination(lastMediaResponse);
        setMediaView(currentMediaView);
    } catch (error) {
        console.error('Error loading media:', error);
        const notFound = error?.response?.status === 404;
        const message = notFound
            ? 'No image assets are available from articles or ads yet.'
            : 'Unable to load media. Please check the API token or try again.';

        setMediaMessage(message);
        updateSummary([], 0);
        updatePagination({ previous: null, next: null });
    }
}

async function uploadMedia() {
    const file = mediaFileInput.files[0];

    if (!file) {
        mediaUploadStatus.textContent = 'Choose a file before uploading.';
        return;
    }

    const formData = new FormData();
    formData.append('title', mediaTitleInput.value.trim() || file.name);
    formData.append('client_name', mediaAltInput.value.trim() || 'Media Library');
    formData.append('image', file);
    formData.append('target_url', typeof API_ORIGIN_URL === 'string' ? API_ORIGIN_URL : window.location.origin);
    formData.append('position', 'sidebar');
    formData.append('end_date', new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString());

    uploadMediaBtn.disabled = true;
    mediaUploadStatus.textContent = 'Uploading...';

    try {
        await api.post(apiUrl(ADS_MEDIA_ENDPOINT), formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        mediaUploadStatus.textContent = 'Upload complete.';
        mediaModal.classList.add('hidden');
        mediaFileInput.value = '';
        mediaTitleInput.value = '';
        mediaAltInput.value = '';
        loadMedia(currentMediaPage);
    } catch (error) {
        console.error('Error uploading media:', error);
        mediaUploadStatus.textContent = ResourceHelpers.formatApiError(error, 'Unable to upload media. Check required fields and permissions.');
    } finally {
        uploadMediaBtn.disabled = false;
    }
}

document.addEventListener('click', async (event) => {
    const copyButton = event.target.closest('[data-copy-url]');

    if (!copyButton) {
        return;
    }

    try {
        await navigator.clipboard.writeText(copyButton.dataset.copyUrl);
        copyButton.title = 'Copied';
    } catch (error) {
        console.error('Unable to copy media URL:', error);
    }
});

prevMediaBtn.addEventListener('click', () => {
    if (lastMediaResponse?.previous && currentMediaPage > 1) {
        loadMedia(currentMediaPage - 1);
    }
});

nextMediaBtn.addEventListener('click', () => {
    if (lastMediaResponse?.next) {
        loadMedia(currentMediaPage + 1);
    }
});

refreshMediaBtn.addEventListener('click', () => loadMedia(currentMediaPage));
mediaSearchInput.addEventListener('input', () => renderMedia(currentMedia));
gridViewBtn.addEventListener('click', () => setMediaView('grid'));
tableViewBtn.addEventListener('click', () => setMediaView('table'));

openMediaModalBtn.addEventListener('click', () => mediaModal.classList.remove('hidden'));
closeMediaModalBtn.addEventListener('click', () => mediaModal.classList.add('hidden'));
uploadMediaBtn.addEventListener('click', uploadMedia);
mediaModal.addEventListener('click', (event) => {
    if (event.target === mediaModal) {
        mediaModal.classList.add('hidden');
    }
});

document.addEventListener('DOMContentLoaded', () => loadMedia());
