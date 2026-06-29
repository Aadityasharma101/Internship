// static/admin/js/api.js

const API_ORIGIN_URL = 'https://news-portal-hvgs.onrender.com';
const API_BASE_URL = `${API_ORIGIN_URL}/api/`;
const LOGIN_URL = '/login/';
const AUTH_INVALID_KEY = 'news_portal_auth_invalid';

let refreshPromise = null;

function apiUrl(path = '') {
    if (/^https?:\/\//i.test(path)) {
        return path;
    }

    if (path.startsWith('/')) {
        return `${API_ORIGIN_URL}${path}`;
    }

    return path;
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

function getAccessToken() {
    const storedToken = localStorage.getItem('access_token') || localStorage.getItem('accessToken');

    if (storedToken && !isTokenExpired(storedToken)) {
        localStorage.setItem('access_token', storedToken);
        localStorage.setItem('accessToken', storedToken);
        return storedToken;
    }

    localStorage.removeItem('access_token');
    localStorage.removeItem('accessToken');

    return null;
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

function clearAuthTokens() {
    localStorage.removeItem('access_token');
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('refreshToken');
}

function redirectToLogin() {
    if (window.location.pathname !== LOGIN_URL) {
        window.location.href = LOGIN_URL;
    }
}

function isAuthEndpoint(config = {}) {
    const url = apiUrl(config.url || '');
    return url.includes('/api/token/');
}

function hasStoredAuthToken() {
    return Boolean(getAccessToken() || getRefreshToken());
}

async function refreshAccessToken() {
    const storedRefreshToken = getRefreshToken();

    if (!storedRefreshToken) {
        clearAuthTokens();
        markAuthInvalid();
        redirectToLogin();
        throw new Error('Authentication required');
    }

    if (!refreshPromise) {
        refreshPromise = axios.post(apiUrl('/api/token/refresh/'), {
            refresh: storedRefreshToken
        }).then((response) => {
            const newAccessToken = response.data.access;
            localStorage.setItem('access_token', newAccessToken);
            localStorage.setItem('accessToken', newAccessToken);
            localStorage.setItem('refresh_token', storedRefreshToken);
            localStorage.setItem('refreshToken', storedRefreshToken);
            clearAuthInvalid();
            return newAccessToken;
        }).catch((error) => {
            clearAuthTokens();
            markAuthInvalid();
            redirectToLogin();
            throw error;
        }).finally(() => {
            refreshPromise = null;
        });
    }

    return refreshPromise;
}

const api = axios.create({
    baseURL: API_BASE_URL,
    timeout: 10000,
    headers: {
        'Content-Type': 'application/json'
    }
});

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
                originalRequest.headers = originalRequest.headers || {};
                originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
                return api(originalRequest);
            } catch (refreshError) {
                console.error('Authentication failed', refreshError);
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
