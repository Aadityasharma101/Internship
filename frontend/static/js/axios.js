// static/admin/js/api.js

const API_BASE_URL = 'https://news-portal-hvgs.onrender.com/api/';
const FALLBACK_ADMIN_ACCESS_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbl90eXBlIjoiYWNjZXNzIiwiZXhwIjoxNzgxMTQzMjQyLCJpYXQiOjE3ODExNDI5NDMsImp0aSI6ImFkNTZjNDNmYjIwZjQzMGJhYzg3ODk2ZDMwMjc1NzU4IiwidXNlcl9pZCI6IjEifQ.mHPZdlG2GkdAQAaOeBsiD7CITjqK-9VNXq9Raceh0-g';
const FALLBACK_ADMIN_REFRESH_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbl90eXBlIjoicmVmcmVzaCIsImV4cCI6MTc4MTIyODg2MiwiaWF0IjoxNzgxMTQyNDYyLCJqdGkiOiI2YjU5MTJmOThmZjc0NDFjOWJhZDg4YWM3M2VlYTIzYiIsInVzZXJfaWQiOiIxIn0.PXY-CJY0A_0YDCSS5cV6Hb7FuScsQ4UAXxjGQqWlwKg';

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
                        refreshResponse = await axios.post(`${API_BASE_URL}token/refresh/`, {
                            refresh: storedRefreshToken || FALLBACK_ADMIN_REFRESH_TOKEN
                        });
                    } catch (storedRefreshError) {
                        refreshResponse = await axios.post(`${API_BASE_URL}token/refresh/`, {
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
