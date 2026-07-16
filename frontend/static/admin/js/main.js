document.addEventListener('DOMContentLoaded', async () => {
    document.body.classList.add('admin-ready');

    const session = window.NewsPortalSession;

    function redirectToLogin() {
        window.location.href = '/login/';
    }

    function redirectToProfile() {
        window.location.href = '/profile/';
    }

    if (!session) {
        redirectToLogin();
        return;
    }

    const knownUser = session.getKnownUser?.();

    if (knownUser && !session.isAdmin(knownUser)) {
        redirectToProfile();
        return;
    }

    if (knownUser && session.isAdmin(knownUser)) {
        session.fetchCurrentUser()
            .then((user) => {
                if (!session.isAdmin(user)) {
                    redirectToProfile();
                }
            })
            .catch((error) => {
                if (error?.status === 401) {
                    redirectToLogin();
                }
            });
        return;
    }

    try {
        const user = await session.fetchCurrentUser();
        if (!session.isAdmin(user)) {
            redirectToProfile();
            return;
        }
    } catch {
        redirectToLogin();
    }
});
