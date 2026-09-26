(function (window) {
    // Default to the remote API base including the `/api` prefix so calls
    // to paths like 'articles/' resolve to 'https://news-portal-hvgs.onrender.com/api/articles/'.
    const DEFAULT_API_ORIGIN = 'https://news-portal-hvgs.onrender.com/api';

    function getApiOrigin(path = '') {
        const rawPath = String(path || '').trim();
        const cleanRawPath = rawPath.replace(/^\/+/, '');

        if (/^https?:\/\//i.test(rawPath)) {
            return rawPath.replace(/\/$/, '');
        }

        const bodyBase = window.document?.body?.dataset?.apiBase;
        const configuredBase = window.NEWS_PORTAL_API_BASE || bodyBase || DEFAULT_API_ORIGIN;
        const localOrigin = window.location?.origin || '';

        // If a specific API base is configured via global `NEWS_PORTAL_API_BASE`
        // or `data-api-base` on the body element, prefer that over the page origin.
        if (window.NEWS_PORTAL_API_BASE || bodyBase) {
            let base = String(configuredBase).replace(/\/$/, '');
            // If the caller is requesting API-style paths (e.g. 'articles/...'),
            // ensure the base includes the '/api' prefix so the final URL
            // becomes '{base}/api/articles/...' when the configured base omitted it.
            if (/^(articles|api|remote|staff)\b/i.test(cleanRawPath) && !/\/api(\/|$)/i.test(base)) {
                base = base.replace(/\/$/, '') + '/api';
            }
            return base;
        }

        // Otherwise, fall back to local origin for absolute/relative paths when available.
        if (!rawPath || rawPath.startsWith('/') || rawPath.startsWith('articles/') || rawPath.startsWith('api/') || rawPath.startsWith('remote/') || rawPath.startsWith('staff/') || rawPath.startsWith('auth/')) {
            return localOrigin || String(configuredBase).replace(/\/$/, '');
        }

        return String(configuredBase).replace(/\/$/, '');
    }

    function appendParams(url, params) {
        if (!params) {
            return url;
        }

        const target = new URL(url);

        if (params instanceof URLSearchParams) {
            params.forEach((value, key) => target.searchParams.append(key, value));
            return target.toString();
        }

        Object.entries(params).forEach(([key, value]) => {
            if (value === null || value === undefined || value === '') {
                return;
            }

            if (Array.isArray(value)) {
                value.forEach((entry) => target.searchParams.append(key, entry));
                return;
            }

            target.searchParams.set(key, value);
        });

        return target.toString();
    }

    function withFreshParam(url) {
        const target = new URL(url);
        target.searchParams.set('_', String(Date.now()));
        return target.toString();
    }

    function buildUrl(path = '', params = null) {
        const rawPath = String(path || '').trim();

        if (!rawPath) {
            return appendParams(getApiOrigin(), params);
        }

        if (/^https?:\/\//i.test(rawPath)) {
            return appendParams(rawPath, params);
        }

        const cleanPath = rawPath.replace(/^\/+/, '');
        const origin = String(getApiOrigin(rawPath)).replace(/\/+$/, '');

        // If callers pass short resource names (e.g. 'feed/', 'trending/', 'categories/')
        // and the origin does not already include an 'articles' segment, assume
        // these refer to the articles collection and prefix with 'articles/'.
        let finalPath = cleanPath;
        if (/^(feed|trending|categories|comments|reporter)\b/i.test(cleanPath) && !/\/articles(\/|$)/i.test(origin) && !/^articles\//i.test(cleanPath)) {
            finalPath = `articles/${cleanPath}`;
        }

        return appendParams(`${origin}/${finalPath}`, params);
    }

    function isFormData(value) {
        return typeof FormData !== 'undefined' && value instanceof FormData;
    }

    function decodeValue(source, key) {
        return key.split('.').reduce((item, part) => item?.[part], source);
    }

    function getValue(source, keys, fallback = '') {
        for (const key of keys) {
            const value = decodeValue(source, key);

            if (value !== null && value !== undefined && value !== '') {
                return value;
            }
        }

        return fallback;
    }

    function normalizeList(payload) {
        if (Array.isArray(payload)) {
            return {
                results: payload,
                count: payload.length,
                next: null,
                previous: null
            };
        }

        const results = payload?.results || payload?.data || [];

        return {
            results,
            count: payload?.count ?? payload?.total ?? results.length,
            next: payload?.next || null,
            previous: payload?.previous || null
        };
    }

    function escapeHtml(value) {
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

    function resolveMediaUrl(value) {
        if (!value) {
            return '';
        }

        if (typeof value === 'object') {
            return resolveMediaUrl(value.url || value.src || value.path || value.file || value.image || value.file_url);
        }

        const url = String(value).trim();

        if (!url) {
            return '';
        }

        if (/^https?:\/\//i.test(url) || url.startsWith('data:')) {
            return url;
        }

        const origin = getApiOrigin();
        const mediaBase = origin.replace(/\/api$/, '');

        if (url.startsWith('/media/')) {
            return `${mediaBase}${url}`;
        }

        if (url.startsWith('media/')) {
            return `${mediaBase}/${url}`;
        }

        if (url.startsWith('/')) {
            return `${mediaBase}${url}`;
        }

        return `${mediaBase}/media/${url}`;
    }

    async function parseResponse(response) {
        const contentType = response.headers.get('content-type') || '';
        // Some APIs return an empty body with a JSON content-type (e.g. 201 Created with no payload).
        // Attempt to parse JSON but fall back to text if parsing fails or body is empty.
        if (contentType.includes('application/json')) {
            try {
                return await response.json();
            } catch (e) {
                try {
                    return await response.text();
                } catch {
                    return null;
                }
            }
        }

        try {
            return await response.text();
        } catch {
            return null;
        }
    }

    async function getAuthToken() {
        if (window.NewsPortalSession?.getAccessToken) {
            try {
                return await window.NewsPortalSession.getAccessToken();
            } catch {
                return null;
            }
        }

        return localStorage.getItem('access_token') || localStorage.getItem('accessToken') || null;
    }

    async function fetchWithTimeout(url, options = {}) {
        const controller = new AbortController();
        const timeoutId = window.setTimeout(() => controller.abort(), options.timeoutMs || 15000);
        const requestUrl = options.fresh === false ? url : withFreshParam(url);

        try {
            // keep minimal logs; errors will be surfaced when thrown

            const response = await fetch(requestUrl, {
                method: options.method || 'GET',
                headers: {
                    Accept: 'application/json',
                    ...(options.headers || {})
                },
                body: options.body,
                signal: controller.signal
            });

            const payload = await parseResponse(response);

            if (!response.ok) {
                const error = new Error(`HTTP ${response.status}`);
                error.response = { status: response.status, data: payload };
                throw error;
            }

            return payload;
        } finally {
            window.clearTimeout(timeoutId);
        }
    }

    function isLocalRoute(path) {
        const rawPath = String(path || '').trim();

        if (!rawPath || /^https?:\/\//i.test(rawPath)) {
            return false;
        }

        return rawPath.startsWith('/') || rawPath.startsWith('articles/') || rawPath.startsWith('api/') || rawPath.startsWith('remote/') || rawPath.startsWith('staff/') || rawPath.startsWith('auth/');
    }

    async function request(method, path, options = {}) {
        const url = buildUrl(path, options.params || null);
        const auth = options.auth !== false;
        const headers = { ...(options.headers || {}) };

        // When data is FormData, avoid using the axios `window.api` instance
        // because the axios instance sets `Content-Type: application/json` by
        // default which breaks multipart form uploads. Use fetch in that case
        // so the browser can set the proper multipart boundary header.
        if (auth && !isLocalRoute(path) && window.api && typeof window.api.request === 'function' && !isFormData(options.data)) {
            const response = await window.api.request({
                method,
                url,
                data: options.data,
                headers,
                params: options.params
            });
            return response.data;
        }
        if (isFormData(options.data)) {
            console.debug('portal-api: sending FormData via fetch (skipping axios) ->', url);
        }

        const requestHeaders = { ...headers };
        let body = undefined;

        if (auth) {
            const token = await getAuthToken();

            if (token) {
                requestHeaders.Authorization = `Bearer ${token}`;
            }
        }

        if (options.data !== undefined && options.data !== null && method !== 'GET' && method !== 'HEAD') {
            if (isFormData(options.data)) {
                body = options.data;
            } else if (typeof options.data === 'object') {
                if (!requestHeaders['Content-Type'] && !requestHeaders['content-type']) {
                    requestHeaders['Content-Type'] = 'application/json';
                }
                body = JSON.stringify(options.data);
            } else {
                body = options.data;
            }
        }

        return fetchWithTimeout(url, {
            method,
            headers: requestHeaders,
            body,
            fresh: method === 'GET' || method === 'HEAD',
            timeoutMs: options.timeoutMs
        });
    }

    async function firstSuccessful(endpoints, requestFactory) {
        let lastError = null;

        for (const endpoint of endpoints) {
            try {
                return {
                    endpoint,
                    response: await requestFactory(endpoint)
                };
            } catch (error) {
                lastError = error;
            }
        }

        throw lastError || new Error('Unable to load resource');
    }

    async function loadList(endpoints, page = 1, options = {}) {
        const result = await firstSuccessful(endpoints, (endpoint) => request('GET', endpoint, {
            ...options,
            params: {
                ...(options.params || {}),
                page
            }
        }));

        return {
            endpoint: result.endpoint,
            data: normalizeList(result.response)
        };
    }

    async function createItem(endpoints, payload, options = {}) {
        return firstSuccessful(endpoints, (endpoint) => request('POST', endpoint, {
            ...options,
            data: payload
        }));
    }

    async function updateItem(baseEndpoint, id, payload, options = {}) {
        const cleanBase = String(baseEndpoint).split('?')[0].replace(/\/+$/, '');
        const detailEndpoints = [`${cleanBase}/${id}/`, `${cleanBase}/${id}`];

        return firstSuccessful(detailEndpoints, async (endpoint) => {
            try {
                return await request('PATCH', endpoint, {
                    ...options,
                    data: payload
                });
            } catch (error) {
                if (error?.response?.status === 405) {
                    return request('PUT', endpoint, {
                        ...options,
                        data: payload
                    });
                }

                throw error;
            }
        });
    }

    async function deleteItem(baseEndpoint, id, options = {}) {
        const cleanBase = String(baseEndpoint).split('?')[0].replace(/\/+$/, '');
        const detailEndpoints = [`${cleanBase}/${id}/`, `${cleanBase}/${id}`];

        return firstSuccessful(detailEndpoints, (endpoint) => request('DELETE', endpoint, options));
    }

    function notifyDataChanged(type, detail = {}) {
        const payload = {
            type,
            detail,
            timestamp: Date.now()
        };

        window.dispatchEvent(new CustomEvent('newsportal:data-changed', { detail: payload }));

        if ('BroadcastChannel' in window) {
            const channel = new BroadcastChannel('newsportal-data-sync');
            channel.postMessage(payload);
            channel.close();
        }
    }

    function onDataChanged(callback) {
        window.addEventListener('newsportal:data-changed', (event) => callback(event.detail));

        if ('BroadcastChannel' in window) {
            const channel = new BroadcastChannel('newsportal-data-sync');
            channel.addEventListener('message', (event) => callback(event.data));
        }
    }

    window.NewsPortalApi = {
        buildUrl,
        createItem,
        deleteItem,
        escapeHtml,
        firstSuccessful,
        formatDate,
        getValue,
        loadList,
        normalizeList,
        notifyDataChanged,
        onDataChanged,
        request,
        resolveMediaUrl,
        updateItem
    };
})(window);
