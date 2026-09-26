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

    const logoutButtons = document.querySelectorAll('[data-staff-logout-button]');

    async function handleLogout(event) {
        if (event) {
            event.preventDefault();
        }

        const shouldLogout = window.confirm('Do you want to logout?');
        if (!shouldLogout) {
            return;
        }

        try {
            await fetch('/auth/logout/', {
                method: 'POST',
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json'
                }
            });
        } catch {
            // Ignore server-side logout errors and continue with client cleanup.
        }

        window.NewsPortalSession?.clear();
        window.location.replace('/');
    }

    logoutButtons.forEach((button) => {
        button.addEventListener('click', handleLogout);
    });

    // Ensure staff advertisement link exists in the sidebar when the template doesn't include it.
    function ensureManageLinks() {
        try {
            const sidebarMenu = document.querySelector('.sidebar-menu');
            if (!sidebarMenu) return;

            // don't duplicate links if already present
            if (sidebarMenu.querySelector("a[href='/staff/advertisements/']")) {
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

            ul.appendChild(liAds);

            sidebarMenu.appendChild(section);
            sidebarMenu.appendChild(ul);
        } catch (e) {
            // fail silently
        }
    }

    ensureManageLinks();
});
