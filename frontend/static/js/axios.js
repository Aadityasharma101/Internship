// static/admin/js/api.js

const API_ORIGIN_URL = 'https://news-portal-hvgs.onrender.com';
const API_BASE_URL = `${API_ORIGIN_URL}/api/`;
const FALLBACK_ADMIN_ACCESS_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbl90eXBlIjoiYWNjZXNzIiwiZXhwIjoxNzgxNjIwNTU0LCJpYXQiOjE3ODE2MjAyNTQsImp0aSI6IjczNzMwZDk1NzlmYTRiNjliNmE5ZGNhZDcyZTRiMmQ1IiwidXNlcl9pZCI6IjEifQ.lW7M4x8IMEL7Ybd34VcY3x04q_5X7Da4kZaVHdu_M0A';
const FALLBACK_ADMIN_REFRESH_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbl90eXBlIjoicmVmcmVzaCIsImV4cCI6MTc4MTcwNjY1NCwiaWF0IjoxNzgxNjIwMjU0LCJqdGkiOiJlMzc5NWNkYTkwOGY0NzllYjVlYTI5MmVjYWI5ZDYxMiIsInVzZXJfaWQiOiIxIn0.AH5GfOJ-Wb9wfzAT724TrOKjNArGmrOGgXWMKBB05Vw';

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
    const payload = decodeJwtPayload(token);
    const expiresAt = payload?.exp;

    if (!expiresAt) {
        return true;
    }

    return Date.now() >= expiresAt * 1000;
}

function getAccessToken() {
    const storedToken = localStorage.getItem('access_token');

    if (storedToken && !isTokenExpired(storedToken)) {
        return storedToken;
    }

    localStorage.setItem('access_token', FALLBACK_ADMIN_ACCESS_TOKEN);
    localStorage.setItem('refresh_token', FALLBACK_ADMIN_REFRESH_TOKEN);

    return FALLBACK_ADMIN_ACCESS_TOKEN;
}

const api = axios.create({
    baseURL: API_BASE_URL,
    timeout: 10000,
    headers: {
        'Content-Type': 'application/json'
    }
});

/*
|--------------------------------------------------------------------------
| Request Interceptor
|--------------------------------------------------------------------------
| Runs before every request
|--------------------------------------------------------------------------
*/

api.interceptors.request.use(
    (config) => {

        const token = getAccessToken();

        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }

        return config;
    },
    (error) => Promise.reject(error)
);


/*
|--------------------------------------------------------------------------
| Response Interceptor
|--------------------------------------------------------------------------
| Runs after every response
|--------------------------------------------------------------------------
*/

api.interceptors.response.use(
    (response) => response,
    async (error) => {

        if (error.response) {
            const originalRequest = error.config;

            if (error.response.status === 401 && !originalRequest._retry) {
                originalRequest._retry = true;

                try {
                    const storedRefreshToken = localStorage.getItem('refresh_token');
                    let refreshResponse;

                    try {
                    refreshResponse = await axios.post(apiUrl('/api/token/refresh/'), {
                        refresh: storedRefreshToken || FALLBACK_ADMIN_REFRESH_TOKEN
                    });
                } catch (storedRefreshError) {
                        refreshResponse = await axios.post(apiUrl('/api/token/refresh/'), {
                            refresh: FALLBACK_ADMIN_REFRESH_TOKEN
                        });
                    }

                    const newAccessToken = refreshResponse.data.access;
                    localStorage.setItem('access_token', newAccessToken);
                    localStorage.setItem('refresh_token', FALLBACK_ADMIN_REFRESH_TOKEN);
                    originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;

                    return api(originalRequest);
                } catch (refreshError) {
                    console.error('Token refresh failed', refreshError);
                }
            }

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
