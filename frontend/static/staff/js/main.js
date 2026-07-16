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
});
