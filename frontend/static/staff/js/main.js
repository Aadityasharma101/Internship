document.addEventListener('DOMContentLoaded', async () => {
    document.body.classList.add('staff-ready');

    const session = window.NewsPortalSession;

    function redirectToLogin() {
        window.location.href = '/login/';
    }

    function redirectToProfile() {
        window.location.href = '/profile/';
    }

    const knownUser = session?.getKnownUser?.();
    if (knownUser && session.isAdmin(knownUser)) {
        window.location.href = session.getDashboardPath(knownUser);
        return;
    }

    if (knownUser && !session.isStaff(knownUser)) {
        redirectToProfile();
        return;
    }

    if (!knownUser) {
        try {
            const user = await session.fetchCurrentUser();
            if (session.isAdmin(user)) {
                window.location.href = session.getDashboardPath(user);
                return;
            }
            if (!session.isStaff(user)) {
                redirectToProfile();
                return;
            }
        } catch (error) {
            if (error?.status === 401) {
                redirectToLogin();
            }
            return;
        }
    }

    const logoutButton = document.getElementById('staffLogoutButton');

    function handleLogout(event) {
        if (event) {
            event.preventDefault();
        }

        const shouldLogout = window.confirm('Do you want to logout?');
        if (!shouldLogout) {
            return;
        }

        window.NewsPortalSession?.clear();
        window.location.href = '/login/';
    }

    if (logoutButton) {
        logoutButton.addEventListener('click', handleLogout);
    }

    // Ensure staff 'Manage' links exist in the sidebar when the template doesn't include them
    function ensureManageLinks() {
        try {
            const sidebarMenu = document.querySelector('.sidebar-menu');
            if (!sidebarMenu) return;

            // don't duplicate links if already present
            if (sidebarMenu.querySelector("a[href='/staff/advertisements/']") || sidebarMenu.querySelector("a[href='/staff/profile/']")) {
                return;
            }

            const section = document.createElement('div');
            section.className = 'menu-section';
            section.textContent = 'MANAGE';

            const ul = document.createElement('ul');
            ul.className = 'menu-list';

            const liAds = document.createElement('li');
            liAds.className = 'menu-item';
            liAds.innerHTML = '<a href="/staff/advertisements/"><i class="fa-solid fa-bullhorn"></i> Advertisements</a>';

            const liProfile = document.createElement('li');
            liProfile.className = 'menu-item';
            liProfile.innerHTML = '<a href="/staff/profile/"><i class="fa-solid fa-user"></i> Profile</a>';

            ul.appendChild(liAds);
            ul.appendChild(liProfile);

            sidebarMenu.appendChild(section);
            sidebarMenu.appendChild(ul);
        } catch (e) {
            // fail silently
        }
    }

    ensureManageLinks();
});
