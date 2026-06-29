const NEWS_PORTAL_API_ORIGIN = 'https://news-portal-hvgs.onrender.com';
const NEWS_PORTAL_AUTH_INVALID_KEY = 'news_portal_auth_invalid';
const NEWS_PORTAL_USER_KEY = 'news_portal_user';

function getPortalApiOrigin() {
    const base = document.body?.dataset?.apiBase || NEWS_PORTAL_API_ORIGIN;
    return String(base).replace(/\/$/, '').replace(/\/api$/, '');
}

function portalApiUrl(path) {
    const cleanPath = String(path || '').replace(/^\//, '');
    return `${getPortalApiOrigin()}/${cleanPath}`;
}

function decodePortalJwt(token) {
    try {
        const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
        return JSON.parse(atob(payload));
    } catch {
        return null;
    }
}

function isPortalTokenExpired(token) {
    const payload = token ? decodePortalJwt(token) : null;
    return !payload?.exp || Date.now() >= (payload.exp - 30) * 1000;
}

function getStoredAccessToken() {
    const token = localStorage.getItem('access_token') || localStorage.getItem('accessToken');
    if (!token || isPortalTokenExpired(token)) {
        localStorage.removeItem('access_token');
        localStorage.removeItem('accessToken');
        return null;
    }
    localStorage.setItem('access_token', token);
    localStorage.setItem('accessToken', token);
    return token;
}

function getStoredRefreshToken() {
    if (localStorage.getItem(NEWS_PORTAL_AUTH_INVALID_KEY) === '1') return null;
    const token = localStorage.getItem('refresh_token') || localStorage.getItem('refreshToken');
    if (!token || isPortalTokenExpired(token)) {
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('refreshToken');
        return null;
    }
    localStorage.setItem('refresh_token', token);
    localStorage.setItem('refreshToken', token);
    return token;
}

function clearPortalSession() {
    localStorage.removeItem('access_token');
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem(NEWS_PORTAL_USER_KEY);
    localStorage.removeItem(NEWS_PORTAL_AUTH_INVALID_KEY);
}

function storePortalTokens(tokens) {
    if (tokens?.access) {
        localStorage.setItem('access_token', tokens.access);
        localStorage.setItem('accessToken', tokens.access);
    }
    if (tokens?.refresh) {
        localStorage.setItem('refresh_token', tokens.refresh);
        localStorage.setItem('refreshToken', tokens.refresh);
    }
    localStorage.removeItem(NEWS_PORTAL_AUTH_INVALID_KEY);
}

async function refreshPortalAccessToken() {
    const refresh = getStoredRefreshToken();
    if (!refresh) throw new Error('Authentication required');

    const response = await fetch(portalApiUrl('/api/token/refresh/'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ refresh }),
    });

    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.access) {
        clearPortalSession();
        throw new Error(data?.detail || 'Session expired');
    }

    storePortalTokens({ access: data.access, refresh });
    return data.access;
}

async function getPortalAccessToken() {
    return getStoredAccessToken() || refreshPortalAccessToken();
}

function roleNameFromUser(user) {
    const role = user?.role;
    if (typeof role === 'string') return role.toLowerCase();
    return String(role?.role_name || role?.name || '').toLowerCase();
}

function isPortalAdmin(user) {
    const role = roleNameFromUser(user).replace(/[\s-]+/g, '_');
    return ['admin', 'super_admin', 'superadmin', 'staff'].includes(role);
}

function getPortalDashboardPath(user) {
    return isPortalAdmin(user) ? '/dashboard/' : '/profile/';
}

function storePortalUser(user) {
    if (user) localStorage.setItem(NEWS_PORTAL_USER_KEY, JSON.stringify(user));
}

function getStoredPortalUser() {
    try {
        return JSON.parse(localStorage.getItem(NEWS_PORTAL_USER_KEY) || 'null');
    } catch {
        return null;
    }
}

async function fetchCurrentPortalUser() {
    const token = await getPortalAccessToken();
    const response = await fetch(portalApiUrl('/api/users/me/'), {
        headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${token}`,
        },
    });

    if (response.status === 401) {
        await refreshPortalAccessToken();
        return fetchCurrentPortalUser();
    }

    const data = await response.json().catch(() => null);
    if (!response.ok) throw new Error(data?.detail || 'Unable to load profile');
    storePortalUser(data);
    return data;
}

function getPortalDisplayName(user) {
    const name = [user?.first_name, user?.last_name].filter(Boolean).join(' ').trim();
    return name || user?.username || user?.email || 'Reader';
}

function escapePortalHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function renderPortalAuthState(user = getStoredPortalUser()) {
    const signedIn = Boolean(getStoredAccessToken() || getStoredRefreshToken());
    const topbarAuth = document.getElementById('topbar-auth');
    const headerAuth = document.getElementById('header-auth-buttons');
    const dashboardPath = user ? getPortalDashboardPath(user) : '/profile/';
    const displayName = getPortalDisplayName(user);

    if (signedIn) {
        if (topbarAuth) {
            topbarAuth.innerHTML = `
                <a class="topbar-user" href="/profile/">${escapePortalHtml(displayName)}</a>
                <a class="topbar-btn" href="${dashboardPath}">${isPortalAdmin(user) ? 'Dashboard' : 'Profile'}</a>
                <button class="topbar-btn topbar-btn--logout" type="button" onclick="handleLogout()">Sign Out</button>
            `;
        }
        if (headerAuth) {
            headerAuth.innerHTML = `
                <a href="/profile/" class="btn-nav btn-nav--ghost">Profile</a>
                <a href="${dashboardPath}" class="btn-nav btn-nav--primary">${isPortalAdmin(user) ? 'Dashboard' : 'My Account'}</a>
            `;
        }
        return;
    }

    if (topbarAuth) {
        topbarAuth.innerHTML = `
            <a class="topbar-btn" href="/login/">Sign In</a>
            <a class="topbar-btn topbar-btn--primary" href="/register/">Register</a>
        `;
    }
    if (headerAuth) {
        headerAuth.innerHTML = `
            <a href="/login/" class="btn-nav btn-nav--ghost">Sign In</a>
            <a href="/register/" class="btn-nav btn-nav--primary">Get Started</a>
        `;
    }
}

function handleLogout() {
    clearPortalSession();
    window.location.href = '/';
}

document.addEventListener('DOMContentLoaded', () => {
    renderPortalAuthState();
    if (getStoredAccessToken() || getStoredRefreshToken()) {
        fetchCurrentPortalUser()
            .then(renderPortalAuthState)
            .catch(() => {
                clearPortalSession();
                renderPortalAuthState();
            });
    }
});

window.NewsPortalSession = {
    clear: clearPortalSession,
    storeTokens: storePortalTokens,
    getAccessToken: getPortalAccessToken,
    fetchCurrentUser: fetchCurrentPortalUser,
    getStoredUser: getStoredPortalUser,
    getDashboardPath: getPortalDashboardPath,
    isAdmin: isPortalAdmin,
    roleName: roleNameFromUser,
    renderAuthState: renderPortalAuthState,
    displayName: getPortalDisplayName,
};
