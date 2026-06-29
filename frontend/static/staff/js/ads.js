(function () {
    const Api = window.NewsPortalApi;
    const AdService = window.NewsPortalAdvertisementService;
    const Utils = window.StaffUtils;

    const state = {
        user: null,
        ads: []
    };

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
            state.user = await window.NewsPortalSession.fetchCurrentUser();
            const result = await Utils.loadAllPages((page, options) => AdService.loadAdvertisements(page, {
                ...options,
                params: {
                    ...(options.params || {}),
                    ordering: '-id'
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
    }

    function fillForm(ad) {
        els.id.value = ad.id || '';
        els.title.value = ad.title || '';
        els.image.value = ad.image_url || Api.getValue(ad, ['image', 'image_url'], '');
        els.redirectUrl.value = ad.target_url || '';
        els.description.value = ad.description || '';
        els.position.value = AdService.normalizePosition(ad.position);
        els.adStatus.value = AdService.isActiveAdvertisement(ad) ? 'active' : 'inactive';
        els.startDate.value = toDateInput(ad.start_date);
        els.endDate.value = toDateInput(ad.end_date);
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
        const payload = {
            title: els.title.value.trim(),
            image: els.image.value.trim(),
            image_url: els.image.value.trim(),
            target_url: els.redirectUrl.value.trim(),
            redirect_url: els.redirectUrl.value.trim(),
            description: els.description.value.trim(),
            position: els.position.value,
            placement: els.position.value,
            status: els.adStatus.value,
            is_active: els.adStatus.value === 'active',
            active: els.adStatus.value === 'active',
            start_date: els.startDate.value ? new Date(els.startDate.value).toISOString() : '',
            end_date: els.endDate.value ? new Date(els.endDate.value).toISOString() : ''
        };

        if (!payload.image) {
            delete payload.image;
            delete payload.image_url;
        }

        if (!payload.target_url) {
            delete payload.target_url;
            delete payload.redirect_url;
        }

        if (!payload.start_date) {
            delete payload.start_date;
        }

        if (!payload.end_date) {
            delete payload.end_date;
        }

        return payload;
    }

    function getCurrentAd() {
        const id = els.id.value;
        return state.ads.find((ad) => String(ad.id) === String(id));
    }

    async function saveAd() {
        const id = els.id.value;
        const payload = buildPayload();

        if (!payload.title) {
            els.status.textContent = 'Title is required.';
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

            closeModal();
            await loadAds();
        } catch (error) {
            console.error('Unable to save advertisement:', error);
            els.status.textContent = 'Unable to save advertisement. Check required fields and permissions.';
        } finally {
            els.save.disabled = false;
            els.toggle.disabled = false;
        }
    }

    async function toggleAd(ad) {
        try {
            await AdService.toggleAdvertisementStatus(ad.id, !AdService.isActiveAdvertisement(ad));
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
    els.modal.addEventListener('click', (event) => {
        if (event.target === els.modal) {
            closeModal();
        }
    });

    document.addEventListener('DOMContentLoaded', loadAds);
})();
