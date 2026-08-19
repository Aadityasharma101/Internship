/* Shared bookmark UI and local bookmark API client. */
(function () {
    const state = new Map();
    const icon = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 3.75A1.75 1.75 0 0 1 7.75 2h8.5A1.75 1.75 0 0 1 18 3.75V22l-6-3.65L6 22V3.75Z"></path></svg>';
    const apiUrl = (path) => `${window.location.origin}${path}`;
    const escapeHtml = (value) => String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    const labelForCount = (count) => String(Number.isFinite(Number(count)) ? Number(count) : 0);

    function renderButton(article) {
        const id = Number(article?.id);
        if (!id) return '';
        const current = state.get(id) || { bookmark_count: Number(article.bookmark_count || article.bookmarks_count || 0), is_bookmarked: Boolean(article.is_bookmarked) };
        const label = current.is_bookmarked ? 'Remove bookmark' : 'Bookmark article';
        return `<button class="bookmark-button${current.is_bookmarked ? ' is-saved' : ''}" type="button" data-bookmark-id="${id}" data-bookmark-title="${escapeHtml(article.title || '')}" aria-label="${label}" aria-pressed="${current.is_bookmarked}" title="${label}">${icon}<span class="bookmark-button__count">${labelForCount(current.bookmark_count)}</span></button>`;
    }

    function updateButtons(articleId, item) {
        state.set(Number(articleId), item);
        document.querySelectorAll(`[data-bookmark-id="${articleId}"]`).forEach((button) => {
            const saved = Boolean(item.is_bookmarked);
            button.classList.toggle('is-saved', saved);
            button.setAttribute('aria-pressed', String(saved));
            button.title = saved ? 'Remove bookmark' : 'Bookmark article';
            button.setAttribute('aria-label', saved ? 'Remove bookmark' : 'Bookmark article');
            const count = button.querySelector('.bookmark-button__count');
            if (count) count.textContent = labelForCount(item.bookmark_count);
        });
    }

    async function authorizationHeader() {
        try {
            const token = await window.NewsPortalSession?.getAccessToken?.();
            return token ? { Authorization: `Bearer ${token}` } : {};
        } catch { return {}; }
    }

    async function hydrate(articles) {
        const ids = [...new Set((articles || []).map((article) => Number(article?.id)).filter(Boolean))];
        if (!ids.length) return;
        try {
            const query = ids.map((id) => `article_id=${encodeURIComponent(id)}`).join('&');
            const auth = await authorizationHeader();
            // The remote bookmark status endpoint requires JWT. Preserve any
            // public bookmark_count already included in the article feed when
            // the visitor is anonymous.
            if (!auth.Authorization) return;
            const response = await fetch(apiUrl(`/api/bookmarks/?${query}`), { headers: { Accept: 'application/json', ...auth } });
            if (!response.ok) return;
            const data = await response.json();
            (articles || []).forEach((article) => {
                const item = data.bookmarks?.[String(article?.id)] || {};
                const current = state.get(Number(article?.id)) || {};
                const count = Number(article?.bookmark_count ?? article?.bookmarks_count ?? current.bookmark_count ?? 0);
                const merged = { ...current, ...item, bookmark_count: count };
                Object.assign(article, merged);
                updateButtons(article.id, merged);
            });
        } catch (error) { console.warn('Could not load bookmark totals.', error); }
    }

    async function toggle(button) {
        const articleId = Number(button.dataset.bookmarkId);
        if (!articleId || button.disabled) return;
        const headers = await authorizationHeader();
        if (!headers.Authorization) {
            window.location.href = `/login/?next=${encodeURIComponent(window.location.pathname)}`;
            return;
        }
        button.disabled = true;
        try {
            const response = await fetch(apiUrl(`/api/articles/${articleId}/bookmarks/`), {
                method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...headers },
                body: JSON.stringify({ article_title: button.dataset.bookmarkTitle || '' }),
            });
            const data = await response.json().catch(() => ({}));
            if (response.status === 401) {
                window.NewsPortalSession?.clear?.();
                window.location.href = `/login/?next=${encodeURIComponent(window.location.pathname)}`;
                return;
            }
            if (!response.ok) throw new Error(data.detail || 'Unable to update bookmark.');
            const article = {
                id: articleId,
                title: button.dataset.bookmarkTitle || '',
                bookmark_count: state.get(articleId)?.bookmark_count || 0,
            };
            // Re-read the current-user state from the existing endpoint, then
            // re-read the article's authoritative bookmark_count.
            await hydrate([article]);
            try {
                const detail = await fetch(apiUrl(`/api/articles/${articleId}/`), { headers: { Accept: 'application/json', ...headers } });
                const detailData = await detail.json().catch(() => ({}));
                if (Number.isFinite(Number(detailData.bookmark_count))) {
                    const current = state.get(articleId) || {};
                    updateButtons(articleId, { ...current, bookmark_count: Number(detailData.bookmark_count) });
                }
            } catch (refreshError) {
                console.warn('Could not refresh bookmark count.', refreshError);
            }
        } catch (error) { alert(error.message || 'Unable to update bookmark.'); }
        finally { button.disabled = false; }
    }

    document.addEventListener('click', (event) => {
        const button = event.target.closest('[data-bookmark-id]');
        if (button) toggle(button);
    });
    window.ArticleBookmarks = { hydrate, renderButton, updateButtons };
}());
