// static/admin/js/api.js

const API_ORIGIN_URL = (() => {
    const configured = (typeof window !== 'undefined' && (window.NEWS_PORTAL_API_BASE || window.API_BASE_URL || window.API_BASE)) ? (window.NEWS_PORTAL_API_BASE || window.API_BASE_URL || window.API_BASE) : '';
    if (configured && /^https?:\/\//i.test(configured)) {
        return String(configured).replace(/\/$/, '').replace(/\/api$/i, '');
    }

    return window.location?.origin || 'http://127.0.0.1:8000';
})();
const API_BASE_URL = API_ORIGIN_URL;
const AUTH_INVALID_KEY = 'news_portal_auth_invalid';

function apiUrl(path = '') {
    if (/^https?:\/\//i.test(path)) {
        return path;
    }

    // If caller provided a full absolute path, return it unchanged.
    // If the path starts with '/api', assume it's already correct.
    if (path.startsWith('/api')) {
        return `${API_ORIGIN_URL}${path}`;
    }

    // If the path is site-relative (starts with '/'), but missing '/api',
    // insert '/api' so requests resolve to the remote API (e.g. '/articles/' -> '/api/articles/').
    if (path.startsWith('/')) {
        return `${API_ORIGIN_URL}/api${path}`.replace(/([^:]\/)\/+/, '$1');
    }

    // For non-leading-slash paths like 'articles/feed/', prefix with '/api/'.
    if (path && !path.startsWith('/')) {
        return `${API_ORIGIN_URL}/api/${path.replace(/^\/+/, '')}`;
    }

    return API_ORIGIN_URL;
}

function decodeJwtPayload(token) {
    try {
        const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
        return JSON.parse(atob(payload));
    } catch (error) {
        return null;
    }
}

function isTokenExpired(token) {
    if (!token) {
        return true;
    }

    const payload = decodeJwtPayload(token);
    const expiresAt = payload?.exp;

    if (!expiresAt) {
        return true;
    }

    return Date.now() >= (expiresAt - 30) * 1000;
}

function isAuthInvalid() {
    return localStorage.getItem(AUTH_INVALID_KEY) === '1';
}

function markAuthInvalid() {
    localStorage.setItem(AUTH_INVALID_KEY, '1');
}

function clearAuthInvalid() {
    localStorage.removeItem(AUTH_INVALID_KEY);
}

function clearAuthTokens() {
    if (window.NewsPortalSession?.clear) {
        window.NewsPortalSession.clear();
        return;
    }

    localStorage.removeItem('access_token');
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('refreshToken');
    clearAuthInvalid();
}

function getRefreshToken() {
    if (isAuthInvalid()) {
        return null;
    }

    const storedToken = localStorage.getItem('refresh_token') || localStorage.getItem('refreshToken');

    if (storedToken && !isTokenExpired(storedToken)) {
        localStorage.setItem('refresh_token', storedToken);
        localStorage.setItem('refreshToken', storedToken);
        return storedToken;
    }

    localStorage.removeItem('refresh_token');
    localStorage.removeItem('refreshToken');
    return null;
}

function hasStoredAuthToken() {
    const accessToken = localStorage.getItem('access_token') || localStorage.getItem('accessToken');
    const refreshToken = localStorage.getItem('refresh_token') || localStorage.getItem('refreshToken');
    return Boolean((accessToken && !isTokenExpired(accessToken)) || (refreshToken && !isTokenExpired(refreshToken)));
}

function redirectToLogin() {
    if (window.location.pathname !== '/login/') {
        window.location.href = '/login/';
    }
}

function isAuthEndpoint(config = {}) {
    const url = String(config.url || '');
    return /\/(auth\/login|token|token\/refresh)\//.test(url);
}

async function refreshAccessToken() {
    const refresh = getRefreshToken();

    if (!refresh) {
        return null;
    }

    const response = await axios.post(apiUrl('/api/token/refresh/'), { refresh });
    const access = response.data?.access;

    if (!access) {
        return null;
    }

    localStorage.setItem('access_token', access);
    localStorage.setItem('accessToken', access);
    localStorage.setItem('refresh_token', refresh);
    localStorage.setItem('refreshToken', refresh);
    clearAuthInvalid();

    return access;
}

function getAccessToken() {
    const storedToken = localStorage.getItem('access_token') || localStorage.getItem('accessToken');

    if (storedToken && !isTokenExpired(storedToken)) {
        return storedToken;
    }

    localStorage.removeItem('access_token');
    localStorage.removeItem('accessToken');
    return null;
}

const api = axios.create({
    baseURL: API_BASE_URL,
    timeout: 10000,
    headers: {
        'Content-Type': 'application/json'
    }
});

window.api = api;
window.apiUrl = apiUrl;

api.interceptors.request.use(
    async (config) => {
        if (isAuthEndpoint(config)) {
            return config;
        }

        let token = getAccessToken();

        if (!token && getRefreshToken()) {
            token = await refreshAccessToken();
        }

        if (!token) {
            clearAuthTokens();
            markAuthInvalid();
            redirectToLogin();
            throw new Error('Authentication required');
        }

        config.headers = config.headers || {};
        config.headers.Authorization = `Bearer ${token}`;
        return config;
    },
    (error) => Promise.reject(error)
);

api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config || {};

        if (error.response?.status === 401 && !originalRequest._retry && !isAuthEndpoint(originalRequest)) {
            originalRequest._retry = true;

                try {
                    const newAccessToken = await refreshAccessToken();
                    if (!newAccessToken) {
                        throw new Error('Authentication required');
                    }
                    originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;

                    return api(originalRequest);
                } catch (refreshError) {
                    console.error('Token refresh failed', refreshError);
                    clearAuthTokens();
                    markAuthInvalid();
                    redirectToLogin();
                }
            }

        if (error.response) {
            switch (error.response.status) {
                case 401:
                    console.error('Unauthorized');
                    break;
                case 403:
                    console.error('Forbidden');
                    break;
                case 404:
                    console.error('Not Found');
                    break;
                case 500:
                    console.error('Server Error');
                    break;
                default:
                    console.error(error.response.data);
            }
        }

        return Promise.reject(error);
    }
);

window.NewsPortalAuth = {
    clearAuthInvalid,
    clearAuthTokens,
    hasStoredAuthToken,
    redirectToLogin
};
