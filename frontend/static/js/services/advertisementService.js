(function (window) {
    const Api = window.NewsPortalApi;
    const LIST_ENDPOINTS = ['/api/ads/', '/ads/', '/advertisements/', '/advertise/'];
    const POSITION_MAP = {
        top_banner: 'Top Banner',
        sidebar: 'Sidebar',
        between_articles: 'Between Articles',
        in_article: 'Between Articles',
        footer_banner: 'Footer Banner',
        footer: 'Footer Banner'
    };

    function normalizePosition(value) {
        const raw = String(value || '').trim().toLowerCase().replace(/\s+/g, '_');

        if (POSITION_MAP[raw]) {
            return raw === 'in_article' ? 'between_articles' : raw === 'footer' ? 'footer_banner' : raw;
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

        return 'between_articles';
    }

    function positionLabel(value) {
        return POSITION_MAP[normalizePosition(value)] || 'Between Articles';
    }

    function normalizeStatus(ad) {
        const raw = Api.getValue(ad, ['status', 'state'], '');
        const active = Api.getValue(ad, ['is_active', 'active'], null);

        if (typeof active === 'boolean') {
            return active ? 'active' : 'inactive';
        }

        if (raw) {
            return String(raw).toLowerCase();
        }

        return 'active';
    }

    function parseDate(value) {
        if (!value) {
            return null;
        }

        const date = new Date(value);

        return Number.isNaN(date.getTime()) ? null : date;
    }

    function isWithinDateRange(ad, date = new Date()) {
        const startDate = parseDate(Api.getValue(ad, ['start_date', 'starts_at', 'start_at'], ''));
        const endDate = parseDate(Api.getValue(ad, ['end_date', 'ends_at', 'end_at'], ''));

        if (startDate && date < startDate) {
            return false;
        }

        if (endDate && date > endDate) {
            return false;
        }

        return true;
    }

    function isActiveAdvertisement(ad, date = new Date()) {
        const status = normalizeStatus(ad);

        if (['inactive', 'disabled', 'draft', 'archived'].includes(status)) {
            return false;
        }

        return isWithinDateRange(ad, date);
    }

    function normalizeAdvertisement(ad) {
        const position = normalizePosition(Api.getValue(ad, ['position', 'placement', 'slot'], 'between_articles'));
        const status = normalizeStatus(ad);

        return {
            ...ad,
            position,
            position_label: positionLabel(position),
            title: Api.getValue(ad, ['title', 'name', 'campaign_name'], 'Untitled advertisement'),
            description: Api.getValue(ad, ['description', 'summary', 'notes'], ''),
            image_url: Api.resolveMediaUrl(Api.getValue(ad, ['image', 'image_url', 'banner', 'media'], '')),
            target_url: Api.getValue(ad, ['target_url', 'redirect_url', 'url', 'link'], ''),
            start_date: Api.getValue(ad, ['start_date', 'starts_at', 'start_at'], ''),
            end_date: Api.getValue(ad, ['end_date', 'ends_at', 'end_at'], ''),
            status,
            is_active: status === 'active',
            click_count: Number(Api.getValue(ad, ['click_count', 'clicks'], 0)) || 0,
            impression_count: Number(Api.getValue(ad, ['impression_count', 'impressions'], 0)) || 0
        };
    }

    function groupAdvertisements(ads) {
        const grouped = {
            top_banner: [],
            sidebar: [],
            between_articles: [],
            footer_banner: []
        };

        (Array.isArray(ads) ? ads : []).forEach((ad) => {
            const normalized = normalizeAdvertisement(ad);

            if (!isActiveAdvertisement(normalized)) {
                return;
            }

            grouped[normalized.position]?.push(normalized);
        });

        return grouped;
    }

    async function loadAdvertisements(page = 1, options = {}) {
        const result = await Api.loadList(LIST_ENDPOINTS, page, options);
        return {
            endpoint: result.endpoint,
            data: {
                ...result.data,
                results: result.data.results.map(normalizeAdvertisement)
            }
        };
    }

    async function loadPublicAdvertisements(options = {}) {
        const result = await Api.firstSuccessful(['/api/ads/', '/ads/', '/advertisements/'], (endpoint) => Api.request('GET', endpoint, {
            ...options,
            auth: false
        }));

        const normalized = Api.normalizeList(result.response);

        return {
            endpoint: result.endpoint,
            data: {
                ...normalized,
                results: normalized.results.map(normalizeAdvertisement).filter((ad) => isActiveAdvertisement(ad))
            }
        };
    }

    async function createAdvertisement(payload, options = {}) {
        return Api.createItem(LIST_ENDPOINTS, payload, options);
    }

    async function updateAdvertisement(id, payload, options = {}) {
        return Api.firstSuccessful(['/api/ads/', '/ads/', '/advertisements/'].map((base) => `${String(base).replace(/\/+$/, '')}/${id}/`), async (endpoint) => {
            try {
                return await Api.request('PATCH', endpoint, {
                    ...options,
                    data: payload
                });
            } catch (error) {
                if (error?.response?.status === 405) {
                    return Api.request('PUT', endpoint, {
                        ...options,
                        data: payload
                    });
                }

                throw error;
            }
        });
    }

    async function deleteAdvertisement(id, options = {}) {
        return Api.firstSuccessful(['/api/ads/', '/ads/', '/advertisements/'].map((base) => `${String(base).replace(/\/+$/, '')}/${id}/`), (endpoint) => Api.request('DELETE', endpoint, options));
    }

    async function toggleAdvertisementStatus(id, isActive, options = {}) {
        return updateAdvertisement(id, {
            is_active: Boolean(isActive),
            active: Boolean(isActive),
            status: isActive ? 'active' : 'inactive'
        }, options);
    }

    async function trackAdvertisementEvent(ad, type, options = {}) {
        if (!ad?.id) {
            return null;
        }

        const eventPath = `/api/ads/${ad.id}/${type}/`;
        const countKey = type === 'click' ? 'click_count' : 'impression_count';

        try {
            return await Api.request('POST', eventPath, {
                ...options,
                auth: false,
                data: {}
            });
        } catch {
            try {
                return await updateAdvertisement(ad.id, {
                    [countKey]: Number(ad[countKey] || 0) + 1
                }, options);
            } catch {
                return null;
            }
        }
    }

    function buildAdCard(ad, onClick = null) {
        const link = document.createElement('a');
        link.className = 'ad-card';
        link.href = ad.target_url || '#';
        link.target = '_blank';
        link.rel = 'noopener sponsored';
        link.setAttribute('aria-label', `${ad.title || 'Advertisement'} sponsored`);

        if (typeof onClick === 'function') {
            link.addEventListener('click', () => onClick(ad));
        }

        const imageUrl = ad.image_url || '';

        if (imageUrl) {
            const image = document.createElement('img');
            image.src = imageUrl;
            image.alt = ad.title || 'Advertisement';
            image.loading = 'lazy';
            link.appendChild(image);
            return link;
        }

        const fallback = document.createElement('span');
        fallback.className = 'ad-card__fallback';
        fallback.innerHTML = `
            <span>
                <span class="ad-card__label">Sponsored</span>
                <span class="ad-card__title">${Api.escapeHtml(ad.title || 'Advertisement')}</span>
            </span>
            <span class="ad-card__client">${Api.escapeHtml(ad.description || 'Learn more')}</span>
        `;
        link.appendChild(fallback);
        return link;
    }

    async function renderAdSlots(root = document) {
        const slots = root.querySelectorAll('[data-ad-slot]');

        if (!slots.length) {
            return [];
        }

        const result = await loadPublicAdvertisements();
        const grouped = groupAdvertisements(result.data.results);

        slots.forEach((slot) => {
            const position = normalizePosition(slot.dataset.adSlot);
            const ad = grouped[position]?.[0];

            if (!ad) {
                return;
            }

            slot.classList.add('has-ad');
            slot.innerHTML = '';
            slot.appendChild(buildAdCard(ad, (selectedAd) => trackAdvertisementEvent(selectedAd, 'click').catch(() => { })));

            if (Api.getValue(ad, ['id'], null)) {
                trackAdvertisementEvent(ad, 'impression').catch(() => { });
            }
        });

        return result.data.results;
    }

    window.NewsPortalAdvertisementService = {
        buildAdCard,
        createAdvertisement,
        deleteAdvertisement,
        groupAdvertisements,
        isActiveAdvertisement,
        loadAdvertisements,
        loadPublicAdvertisements,
        normalizeAdvertisement,
        normalizePosition,
        positionLabel,
        renderAdSlots,
        toggleAdvertisementStatus,
        trackAdvertisementEvent,
        updateAdvertisement
    };
})(window);
