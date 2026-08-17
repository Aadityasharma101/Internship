(function(){
    const remoteDefault = 'https://news-portal-hvgs.onrender.com/api';
    const body = document.body;
    const apiBase = (body && body.dataset && body.dataset.apiBase) ? body.dataset.apiBase.replace(/\/+$/,'') : '';
    // prefer explicit window config if present, otherwise use server-provided data-api-base
    const configuredBase = (typeof window !== 'undefined' && window.NEWS_PORTAL_API_BASE) ? String(window.NEWS_PORTAL_API_BASE).replace(/\/+$/,'') : apiBase;
    let remoteApi = configuredBase || remoteDefault;
    // Ensure the remoteApi includes the '/api' path segment so calls like '/articles/' map correctly
    if (!/\/api(\/|$)/.test(remoteApi)) {
        remoteApi = remoteApi.replace(/\/+$/,'') + '/api';
    }

    function getItemsFromResponse(data){
        if (!data) return [];
        if (Array.isArray(data)) return data;
        if (data.results && Array.isArray(data.results)) return data.results;
        if (data.data && Array.isArray(data.data)) return data.data;
        if (data.articles && Array.isArray(data.articles)) return data.articles;
        return [];
    }

    function buildItemUrl(item){
        if (!item) return '#';
        if (item.url) return item.url;
        if (item.detail_url) return item.detail_url;
        if (item.slug) return window.location.origin + '/news/' + item.slug + '/';
        if (item.id) return window.location.origin + '/news/' + item.id + '/';
        return '#';
    }

    function buildItemTitle(item){
        return item.title || item.headline || item.name || 'Untitled';
    }

    function renderResults(container, items){
        container.innerHTML = '';
        container.style.display = 'block';
        if (!items || items.length === 0){
            container.innerHTML = '<div class="search-no-results">No results</div>';
            return;
        }
        const list = document.createElement('ul');
        list.className = 'search-results-list';
        items.slice(0,8).forEach(it => {
            const li = document.createElement('li');
            li.className = 'search-result-item';
            const a = document.createElement('a');
            a.href = buildItemUrl(it);
            a.textContent = buildItemTitle(it);
            a.target = '_blank';
            li.appendChild(a);
            list.appendChild(li);
        });
        container.appendChild(list);
    }

    function doSearch(q, container){
        const query = q.trim();
        if (!query){
            container.style.display = 'none';
            container.innerHTML = '';
            return;
        }
        const url = remoteApi.replace(/\/+$/,'') + '/articles/?search=' + encodeURIComponent(query);
        container.innerHTML = '<div class="search-loading">Searching…</div>';
        fetch(url, { method: 'GET' })
            .then(res => res.json())
            .then(data => {
                const items = getItemsFromResponse(data);
                renderResults(container, items);
            })
            .catch(err => {
                container.innerHTML = '<div class="search-error">Search failed</div>';
                console.error('Search error', err);
            });
    }

    document.addEventListener('DOMContentLoaded', () => {
        const input = document.getElementById('header-search-input');
        const btn = document.getElementById('header-search-btn');
        const results = document.getElementById('header-search-results');
        
        if (!input || !btn || !results){
            console.warn('search.js: missing elements', { input: !!input, btn: !!btn, results: !!results });
            return;
        }

        // trigger search on click
        btn.addEventListener('click', () => doSearch(input.value || '', results));

        // trigger search on Enter
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter'){
                e.preventDefault();
                doSearch(input.value || '', results);
            }
        });

        // hide results when clicking outside
        document.addEventListener('click', (e) => {
            if (!results.contains(e.target) && e.target !== input && e.target !== btn){
                results.style.display = 'none';
            }
        });
    });
})();
