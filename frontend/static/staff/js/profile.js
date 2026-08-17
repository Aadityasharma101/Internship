(function () {
    const Api = window.NewsPortalApi;
    const ArticleService = window.NewsPortalArticleService;
    const CommentService = window.NewsPortalCommentService;
    const AdService = window.NewsPortalAdvertisementService;
    const Utils = window.StaffUtils;

    const els = {
        avatar: document.getElementById('profileAvatar'),
        avatarImg: document.getElementById('profileAvatarImg'),
        avatarInitials: document.getElementById('profileAvatarInitials'),
        name: document.getElementById('profileName'),
        emailCopy: document.getElementById('profileEmailCopy'),
        username: document.getElementById('profileUsername'),
        email: document.getElementById('profileEmail'),
        role: document.getElementById('profileRole'),
        status: document.getElementById('profileStatus'),
        detailUsername: document.getElementById('detailUsername'),
        detailEmail: document.getElementById('detailEmail'),
        detailRole: document.getElementById('detailRole'),
        detailStatus: document.getElementById('detailStatus'),
        articleCount: document.getElementById('profileArticleCount'),
        commentCount: document.getElementById('profileCommentCount'),
        adCount: document.getElementById('profileAdCount'),
        usernameInput: document.getElementById('profileInputUsername'),
        emailInput: document.getElementById('profileInputEmail'),
        nameInput: document.getElementById('profileInputName'),
        imageInput: document.getElementById('profileInputImage'),
        previewImg: document.getElementById('profilePreviewImg'),
        saveButton: document.getElementById('saveProfileBtn'),
        statusMessage: document.getElementById('profileFormStatus')
    };

    function getInitials(value) {
        return Utils.getInitials(value || 'ST');
    }

    function setAvatarImage(url, displayName) {
        const resolved = Api.resolveMediaUrl(url || '');
        if (resolved) {
            if (els.avatarImg) {
                els.avatarImg.src = resolved;
                els.avatarImg.style.display = '';
            }
            if (els.avatarInitials) {
                els.avatarInitials.style.display = 'none';
            }
        } else {
            if (els.avatarImg) {
                els.avatarImg.src = '';
                els.avatarImg.style.display = 'none';
            }
            if (els.avatarInitials) {
                els.avatarInitials.textContent = getInitials(displayName || 'ST');
                els.avatarInitials.style.display = '';
            }
        }
    }

    function roleLabel(user) {
        const raw = String(window.NewsPortalSession.roleName(user) || 'staff').replace(/[_-]+/g, ' ');
        return raw.replace(/\b\w/g, (char) => char.toUpperCase());
    }

    const PROFILE_UPDATE_ENDPOINTS = [
        '/remote/api/users/me/',
        '/remote/auth/users/me/',
        '/remote/me/',
        '/remote/api/accounts/me/'
    ];

    function getProfilePayload() {
        return {
            username: els.usernameInput.value.trim(),
            email: els.emailInput.value.trim(),
            name: els.nameInput.value.trim()
        };
    }

    function getProfileFormData(payload) {
        const fd = new FormData();
        fd.append('username', payload.username);
        fd.append('email', payload.email);
        fd.append('name', payload.name);
        fd.append('display_name', payload.name);
        fd.append('first_name', payload.name);
        fd.append('last_name', '');

        const file = els.imageInput.files[0];
        if (file) {
            fd.append('image', file);
            fd.append('avatar', file);
            fd.append('profile_pic', file);
            fd.append('photo', file);
        }
        return fd;
    }

    function validateProfilePayload(payload) {
        if (!payload.username) {
            return 'Username is required.';
        }
        if (!payload.email) {
            return 'Email is required.';
        }
        try {
            new URL(`mailto:${payload.email}`);
        } catch {
            return 'Please enter a valid email address.';
        }
        return '';
    }

    async function saveProfile() {
        const payload = getProfilePayload();
        const validationMessage = validateProfilePayload(payload);

        if (validationMessage) {
            els.status.textContent = validationMessage;
            return;
        }

        els.saveButton.disabled = true;
        els.status.textContent = 'Saving profile...';

        try {
            const requestData = (els.imageInput && els.imageInput.files && els.imageInput.files[0])
                ? getProfileFormData(payload)
                : payload;

            const result = await Api.firstSuccessful(PROFILE_UPDATE_ENDPOINTS, (endpoint) => Api.request('PATCH', endpoint, {
                data: requestData
            }));

            const user = result.response;

            if (user) {
                window.NewsPortalSession?.storeUser?.(user);
            }

            const displayName = user ? (window.NewsPortalSession.displayName(user) || user.username || 'Staff Member') : els.name.textContent;
            const role = user ? roleLabel(user) : els.role.textContent;
            const isActive = user ? (user.is_active === false ? 'Inactive' : 'Active') : els.status.textContent;

            setAvatarImage(user?.avatar || user?.avatar_url || user?.profile_pic || user?.image || user?.image_url, displayName);
            els.name.textContent = displayName;
            els.emailCopy.textContent = user?.email || els.emailCopy.textContent;
            els.username.textContent = user?.username || els.username.textContent;
            els.email.textContent = user?.email || els.email.textContent;
            els.role.textContent = role;
            els.status.textContent = isActive;
            els.detailUsername.textContent = user?.username || els.detailUsername.textContent;
            els.detailEmail.textContent = user?.email || els.detailEmail.textContent;
            els.detailRole.textContent = role;
            els.detailStatus.textContent = isActive;

            // update avatar if remote returned an image
            const avatarUrl = user?.avatar || user?.avatar_url || user?.profile_pic || user?.image || user?.image_url;
            setAvatarImage(avatarUrl, displayName);

            els.statusMessage.textContent = 'Profile updated successfully.';
        } catch (error) {
            console.error('Unable to save profile:', error);
            els.statusMessage.textContent = error?.response?.data?.detail || 'Unable to save profile. Please try again.';
        } finally {
            els.saveButton.disabled = false;
        }
    }

    async function loadProfile() {
        try {
            const hasAuth = Boolean(window.NewsPortalAuth?.hasStoredAuthToken?.());
            const user = hasAuth ? await window.NewsPortalSession.fetchCurrentUser().catch(() => null) : null;
            const displayName = user ? (window.NewsPortalSession.displayName(user) || user.username || 'Staff Member') : 'Guest Visitor';
            const role = user ? roleLabel(user) : 'Guest';
            const isActive = user ? (user.is_active === false ? 'Inactive' : 'Active') : 'No Login';

            els.avatar.textContent = '';
            setAvatarImage(user?.avatar || user?.avatar_url || user?.profile_pic || user?.image || user?.image_url, displayName);
            els.name.textContent = displayName;
            els.emailCopy.textContent = user?.email || 'No email provided';
            els.username.textContent = user?.username || 'Not available';
            els.email.textContent = user?.email || 'Not available';
            els.role.textContent = role;
            els.status.textContent = isActive;
            els.detailUsername.textContent = user?.username || 'Not available';
            els.detailEmail.textContent = user?.email || 'Not available';
            els.detailRole.textContent = role;
            els.detailStatus.textContent = isActive;
            els.usernameInput.value = user?.username || '';
            els.emailInput.value = user?.email || '';
            els.nameInput.value = user?.name || user?.first_name || user?.username || '';

            if (els.previewImg && user) {
                const previewUrl = user?.avatar || user?.avatar_url || user?.profile_pic || user?.image || user?.image_url;
                if (previewUrl) {
                    els.previewImg.src = Api.resolveMediaUrl(previewUrl);
                    els.previewImg.style.display = '';
                }
            }

            const requestOptions = hasAuth ? {
                params: {
                    ordering: '-id'
                }
            } : {
                auth: false,
                params: {
                    ordering: '-id'
                }
            };

            const [articlesResponse, commentsResponse, adsResponse] = await Promise.all([
                Utils.loadAllPages((page, options) => ArticleService.loadArticles(page, {
                    ...requestOptions,
                    ...options,
                    params: {
                        ...(requestOptions.params || {}),
                        ...(options.params || {})
                    }
                })),
                Utils.loadAllPages((page, options) => CommentService.loadComments(page, {
                    ...requestOptions,
                    ...options,
                    params: {
                        ...(requestOptions.params || {}),
                        ...(options.params || {})
                    }
                })),
                Utils.loadAllPages((page, options) => AdService.loadAdvertisements(page, {
                    ...requestOptions,
                    ...options,
                    params: {
                        ...(requestOptions.params || {}),
                        ...(options.params || {})
                    }
                }))
            ]);

            const ownArticles = user ? articlesResponse.data.results.filter((article) => ArticleService.articleMatchesUser(article, user)) : articlesResponse.data.results;
            const ownComments = user ? commentsResponse.data.results.filter((comment) => CommentService.commentMatchesUser(comment, user)) : commentsResponse.data.results;

            els.articleCount.textContent = ownArticles.length;
            els.commentCount.textContent = ownComments.length;
            els.adCount.textContent = adsResponse.data.results.length;
        } catch (error) {
            console.error('Unable to load profile:', error);
            els.name.textContent = 'Unable to load profile';
            els.emailCopy.textContent = 'Please refresh or sign in again.';
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        loadProfile();
        els.saveButton.addEventListener('click', saveProfile);

        if (els.imageInput) {
            els.imageInput.addEventListener('change', (evt) => {
                const file = evt.target.files && evt.target.files[0];
                if (!file) {
                    if (els.previewImg) {
                        els.previewImg.src = '';
                        els.previewImg.style.display = 'none';
                    }
                    return;
                }

                try {
                    const url = URL.createObjectURL(file);
                    if (els.previewImg) {
                        els.previewImg.src = url;
                        els.previewImg.style.display = '';
                    }
                } catch (e) {
                    console.error('Unable to preview image', e);
                }
            });
        }
    });
})();
