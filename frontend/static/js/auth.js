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
    if (!refresh) {
        const error = new Error('Authentication required');
        error.status = 401;
        throw error;
    }

    const response = await fetch(portalApiUrl('/api/token/refresh/'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ refresh }),
    });

    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.access) {
        clearPortalSession();
        const error = new Error(data?.detail || 'Session expired');
        error.status = response.status || 401;
        throw error;
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
    if (user?.is_superuser) {
        return true;
    }

    const role = roleNameFromUser(user).replace(/[\s-]+/g, '_');
    return ['admin', 'super_admin', 'superadmin'].includes(role);
}

function isPortalStaff(user) {
    if (isPortalAdmin(user)) {
        return false;
    }

    const role = roleNameFromUser(user).replace(/[\s-]+/g, '_');
    if (role === 'staff') {
        return true;
    }

    return Boolean(user?.is_staff);
}

function getPortalDashboardPath(user) {
    if (isPortalAdmin(user)) {
        return '/users/';
    }
    if (isPortalStaff(user)) {
        return '/staff/';
    }
    return '/profile/';
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

function boolClaim(value) {
    if (typeof value === 'boolean') return value;
    if (value === null || value === undefined) return false;
    return ['1', 'true', 'yes', 'admin'].includes(String(value).toLowerCase());
}

function getPortalUserFromToken() {
    const payload = decodePortalJwt(getStoredAccessToken());
    if (!payload) {
        return null;
    }

    return {
        email: payload.email || payload.username || '',
        username: payload.username || payload.email || '',
        role: payload.role || payload.user_role || '',
        is_staff: boolClaim(payload.is_staff || payload.staff),
        is_superuser: boolClaim(payload.is_superuser || payload.admin),
    };
}

function getKnownPortalUser() {
    return getStoredPortalUser() || getPortalUserFromToken();
}

async function fetchCurrentPortalUser(hasRefreshed = false) {
    const token = await getPortalAccessToken();
    const response = await fetch(portalApiUrl('/api/users/me/'), {
        headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${token}`,
        },
    });

    if (response.status === 401 && !hasRefreshed) {
        await refreshPortalAccessToken();
        return fetchCurrentPortalUser(true);
    }

    const data = await response.json().catch(() => null);
    if (!response.ok) {
        const error = new Error(data?.detail || 'Unable to load profile');
        error.status = response.status;
        throw error;
    }
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

function renderPortalAuthState(user = getKnownPortalUser()) {
    const signedIn = Boolean(getStoredAccessToken() || getStoredRefreshToken());
    const topbarAuth = document.getElementById('topbar-auth');
    const headerAuth = document.getElementById('header-auth-buttons');
    const dashboardPath = user ? getPortalDashboardPath(user) : '/profile/';
    const displayName = getPortalDisplayName(user);

    if (signedIn) {
        if (topbarAuth) {
            topbarAuth.innerHTML = `
                <div class="user-menu" data-user-menu>
                    <button class="user-menu-trigger" type="button" aria-expanded="false" aria-haspopup="true" aria-controls="user-menu-panel">
                        <span class="user-menu-avatar" aria-hidden="true">${escapePortalHtml(displayName.slice(0, 1).toUpperCase())}</span>
                        <span>${escapePortalHtml(displayName)}</span>
                    </button>
                    <div class="user-menu-panel" id="user-menu-panel" hidden>
                        <div class="user-menu-heading"><span class="user-menu-avatar" aria-hidden="true">${escapePortalHtml(displayName.slice(0, 1).toUpperCase())}</span><span>${escapePortalHtml(displayName)}</span></div>
                        <a href="/profile/">♙ <span>Profile</span></a>
                        <a href="/bookmarks/">▣ <span>My Bookmarks</span></a>
                        <button type="button" class="user-menu-logout" data-user-logout>↪ <span>Logout</span></button>
                    </div>
                </div>
            `;
        }
        if (headerAuth) {
            headerAuth.innerHTML = `
                <a href="/profile/" class="btn-nav btn-nav--ghost">Profile</a>
                <a href="${dashboardPath}" class="btn-nav btn-nav--primary">${isPortalAdmin(user) || isPortalStaff(user) ? 'Dashboard' : 'My Account'}</a>
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
    document.addEventListener('click', (event) => {
        const menu = event.target.closest('[data-user-menu]');
        const openMenu = document.querySelector('[data-user-menu].is-open');
        if (!menu) {
            openMenu?.classList.remove('is-open');
            openMenu?.querySelector('.user-menu-panel')?.setAttribute('hidden', '');
            openMenu?.querySelector('.user-menu-trigger')?.setAttribute('aria-expanded', 'false');
            return;
        }
        if (event.target.closest('[data-user-logout]')) {
            handleLogout();
            return;
        }
        const trigger = event.target.closest('.user-menu-trigger');
        if (!trigger) return;
        const panel = menu.querySelector('.user-menu-panel');
        const expanded = trigger.getAttribute('aria-expanded') === 'true';
        if (openMenu && openMenu !== menu) {
            openMenu.classList.remove('is-open');
            openMenu.querySelector('.user-menu-panel')?.setAttribute('hidden', '');
            openMenu.querySelector('.user-menu-trigger')?.setAttribute('aria-expanded', 'false');
        }
        trigger.setAttribute('aria-expanded', String(!expanded));
        panel.toggleAttribute('hidden', expanded);
        menu.classList.toggle('is-open', !expanded);
    });
    document.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape') return;
        document.querySelector('[data-user-menu].is-open')?.querySelector('.user-menu-trigger')?.click();
    });
    renderPortalAuthState();
    if (getStoredAccessToken() || getStoredRefreshToken()) {
        fetchCurrentPortalUser()
            .then(renderPortalAuthState)
            .catch((error) => {
                if (error?.status === 401) {
                    clearPortalSession();
                }
                renderPortalAuthState(getKnownPortalUser());
            });
    }
});

window.NewsPortalSession = {
    clear: clearPortalSession,
    storeTokens: storePortalTokens,
    storeUser: storePortalUser,
    getStoredAccessToken: getStoredAccessToken,
    getStoredRefreshToken: getStoredRefreshToken,
    getAccessToken: getPortalAccessToken,
    fetchCurrentUser: fetchCurrentPortalUser,
    getStoredUser: getStoredPortalUser,
    getKnownUser: getKnownPortalUser,
    getDashboardPath: getPortalDashboardPath,
    isAdmin: isPortalAdmin,
    isStaff: isPortalStaff,
    roleName: roleNameFromUser,
    renderAuthState: renderPortalAuthState,
    displayName: getPortalDisplayName,
};
