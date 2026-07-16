(function () {
    const avatar = document.getElementById('profileAvatar');
    const nameEl = document.getElementById('profileName');
    const emailEl = document.getElementById('profileEmail');
    const messageEl = document.getElementById('profileMessage');
    const contentEl = document.getElementById('profileContent');

    function setMessage(message, type = '') {
        if (!messageEl) return;
        messageEl.textContent = message || '';
        messageEl.className = message ? `profile-message ${type}` : 'profile-message';
    }

    function initials(name, email) {
        const parts = String(name || email || 'NP').trim().split(/\s+/).filter(Boolean);
        if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
        return String(parts[0] || 'NP').slice(0, 2).toUpperCase();
    }

    function formatRole(user) {
        const role = window.NewsPortalSession?.roleName(user) || 'user';
        return role.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
    }

    function renderProfile(user) {
        const displayName = window.NewsPortalSession?.displayName(user) || user?.email || 'Reader';
        const dashboardPath = window.NewsPortalSession?.getDashboardPath(user) || '/profile/';

        avatar.textContent = initials(displayName, user?.email);
        nameEl.textContent = displayName;
        emailEl.textContent = user?.email || '';
        document.getElementById('profileDetailEmail').textContent = user?.email || 'Not provided';
        document.getElementById('profileRole').textContent = formatRole(user);
        document.getElementById('profileStatus').textContent = user?.is_active === false ? 'Inactive' : 'Active';
        document.getElementById('profileBio').textContent = user?.bio || 'No bio added yet.';
        document.getElementById('profileDashboardLink').href = dashboardPath;
        document.getElementById('profileDashboardLink').textContent = window.NewsPortalSession?.isAdmin(user)
            ? 'Admin dashboard'
            : window.NewsPortalSession?.isStaff(user)
                ? 'Staff dashboard'
                : 'My profile';
        contentEl.hidden = false;
        setMessage('', '');
    }

    document.addEventListener('DOMContentLoaded', async () => {
        try {
            const user = await window.NewsPortalSession.fetchCurrentUser();
            renderProfile(user);
        } catch {
            setMessage('Please sign in to view your profile.', 'error');
            window.setTimeout(() => {
                window.location.href = '/login/';
            }, 1200);
        }
    });
})();
