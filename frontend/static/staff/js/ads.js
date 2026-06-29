(function () {
    const Api = window.NewsPortalApi;
    const AdService = window.NewsPortalAdvertisementService;
    const Utils = window.StaffUtils;

    const state = {
        user: null,
        ads: [],
        imageFile: null,
        imagePreviewUrl: ''
    };
    const hasAuth = Boolean(window.NewsPortalAuth?.hasStoredAuthToken?.());

    const els = {
        tbody: document.getElementById('adsTableBody'),
        refresh: document.getElementById('refreshAdsBtn'),
        open: document.getElementById('openAdModalBtn'),
        search: document.getElementById('adSearchInput'),
        visible: document.getElementById('visibleAdsCount'),
        total: document.getElementById('totalAds'),
        active: document.getElementById('activeAds'),
        inactive: document.getElementById('inactiveAds'),
        topBanner: document.getElementById('topBannerAds'),
        modal: document.getElementById('adModal'),
        modalTitle: document.getElementById('adModalTitle'),
        close: document.getElementById('closeAdModalBtn'),
        save: document.getElementById('saveAdBtn'),
        toggle: document.getElementById('toggleAdStatusBtn'),
        status: document.getElementById('adFormStatus'),
        id: document.getElementById('adId'),
        title: document.getElementById('adTitle'),
        image: document.getElementById('adImage'),
        imageFile: document.getElementById('adImageFile'),
        clearImage: document.getElementById('clearAdImageBtn'),
        imagePreview: document.getElementById('adImagePreview'),
        redirectUrl: document.getElementById('adRedirectUrl'),
        description: document.getElementById('adDescription'),
        position: document.getElementById('adPosition'),
        adStatus: document.getElementById('adStatus'),
        startDate: document.getElementById('adStartDate'),
        endDate: document.getElementById('adEndDate')
    };

    function toDateInput(value) {
        if (!value) {
            return '';
        }

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {
            return '';
        }

        const pad = (num) => String(num).padStart(2, '0');
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
    }

    function revokePreviewUrl() {
        if (state.imagePreviewUrl && state.imagePreviewUrl.startsWith('blob:')) {
            URL.revokeObjectURL(state.imagePreviewUrl);
        }
        state.imagePreviewUrl = '';
    }

    function setPreview(url, emptyLabel = 'No image selected') {
        if (!els.imagePreview) {
            return;
        }

        if (!url) {
            els.imagePreview.innerHTML = `<div class="preview-empty">${Api.escapeHtml(emptyLabel)}</div>`;
            els.imagePreview.classList.remove('hidden');
            return;
        }

        els.imagePreview.innerHTML = `<img src="${Api.escapeHtml(url)}" alt="Advertisement image preview" loading="lazy">`;
        els.imagePreview.classList.remove('hidden');
    }

    function resetImageState() {
        revokePreviewUrl();
        state.imageFile = null;
        els.imageFile.value = '';
        els.image.value = '';
        setPreview('', 'No image selected');
    }

    function renderSummary(items) {
        els.total.textContent = items.length;
        els.active.textContent = items.filter((ad) => AdService.isActiveAdvertisement(ad)).length;
        els.inactive.textContent = items.filter((ad) => !AdService.isActiveAdvertisement(ad)).length;
        els.topBanner.textContent = items.filter((ad) => ad.position === 'top_banner').length;
    }

    function renderAds() {
        const query = els.search.value.trim().toLowerCase();
        const filtered = state.ads.filter((ad) => [
            ad.title,
            ad.description,
            ad.position_label,
            ad.target_url,
            ad.status
        ].join(' ').toLowerCase().includes(query));

        els.visible.textContent = `${filtered.length} advertisement${filtered.length === 1 ? '' : 's'} shown`;

        if (!filtered.length) {
            Utils.setTableMessage(els.tbody, 6, query ? 'No advertisements match your search.' : 'No advertisements found.');
            return;
        }

        els.tbody.innerHTML = filtered.map((ad) => `
            <tr>
                <td>
                    <div class="primary-cell">
                        <strong>${Api.escapeHtml(ad.title || 'Untitled advertisement')}</strong>
                        <span>${Api.escapeHtml(ad.description || 'No description added')}</span>
                    </div>
                </td>
                <td><span class="pill pill-blue">${Api.escapeHtml(ad.position_label || AdService.positionLabel(ad.position))}</span></td>
                <td><span class="pill ${AdService.isActiveAdvertisement(ad) ? 'pill-green' : 'pill-orange'}">${Api.escapeHtml(ad.status || 'inactive')}</span></td>
                <td class="article-meta-muted">${Api.escapeHtml(Api.formatDate(ad.start_date || ad.created_at))} - ${Api.escapeHtml(Api.formatDate(ad.end_date))}</td>
                <td>${ad.target_url ? `<a class="muted-text" href="${Api.escapeHtml(ad.target_url)}" target="_blank" rel="noopener">${Api.escapeHtml(ad.target_url)}</a>` : '<span class="muted-text">Not available</span>'}</td>
                <td>
                    <div class="row-actions">
                        <button type="button" data-action="edit" data-id="${Api.escapeHtml(ad.id)}" title="Edit advertisement" aria-label="Edit advertisement">
                            <i class="fa-regular fa-pen-to-square"></i>
                        </button>
                        <button type="button" data-action="toggle" data-id="${Api.escapeHtml(ad.id)}" title="Toggle status" aria-label="Toggle status">
                            <i class="fa-solid ${AdService.isActiveAdvertisement(ad) ? 'fa-toggle-on' : 'fa-toggle-off'}"></i>
                        </button>
                        <button class="danger-action" type="button" data-action="delete" data-id="${Api.escapeHtml(ad.id)}" title="Delete advertisement" aria-label="Delete advertisement">
                            <i class="fa-regular fa-trash-can"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    }

    async function loadAds() {
        Utils.setTableMessage(els.tbody, 6, 'Loading advertisements...');

        try {
            if (hasAuth) {
                try {
                    state.user = await window.NewsPortalSession.fetchCurrentUser();
                } catch {
                    state.user = null;
                }
            } else {
                state.user = null;
            }

            const requestOptions = hasAuth ? {
                params: {
                    ordering: '-id'
                }
            } : {
                auth: false,
                params: {
                    ordering: '-id'
                }
            };

            const result = await Utils.loadAllPages((page, options) => AdService.loadAdvertisements(page, {
                ...requestOptions,
                ...options,
                params: {
                    ...(requestOptions.params || {}),
                    ...(options.params || {})
                }
            }));

            state.ads = Utils.sortByNewest(result.data.results, ['updated_at', 'created_at', 'start_date']);
            renderSummary(state.ads);
            renderAds();
        } catch (error) {
            console.error('Unable to load advertisements:', error);
            Utils.setTableMessage(els.tbody, 6, 'Unable to load advertisements. Please check the API token or try again.');
            state.ads = [];
            renderSummary([]);
        }
    }

    function resetForm() {
        els.id.value = '';
        els.title.value = '';
        els.image.value = '';
        els.redirectUrl.value = '';
        els.description.value = '';
        els.position.value = 'top_banner';
        els.adStatus.value = 'active';
        els.startDate.value = '';
        els.endDate.value = '';
        els.status.textContent = '';
        resetImageState();
    }

    function fillForm(ad) {
        els.id.value = ad.id || '';
        els.title.value = ad.title || '';
        els.image.value = ad.image_url || Api.getValue(ad, ['image', 'image_url'], '');
        els.redirectUrl.value = ad.target_url || '';
        els.description.value = ad.description || '';
        els.position.value = AdService.toApiPosition ? AdService.toApiPosition(ad.position) : ad.position;
        els.adStatus.value = AdService.isActiveAdvertisement(ad) ? 'active' : 'inactive';
        els.startDate.value = toDateInput(ad.start_date);
        els.endDate.value = toDateInput(ad.end_date);
        state.imageFile = null;
        els.imageFile.value = '';
        setPreview(els.image.value, 'No image selected');
    }

    function openCreateModal() {
        resetForm();
        els.modalTitle.textContent = 'Create Advertisement';
        els.modal.classList.remove('hidden');
    }

    function openEditModal(ad) {
        resetForm();
        fillForm(ad);
        els.modalTitle.textContent = 'Edit Advertisement';
        els.modal.classList.remove('hidden');
    }

    function closeModal() {
        els.modal.classList.add('hidden');
    }

    function buildPayload() {
        const payload = new FormData();
        const title = els.title.value.trim();
        const description = els.description.value.trim();
        const imageUrl = els.image.value.trim();
        const startDate = els.startDate.value ? new Date(els.startDate.value).toISOString() : '';
        const endDate = els.endDate.value ? new Date(els.endDate.value).toISOString() : '';
        const position = AdService.toApiPosition ? AdService.toApiPosition(els.position.value) : els.position.value;

        payload.append('title', title);
        payload.append('client_name', description || title);
        payload.append('target_url', els.redirectUrl.value.trim());
        payload.append('position', position);

        if (state.imageFile) {
            payload.append('image', state.imageFile);
        } else if (imageUrl) {
            payload.append('image', imageUrl);
        }

        payload.append('start_date', startDate || new Date().toISOString());

        if (els.adStatus.value === 'inactive') {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            payload.append('end_date', yesterday.toISOString());
        } else if (endDate) {
            payload.append('end_date', endDate);
        } else {
            const nextYear = new Date();
            nextYear.setFullYear(nextYear.getFullYear() + 1);
            payload.append('end_date', nextYear.toISOString());
        }

        return payload;
    }

    function payloadValue(payload, key) {
        return payload instanceof FormData ? payload.get(key) : payload[key];
    }

    function validatePayload(payload, id) {
        if (!payloadValue(payload, 'title')) {
            return 'Title is required.';
        }

        if (!payloadValue(payload, 'target_url')) {
            return 'Redirect URL is required.';
        }

        if (!id && !payloadValue(payload, 'image')) {
            return 'Image is required.';
        }

        try {
            new URL(payloadValue(payload, 'target_url'));
        } catch {
            return 'Enter a valid redirect URL.';
        }

        const image = payloadValue(payload, 'image');
        if (typeof image === 'string' && image) {
            try {
                new URL(image);
            } catch {
                return 'Enter a valid image URL or upload an image file.';
            }
        }

        if (state.imageFile && !state.imageFile.type.startsWith('image/')) {
            return 'Upload a valid image file.';
        }

        const startDate = new Date(payloadValue(payload, 'start_date'));
        const endDate = new Date(payloadValue(payload, 'end_date'));

        if (!Number.isNaN(startDate.getTime()) && !Number.isNaN(endDate.getTime()) && endDate <= startDate) {
            return 'End date must be after start date.';
        }

        return '';
    }

    function showStatus(message) {
        els.status.textContent = message;
        window.setTimeout(() => {
            if (els.status.textContent === message) {
                els.status.textContent = '';
            }
        }, 2500);
    }

    function getCurrentAd() {
        const id = els.id.value;
        return state.ads.find((ad) => String(ad.id) === String(id));
    }

    async function saveAd() {
        const id = els.id.value;
        const payload = buildPayload();
        const validationMessage = validatePayload(payload, id);

        if (validationMessage) {
            els.status.textContent = validationMessage;
            return;
        }

        els.save.disabled = true;
        els.toggle.disabled = true;
        els.status.textContent = id ? 'Saving advertisement...' : 'Creating advertisement...';

        try {
            if (id) {
                await AdService.updateAdvertisement(id, payload);
            } else {
                await AdService.createAdvertisement(payload);
            }

            showStatus(id ? 'Advertisement saved successfully.' : 'Advertisement created successfully.');
            closeModal();
            await loadAds();
        } catch (error) {
            console.error('Unable to save advertisement:', error);
            els.status.textContent = 'Unable to save advertisement. Check required fields, login, and permissions.';
        } finally {
            els.save.disabled = false;
            els.toggle.disabled = false;
        }
    }

    async function toggleAd(ad) {
        try {
            await AdService.toggleAdvertisementStatus(ad.id, !AdService.isActiveAdvertisement(ad));
            showStatus('Advertisement status updated.');
            await loadAds();
        } catch (error) {
            console.error('Unable to toggle advertisement:', error);
            window.alert('Unable to update the advertisement status right now.');
        }
    }

    async function deleteAd(ad) {
        if (!window.confirm(`Delete "${ad.title}"? This cannot be undone.`)) {
            return;
        }

        try {
            await AdService.deleteAdvertisement(ad.id);
            await loadAds();
        } catch (error) {
            console.error('Unable to delete advertisement:', error);
            window.alert('Unable to delete this advertisement right now.');
        }
    }

    els.tbody.addEventListener('click', (event) => {
        const button = event.target.closest('button[data-action]');

        if (!button) {
            return;
        }

        const ad = state.ads.find((item) => String(item.id) === String(button.dataset.id));

        if (!ad) {
            return;
        }

        if (button.dataset.action === 'edit') {
            openEditModal(ad);
        }

        if (button.dataset.action === 'toggle') {
            toggleAd(ad);
        }

        if (button.dataset.action === 'delete') {
            deleteAd(ad);
        }
    });

    els.refresh.addEventListener('click', loadAds);
    els.open.addEventListener('click', openCreateModal);
    els.close.addEventListener('click', closeModal);
    els.save.addEventListener('click', saveAd);
    els.toggle.addEventListener('click', () => {
        const ad = getCurrentAd();

        if (!ad) {
            els.status.textContent = 'Save the advertisement first, then toggle its status.';
            return;
        }

        toggleAd(ad);
    });
    els.search.addEventListener('input', renderAds);
    els.image.addEventListener('input', () => {
        if (state.imageFile) {
            return;
        }

        setPreview(els.image.value.trim(), 'No image selected');
    });
    els.imageFile.addEventListener('change', () => {
        const file = els.imageFile.files?.[0] || null;
        state.imageFile = file;

        if (file) {
            revokePreviewUrl();
            const objectUrl = URL.createObjectURL(file);
            state.imagePreviewUrl = objectUrl;
            els.image.value = '';
            setPreview(objectUrl, 'No image selected');
        } else {
            setPreview(els.image.value.trim(), 'No image selected');
        }
    });
    els.clearImage.addEventListener('click', resetImageState);
    els.modal.addEventListener('click', (event) => {
        if (event.target === els.modal) {
            closeModal();
        }
    });

    document.addEventListener('DOMContentLoaded', loadAds);
})();
