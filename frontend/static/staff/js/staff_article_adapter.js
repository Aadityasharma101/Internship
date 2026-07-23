document.addEventListener('DOMContentLoaded', () => {
    const saveBtn = document.getElementById('saveArticleBtn');
    const fileInput = document.getElementById('articleImageFile');
    const clearImageBtn = document.getElementById('clearArticleImageBtn');
    const imagePreview = document.getElementById('articleImagePreview');
    const statusEl = document.getElementById('articleFormStatus') || document.getElementById('staff-form-status');

    if (!saveBtn) return;

    function getCookie(name) {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop().split(';').shift();
    }

    function apiErrorMessage(err) {
        const data = err?.response?.data;
        if (!data) return err?.message || 'Failed to submit article.';
        if (typeof data === 'string') return data;
        if (data.detail) return Array.isArray(data.detail) ? data.detail.join(' ') : data.detail;
        return Object.entries(data)
            .map(([field, value]) => `${field.replace(/_/g, ' ')}: ${Array.isArray(value) ? value.join(' ') : value}`)
            .join(' ') || 'Failed to submit article.';
    }

    function setPreview(url, emptyLabel = 'No image selected') {
        if (!imagePreview) return;

        if (!url) {
            imagePreview.innerHTML = `<div class="preview-empty">${emptyLabel}</div>`;
            imagePreview.classList.remove('hidden');
            return;
        }

        imagePreview.innerHTML = `<img src="${url}" alt="Article image preview" loading="lazy">`;
        imagePreview.classList.remove('hidden');
    }

    function clearImageSelection() {
        const imageUrlEl = document.getElementById('articleImage');
        if (fileInput) fileInput.value = '';
        if (imageUrlEl) imageUrlEl.value = '';
        setPreview('', 'No image selected');
    }

    async function getFreshAccessToken() {
        if (window.NewsPortalSession?.getAccessToken) {
            try {
                return await window.NewsPortalSession.getAccessToken();
            } catch {
                return null;
            }
        }

        return localStorage.getItem('access_token') || localStorage.getItem('accessToken');
    }

    if (clearImageBtn) {
        clearImageBtn.addEventListener('click', clearImageSelection);
    }

    if (fileInput) {
        fileInput.addEventListener('change', () => {
            const file = fileInput.files?.[0];
            if (file) {
                setPreview(URL.createObjectURL(file));
            }
        });
    }

    // Capture phase handler to intercept admin's default JSON submission
    saveBtn.addEventListener('click', async function (e) {
        // Only run on staff pages where the staff adapter is included
        try {
            e.stopImmediatePropagation();
            e.preventDefault();
        } catch (err) {}

        const idEl = document.getElementById('articleId');
        const titleEl = document.getElementById('articleTitle');
        const categoryEl = document.getElementById('articleCategory');
        const imageUrlEl = document.getElementById('articleImage');
        const descriptionEl = document.getElementById('articleDescription');
        const bodyEl = document.getElementById('articleBody');

        const title = titleEl ? titleEl.value.trim() : '';
        const body = bodyEl ? bodyEl.value.trim() : '';
        const description = descriptionEl ? descriptionEl.value.trim() : '';

        if (!title) {
            if (statusEl) statusEl.textContent = 'Title is required.';
            return;
        }

        if (!body) {
            if (statusEl) statusEl.textContent = 'Body is required.';
            return;
        }

        saveBtn.disabled = true;
        if (statusEl) statusEl.textContent = idEl && idEl.value ? 'Saving article...' : 'Creating article...';

        const hasFile = fileInput && fileInput.files && fileInput.files[0];
        const payload = {
            title,
            body
        };

        if (description) {
            payload.summary = description;
        }

        const categoryValue = categoryEl ? categoryEl.value.trim() : '';
        if (categoryValue) {
            if (/^\d+$/.test(categoryValue)) {
                payload.category_id = categoryValue;
            } else if (!Number.isNaN(Number(categoryValue)) && categoryValue !== '') {
                payload.category_id = String(Number(categoryValue));
            } else {
                payload.category_name = categoryValue;
            }
        }

        let requestBody = payload;
        if (hasFile) {
            requestBody = new FormData();
            Object.entries(payload).forEach(([key, value]) => {
                if (value !== undefined && value !== null) {
                    requestBody.append(key, value);
                }
            });

            requestBody.append('image', fileInput.files[0]);
        } else if (imageUrlEl && imageUrlEl.value) {
            payload.image = imageUrlEl.value.trim();
        }

        const csrf = getCookie('csrftoken');

        try {
            const localToken = await getFreshAccessToken();
            const headers = {
                'Accept': 'application/json',
                'X-CSRFToken': csrf,
            };
            if (localToken) {
                headers['Authorization'] = `Bearer ${localToken}`;
            }
            if (!localToken) {
                throw new Error('Please sign in again before posting an article.');
            }

            const endpoint = (window.location.origin || '') + '/staff/add_article/';
            const resp = await axios.post(endpoint, requestBody, {
                headers
            });

            if (resp.status >= 200 && resp.status < 300) {
                if (statusEl) statusEl.textContent = resp.data?.detail || 'Article submitted successfully.';
                // close modal if available
                if (typeof closeModal === 'function') closeModal();
                if (typeof resetForm === 'function') resetForm();
                clearImageSelection();

                // refresh article list if available
                if (typeof loadArticles === 'function') {
                    try { await loadArticles(currentArticlePage || 1); } catch (err) {}
                }
            } else {
                if (statusEl) statusEl.textContent = `Error: ${resp.status}`;
            }
        } catch (err) {
            console.error(err);
            if (statusEl) statusEl.textContent = apiErrorMessage(err);
        } finally {
            saveBtn.disabled = false;
        }
    }, true);
});
