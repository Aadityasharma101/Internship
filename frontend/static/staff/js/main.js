document.addEventListener('DOMContentLoaded', async () => {
    document.body.classList.add('staff-ready');

    const logoutLink = document.getElementById('staffLogoutLink');
    const logoutButton = document.getElementById('staffLogoutButton');

    function bindLogout(element) {
        if (!element) {
            return;
        }

        element.addEventListener('click', (event) => {
            event.preventDefault();
            window.NewsPortalSession?.clear();
            window.location.href = '/login/';
        });
    }

    bindLogout(logoutLink);
    bindLogout(logoutButton);
});
