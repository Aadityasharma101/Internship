document.addEventListener('DOMContentLoaded', async () => {
    document.body.classList.add('admin-ready');

    try {
        const user = await window.NewsPortalSession.fetchCurrentUser();
        if (!window.NewsPortalSession.isAdmin(user)) {
            window.location.href = '/profile/';
            return;
        }
    } catch {
        window.location.href = '/login/';
    }
});
