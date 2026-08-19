(function () {
    const grid = document.getElementById('savedGrid');
    const message = document.getElementById('savedMessage');
    const total = document.getElementById('savedTotal');

    const escapeHtml = (value) => String(value || '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#039;');

    function itemsFrom(payload) {
        if (Array.isArray(payload)) return payload;
        return payload?.results || payload?.bookmarks || [];
    }

    function normalize(item) {
        const article = item?.article || item?.news || item?.post || item || {};
        return {
            id: article.id || item?.article_id,
            title: article.title || item?.article_title || 'Saved article',
            summary: article.summary || article.description || article.body || 'Read the full story.',
            image: article.image || article.image_url || article.thumbnail || article.thumbnail_url || '',
            category: article.category_name || article.category || 'News',
            date: article.published_at || article.bookmarked_at || item?.created_at || '',
            bookmark_count: article.bookmark_count || 0,
            is_bookmarked: true,
        };
    }

    function formatDate(value) {
        if (!value) return 'Saved recently';
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? 'Saved recently' : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    }

    function render(payload) {
        const articles = itemsFrom(payload).map(normalize).filter((article) => article.id);
        total.textContent = `${articles.length} saved`;
        if (!articles.length) {
            grid.innerHTML = '<div class="saved-empty"><div class="saved-empty-icon">⌑</div><h2>No bookmarks yet</h2><p>Articles you save will appear here.</p><a href="/" class="btn-nav btn-nav--primary">Explore latest news</a></div>';
            return;
        }
        grid.innerHTML = articles.map((article) => `
            <article class="saved-card">
                <a class="saved-card-link" href="/news/${encodeURIComponent(article.id)}/">
                    <div class="saved-card-image">${article.image ? `<img src="${escapeHtml(article.image)}" alt="" loading="lazy">` : '<span>No image</span>'}</div>
                    <div class="saved-card-body">
                        <div class="saved-card-meta"><span>${escapeHtml(article.category)}</span><time>${escapeHtml(formatDate(article.date))}</time></div>
                        <h2>${escapeHtml(article.title)}</h2>
                        <p>${escapeHtml(article.summary).slice(0, 150)}</p>
                    </div>
                </a>
                ${window.ArticleBookmarks?.renderButton?.(article) || ''}
            </article>
        `).join('');
        window.ArticleBookmarks?.hydrate?.(articles);
    }

    document.addEventListener('DOMContentLoaded', async () => {
        try {
            const token = await window.NewsPortalSession?.getAccessToken?.();
            if (!token) {
                window.location.href = `/login/?next=${encodeURIComponent('/bookmarks/')}`;
                return;
            }
            const response = await fetch(`${window.location.origin}/api/articles/my-bookmarks/`, {
                headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
            });
            if (response.status === 401) throw new Error('Please sign in again.');
            if (!response.ok) throw new Error('Unable to load your bookmarks.');
            render(await response.json());
        } catch (error) {
            message.textContent = error.message || 'Unable to load your bookmarks.';
            message.className = 'saved-message error';
            grid.innerHTML = '';
        }
    });
}());
