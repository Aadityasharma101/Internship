document.addEventListener('DOMContentLoaded', () => {
    const saveBtn = document.getElementById('saveArticleBtn');
    const fileInput = document.getElementById('articleImageFile');
    const statusEl = document.getElementById('articleFormStatus') || document.getElementById('staff-form-status');

    if (!saveBtn) return;

    function getCookie(name) {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop().split(';').shift();
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
        const statusElInput = document.getElementById('articleStatus');
        const imageUrlEl = document.getElementById('articleImage');
        const descriptionEl = document.getElementById('articleDescription');
        const bodyEl = document.getElementById('articleBody');
        const featuredEl = document.getElementById('articleFeatured');
        const publishedEl = document.getElementById('articlePublished');

        const title = titleEl ? titleEl.value.trim() : '';
        if (!title) {
            if (statusEl) statusEl.textContent = 'Title is required.';
            return;
        }

        saveBtn.disabled = true;
        if (statusEl) statusEl.textContent = idEl && idEl.value ? 'Saving article...' : 'Creating article...';

        const formData = new FormData();
        formData.append('title', title);
        formData.append('body', bodyEl ? bodyEl.value : '');
        formData.append('description', descriptionEl ? descriptionEl.value : '');
        if (categoryEl && categoryEl.value) formData.append('category', categoryEl.value);
        if (statusElInput && statusElInput.value) formData.append('status', statusElInput.value);
        if (featuredEl) formData.append('featured', featuredEl.checked ? 'true' : 'false');
        if (publishedEl) formData.append('published', publishedEl.checked ? 'true' : 'false');

        // prefer uploaded file if present, otherwise send image URL
        if (fileInput && fileInput.files && fileInput.files[0]) {
            formData.append('image', fileInput.files[0]);
        } else if (imageUrlEl && imageUrlEl.value) {
            formData.append('image', imageUrlEl.value);
        }

        const csrf = getCookie('csrftoken');

        try {
            const localToken = localStorage.getItem('access_token') || localStorage.getItem('accessToken');
            const headers = { 'X-CSRFToken': csrf };
            if (localToken) headers['Authorization'] = `Bearer ${localToken}`;

            const resp = await axios.post('/staff/add_article/', formData, {
                headers
            });

            if (resp.status >= 200 && resp.status < 300) {
                if (statusEl) statusEl.textContent = 'Article submitted successfully.';
                // close modal if available
                if (typeof closeModal === 'function') closeModal();
                if (typeof resetForm === 'function') resetForm();

                // refresh article list if available
                if (typeof loadArticles === 'function') {
                    try { await loadArticles(currentArticlePage || 1); } catch (err) {}
                }
            } else {
                if (statusEl) statusEl.textContent = `Error: ${resp.status}`;
            }
        } catch (err) {
            console.error(err);
            if (statusEl) statusEl.textContent = 'Failed to submit article.';
        } finally {
            saveBtn.disabled = false;
        }
    }, true);
});
