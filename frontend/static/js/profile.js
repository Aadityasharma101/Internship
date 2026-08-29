(function () {
    // DOM Elements
    const avatar = document.getElementById('profileAvatar');
    const nameDisplay = document.getElementById('profileNameDisplay');
    const emailDisplay = document.getElementById('profileEmailDisplay');
    const messageEl = document.getElementById('profileMessage');
    const contentEl = document.getElementById('profileContent');
    const roleBadge = document.getElementById('profileRoleBadge');
    const statusBadge = document.getElementById('profileStatusBadge');
    const headerEl = document.getElementById('profileHeader');
    const linkDashboard = document.getElementById('linkDashboard');

    // Values & Inputs
    const valFirstName = document.getElementById('valFirstName');
    const valLastName = document.getElementById('valLastName');
    const valEmail = document.getElementById('valEmail');
    const valBio = document.getElementById('valBio');
    const inpFirstName = document.getElementById('inpFirstName');
    const inpLastName = document.getElementById('inpLastName');
    const inpEmail = document.getElementById('inpEmail');
    const inpBio = document.getElementById('inpBio');
    const avatarUpload = document.getElementById('avatarUpload');

    // Buttons & Forms
    const btnToggleEdit = document.getElementById('btnToggleEdit');
    const btnCancelEdit = document.getElementById('btnCancelEdit');
    const formProfileUpdate = document.getElementById('formProfileUpdate');
    const btnSaveProfile = document.getElementById('btnSaveProfile');
    
    const formChangePassword = document.getElementById('formChangePassword');
    const btnSavePassword = document.getElementById('btnSavePassword');
    
    let currentUser = null;
    let selectedAvatarFile = null;

    function showToast(message, type = 'success') {
        const toast = document.getElementById('toastNotification');
        toast.textContent = message;
        toast.className = `toast toast-${type} show`;
        setTimeout(() => {
            toast.className = 'toast';
        }, 3000);
    }

    function setMessage(message, type = '') {
        if (!messageEl) return;
        messageEl.textContent = message || '';
        messageEl.className = message ? `profile-message ${type}` : 'profile-message';
        messageEl.style.display = message ? 'block' : 'none';
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

    function getProfileImageUrl(user) {
        const value = user?.profile_pic || user?.avatar || user?.avatar_url || user?.image || user?.image_url;
        if (!value || typeof value !== 'string') return '';
        if (/^(?:https?:|data:image\/)/i.test(value)) return value;
        try {
            return new URL(value, document.body?.dataset?.apiBase || 'https://news-portal-hvgs.onrender.com').href;
        } catch {
            return '';
        }
    }

    function updateAvatarDisplay(src, altName, email) {
        const fallback = () => {
            avatar.replaceChildren();
            avatar.textContent = initials(altName, email);
        };
        if (!src) {
            fallback();
            return;
        }

        const image = new Image();
        image.alt = `${altName || 'User'} profile picture`;
        image.className = 'profile-avatar-image';
        image.addEventListener('error', fallback, { once: true });
        // Register the fallback before loading. This also handles cached
        // failures consistently in browsers.
        image.src = src;
        avatar.replaceChildren(image);
    }

    function renderProfile(user) {
        currentUser = user;
        const displayName = window.NewsPortalSession?.displayName(user) || user?.email || 'Reader';
        const dashboardPath = window.NewsPortalSession?.getDashboardPath(user) || '/profile/';

        nameDisplay.textContent = displayName;
        emailDisplay.textContent = user?.email || '';
        
        updateAvatarDisplay(getProfileImageUrl(user), displayName, user?.email);

        roleBadge.textContent = formatRole(user);
        statusBadge.textContent = user?.is_active === false ? 'Inactive' : 'Active';
        if (user?.is_active === false) {
            statusBadge.classList.replace('badge-status', 'badge-role'); // just a visual shift
            statusBadge.style.background = '#fef08a';
            statusBadge.style.color = '#854d0e';
        }

        // Fill values
        valFirstName.textContent = user?.first_name || 'Not provided';
        valLastName.textContent = user?.last_name || 'Not provided';
        valEmail.textContent = user?.email || 'Not provided';
        valBio.textContent = user?.bio || 'No bio added yet.';

        // Fill inputs
        inpFirstName.value = user?.first_name || '';
        inpLastName.value = user?.last_name || '';
        inpEmail.value = user?.email || '';
        inpBio.value = user?.bio || '';

        linkDashboard.href = dashboardPath;
        linkDashboard.textContent = window.NewsPortalSession?.isAdmin(user)
            ? 'Admin dashboard'
            : window.NewsPortalSession?.isStaff(user)
                ? 'Staff dashboard'
                : 'My profile';
                
        contentEl.hidden = false;
        setMessage('', '');
        
        // Reset edit mode if it was active
        exitEditMode();
    }

    function toggleEditMode() {
        headerEl.classList.add('edit-mode');
        document.getElementById('tab-profile').classList.add('edit-mode');
        btnToggleEdit.style.display = 'none';
    }

    function exitEditMode() {
        headerEl.classList.remove('edit-mode');
        document.getElementById('tab-profile').classList.remove('edit-mode');
        btnToggleEdit.style.display = 'inline-flex';
        selectedAvatarFile = null;
        if (currentUser) {
            const displayName = window.NewsPortalSession?.displayName(currentUser);
            updateAvatarDisplay(getProfileImageUrl(currentUser), displayName, currentUser.email);
            inpFirstName.value = currentUser.first_name || '';
            inpLastName.value = currentUser.last_name || '';
            inpBio.value = currentUser.bio || '';
        }
    }
    
    // Tab Switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(btn.dataset.target).classList.add('active');
            
            if (btn.dataset.target === 'tab-saved' && document.getElementById('savedArticlesGrid').children.length <= 1) {
                loadSavedArticles();
            }
        });
    });

    // Avatar Preview
    avatarUpload.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            if (!file.type.startsWith('image/')) {
                showToast('Please choose an image file.', 'error');
                avatarUpload.value = '';
                return;
            }
            selectedAvatarFile = file;
            const reader = new FileReader();
            reader.onload = (e) => {
                updateAvatarDisplay(e.target.result, currentUser?.first_name || currentUser?.email, currentUser?.email);
            };
            reader.readAsDataURL(file);
        }
    });

    // Event Listeners
    btnToggleEdit.addEventListener('click', toggleEditMode);
    btnCancelEdit.addEventListener('click', exitEditMode);

    formProfileUpdate.addEventListener('submit', async (e) => {
        e.preventDefault();
        btnSaveProfile.classList.add('loading');
        
        try {
            const token = await window.NewsPortalSession.getAccessToken();
            const formData = new FormData();
            formData.append('first_name', inpFirstName.value.trim());
            formData.append('last_name', inpLastName.value.trim());
            formData.append('bio', inpBio.value.trim());
            
            if (selectedAvatarFile) {
                formData.append('profile_pic', selectedAvatarFile);
            }

            const response = await fetch(`/remote/api/users/${currentUser.id}/`, {
                method: 'PATCH',
                headers: {
                    Authorization: `Bearer ${token}`,
                },
                body: formData
            });

            if (!response.ok) {
                const data = await response.json().catch(() => null);
                throw new Error(data?.detail || 'Failed to update profile.');
            }

            const updatedUser = await response.json();
            window.NewsPortalSession.storeUser(updatedUser);
            // Some update responses omit display-only fields. Preserve the
            // current profile data while keeping the new server image URL.
            renderProfile({ ...currentUser, ...updatedUser });
            showToast('Profile updated successfully!');
        } catch (error) {
            console.error(error);
            showToast(error.message || 'Error updating profile.', 'error');
        } finally {
            btnSaveProfile.classList.remove('loading');
        }
    });
    
    formChangePassword.addEventListener('submit', async (e) => {
        e.preventDefault();
        const oldPass = document.getElementById('inpOldPassword').value;
        const newPass = document.getElementById('inpNewPassword').value;
        const newPass2 = document.getElementById('inpConfirmPassword').value;
        
        if (newPass !== newPass2) {
            showToast('New passwords do not match.', 'error');
            return;
        }

        btnSavePassword.classList.add('loading');
        
        try {
            const token = await window.NewsPortalSession.getAccessToken();
            const response = await fetch('/remote/api/users/change_password/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    old_password: oldPass,
                    new_password: newPass,
                    new_password2: newPass2
                })
            });

            if (!response.ok) {
                const data = await response.json().catch(() => null);
                let errorMsg = 'Failed to change password.';
                if (data) {
                    // Extract first error message if it's an object of arrays
                    const firstKey = Object.keys(data)[0];
                    if (firstKey && Array.isArray(data[firstKey])) {
                        errorMsg = data[firstKey][0];
                    } else if (data.detail) {
                        errorMsg = data.detail;
                    }
                }
                throw new Error(errorMsg);
            }
            
            formChangePassword.reset();
            showToast('Password changed successfully!');
        } catch (error) {
            console.error(error);
            showToast(error.message || 'Error changing password.', 'error');
        } finally {
            btnSavePassword.classList.remove('loading');
        }
    });
    
    async function loadSavedArticles() {
        const grid = document.getElementById('savedArticlesGrid');
        try {
            const token = await window.NewsPortalSession.getAccessToken();
            const response = await fetch('/api/articles/my-bookmarks/', {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });
            if (!response.ok) throw new Error();
            const articles = await response.json();
            
            if (!articles || articles.length === 0) {
                grid.innerHTML = '<p style="grid-column: 1/-1; color: var(--profile-text-muted);">You have no saved articles.</p>';
                return;
            }
            
            grid.innerHTML = articles.map(article => {
                let imgUrl = article.image_url || '/static/images/placeholder.jpg';
                if (imgUrl.startsWith('/media/')) {
                    imgUrl = 'https://news-portal-hvgs.onrender.com' + imgUrl;
                }
                return `
                <a href="/news/${article.id}/" class="article-card">
                    <img src="${imgUrl}" alt="${article.title}" class="article-img" loading="lazy">
                    <div class="article-content">
                        <h4 class="article-title">${article.title}</h4>
                        <div class="article-meta">
                            Saved on ${new Date().toLocaleDateString()}
                        </div>
                    </div>
                </a>
            `}).join('');
        } catch (error) {
            grid.innerHTML = '<p style="grid-column: 1/-1; color: var(--profile-danger);">Failed to load saved articles.</p>';
        }
    }

    document.addEventListener('DOMContentLoaded', async () => {
        try {
            const user = await window.NewsPortalSession.fetchCurrentUser();
            renderProfile(user);
        } catch (e) {
            console.error("Profile load error:", e);
            setMessage('Error: ' + (e.message || 'Please sign in to view your profile.'), 'error');
            if (e.status === 401 || !window.NewsPortalSession.getStoredAccessToken()) {
                window.setTimeout(() => {
                    window.location.href = '/login/';
                }, 1200);
            }
        }
    });
})();
