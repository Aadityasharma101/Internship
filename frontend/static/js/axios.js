// static/admin/js/api.js

const API_ORIGIN_URL = 'https://news-portal-hvgs.onrender.com';
const API_BASE_URL = `${API_ORIGIN_URL}/api/`;

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
    const storedToken = localStorage.getItem('access_token') || localStorage.getItem('accessToken');

    if (storedToken && !isTokenExpired(storedToken)) {
        return storedToken;
    }

    return null;
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
                    const storedRefreshToken = localStorage.getItem('refresh_token') || localStorage.getItem('refreshToken');
                    if (!storedRefreshToken) throw new Error('No refresh token available');

                    const refreshResponse = await axios.post(apiUrl('/api/token/refresh/'), {
                        refresh: storedRefreshToken
                    });

                    const newAccessToken = refreshResponse.data.access;
                    localStorage.setItem('access_token', newAccessToken);
                    localStorage.setItem('accessToken', newAccessToken);
                    // keep the existing refresh token
                    originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;

                    return api(originalRequest);
                } catch (refreshError) {
                    console.error('Token refresh failed', refreshError);
                    // Clear tokens if refresh fails
                    localStorage.removeItem('access_token');
                    localStorage.removeItem('accessToken');
                    localStorage.removeItem('refresh_token');
                    localStorage.removeItem('refreshToken');
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
