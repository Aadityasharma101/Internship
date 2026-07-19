let currentPage = 1;
let lastResponse = null;
let currentUsers = [];
let activeUsersEndpoint = '/users/';

const tableBody = document.getElementById('usersTableBody');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const pageInfo = document.getElementById('pageInfo');
const refreshUsersBtn = document.getElementById('refreshUsersBtn');
const userSearchInput = document.getElementById('userSearchInput');
const totalUsers = document.getElementById('totalUsers');
const activeUsers = document.getElementById('activeUsers');
const verifiedUsers = document.getElementById('verifiedUsers');
const visibleUsersCount = document.getElementById('visibleUsersCount');
const userModal = document.getElementById('userModal');
const userModalTitle = document.getElementById('userModalTitle');
const openUserModalBtn = document.getElementById('openUserModalBtn');
const closeUserModalBtn = document.getElementById('closeUserModalBtn');
const saveUserBtn = document.getElementById('saveUserBtn');
const userFormStatus = document.getElementById('userFormStatus');

const userFields = {
    id: document.getElementById('userId'),
    first_name: document.getElementById('first_name'),
    last_name: document.getElementById('last_name'),
    email: document.getElementById('email'),
    password: document.getElementById('password'),
    role: document.getElementById('role'),
    bio: document.getElementById('bio'),
    is_active: document.getElementById('is_active'),
    is_verified: document.getElementById('is_verified')
};

const { escapeHTML, formatDate, formatApiError, getValue, loadList, setMessage, createItem, updateItem, deleteItem } = ResourceHelpers;

function getFullName(user) {
    const name = `${user.first_name || ''} ${user.last_name || ''}`.trim();
    return name || getValue(user, ['username', 'name'], 'Unnamed user');
}

function getInitials(user) {
    const source = getFullName(user) !== 'Unnamed user' ? getFullName(user) : user.email;
    return String(source || 'U')
        .split(/[\s@.]+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0])
        .join('')
        .toUpperCase();
}

function getRoleName(user) {
    return getValue(user, ['role.role_name', 'role.name', 'role', 'role_name'], 'No role');
}

function renderAvatar(user) {
    const image = getValue(user, ['profile_pic', 'avatar', 'avatar_url']);

    if (image) {
        return `<img class="profile-img" src="${escapeHTML(image)}" alt="${escapeHTML(getFullName(user))}">`;
    }

    return `<span class="profile-initials">${escapeHTML(getInitials(user))}</span>`;
}

function renderUsers(users) {
    const query = userSearchInput.value.trim().toLowerCase();
    const filteredUsers = users.filter((user) => {
        const searchable = [
            getFullName(user),
            user.email,
            user.bio,
            getRoleName(user)
        ].join(' ').toLowerCase();

        return searchable.includes(query);
    });

    visibleUsersCount.textContent = `${filteredUsers.length} user${filteredUsers.length === 1 ? '' : 's'} shown`;

    if (!filteredUsers.length) {
        setMessage(tableBody, 8, query ? 'No users match your search.' : 'No users found.');
        return;
    }

    tableBody.innerHTML = filteredUsers.map((user) => {
        const roleName = getRoleName(user);
        const bio = user.bio || 'No bio added';

        return `
            <tr>
                <td>${renderAvatar(user)}</td>
                <td>
                    <div class="user-cell">
                        <strong>${escapeHTML(getFullName(user))}</strong>
                        <span>${escapeHTML(user.email || user.username || '')}</span>
                    </div>
                </td>
                <td class="bio-cell">${escapeHTML(bio)}</td>
                <td><span class="role-pill">${escapeHTML(roleName)}</span></td>
                <td>
                    <span class="status-pill ${user.is_verified ? 'status-verified' : 'status-unverified'}">
                        ${user.is_verified ? 'Verified' : 'Unverified'}
                    </span>
                </td>
                <td>
                    <span class="status-pill ${user.is_active !== false ? 'status-active' : 'status-inactive'}">
                        ${user.is_active !== false ? 'Active' : 'Inactive'}
                    </span>
                </td>
                <td>${escapeHTML(formatDate(user.created_at || user.date_joined))}</td>
                <td>
                    <div class="row-actions">
                        <button type="button" data-action="edit" data-id="${escapeHTML(user.id)}" title="Edit user" aria-label="Edit ${escapeHTML(getFullName(user))}">
                            <i class="fa-regular fa-pen-to-square"></i>
                        </button>
                        <button class="danger-action" type="button" data-action="delete" data-id="${escapeHTML(user.id)}" title="Delete user" aria-label="Delete ${escapeHTML(getFullName(user))}">
                            <i class="fa-regular fa-trash-can"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function updateSummary(users, totalCount) {
    totalUsers.textContent = totalCount ?? users.length;
    activeUsers.textContent = users.filter((user) => user.is_active !== false).length;
    verifiedUsers.textContent = users.filter((user) => user.is_verified).length;
}

function updatePagination(data) {
    prevBtn.disabled = !data.previous;
    nextBtn.disabled = !data.next;
    pageInfo.textContent = `Page ${currentPage}`;
}

async function loadUsers(page = 1) {
    setMessage(tableBody, 8, 'Loading users...', 'loading');

    try {
        const result = await loadList(['users/'], page);
        activeUsersEndpoint = result.endpoint;
        currentPage = page;
        lastResponse = result.data;
        currentUsers = result.data.results;

        updateSummary(currentUsers, result.data.count);
        renderUsers(currentUsers);
        updatePagination(result.data);
    } catch (error) {
        console.error('Error loading users:', error);
        setMessage(tableBody, 8, 'Unable to load users. Please check the API token or try again.');
        updateSummary([], 0);
        updatePagination({ previous: null, next: null });
    }
}

function resetForm() {
    Object.values(userFields).forEach((field) => {
        if (field.type === 'checkbox') {
            field.checked = field.id === 'is_active';
        } else {
            field.value = '';
        }
    });
    userFormStatus.textContent = '';
}

function openCreateModal() {
    resetForm();
    userModalTitle.textContent = 'Create New User';
    saveUserBtn.textContent = 'Create User';
    userModal.classList.remove('hidden');
}

function openEditModal(user) {
    resetForm();
    userFields.id.value = user.id || '';
    userFields.first_name.value = user.first_name || '';
    userFields.last_name.value = user.last_name || '';
    userFields.email.value = user.email || '';
    userFields.role.value = getValue(user, ['role.id', 'role.role_name', 'role.name', 'role'], '');
    userFields.bio.value = user.bio || '';
    userFields.is_active.checked = user.is_active !== false;
    userFields.is_verified.checked = Boolean(user.is_verified);
    userModalTitle.textContent = 'Edit User';
    saveUserBtn.textContent = 'Save Changes';
    userModal.classList.remove('hidden');
}

function closeModal() {
    userModal.classList.add('hidden');
}

function buildPayload(id) {
    const payload = {
        first_name: userFields.first_name.value.trim(),
        last_name: userFields.last_name.value.trim(),
        email: userFields.email.value.trim(),
        bio: userFields.bio.value.trim(),
        is_active: userFields.is_active.checked
    };

    const role = userFields.role.value.trim();
    if (/^\d+$/.test(role)) {
        payload.role_id = Number(role);
    }

    if (!id && userFields.password.value) {
        payload.password = userFields.password.value;
        payload.password2 = userFields.password.value;
    }

    return payload;
}

function validateNewUser(payload) {
    if (!payload.password) {
        return 'Password is required for new users.';
    }

    if (payload.password.length < 8) {
        return 'Password must be at least 8 characters.';
    }

    return '';
}

async function saveUser() {
    const id = userFields.id.value;
    const payload = buildPayload(id);

    if (!payload.email) {
        userFormStatus.textContent = 'Email is required.';
        return;
    }

    const passwordError = !id ? validateNewUser(payload) : '';
    if (passwordError) {
        userFormStatus.textContent = passwordError;
        return;
    }

    saveUserBtn.disabled = true;
    userFormStatus.textContent = id ? 'Saving user...' : 'Creating user...';

    try {
        if (id) {
            await updateItem(activeUsersEndpoint, id, payload);
        } else {
            await createItem([activeUsersEndpoint, 'users/'], payload);
        }
        closeModal();
        await loadUsers(currentPage);
    } catch (error) {
        console.error('Unable to save user:', error);
        userFormStatus.textContent = formatApiError(error, 'Unable to save user. Check required fields and permissions.');
    } finally {
        saveUserBtn.disabled = false;
    }
}

async function removeUser(user) {
    if (!window.confirm(`Delete ${getFullName(user)}? This cannot be undone.`)) {
        return;
    }

    try {
        await deleteItem(activeUsersEndpoint, user.id);
        await loadUsers(currentPage);
    } catch (error) {
        console.error('Unable to delete user:', error);
        window.alert('Unable to delete this user. Check your permissions and try again.');
    }
}

tableBody.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-action]');

    if (!button) {
        return;
    }

    const user = currentUsers.find((item) => String(item.id) === String(button.dataset.id));

    if (!user) {
        return;
    }

    if (button.dataset.action === 'edit') {
        openEditModal(user);
    }

    if (button.dataset.action === 'delete') {
        removeUser(user);
    }
});

prevBtn.addEventListener('click', () => {
    if (lastResponse?.previous && currentPage > 1) {
        loadUsers(currentPage - 1);
    }
});

nextBtn.addEventListener('click', () => {
    if (lastResponse?.next) {
        loadUsers(currentPage + 1);
    }
});

refreshUsersBtn.addEventListener('click', () => loadUsers(currentPage));
userSearchInput.addEventListener('input', () => renderUsers(currentUsers));
openUserModalBtn.addEventListener('click', openCreateModal);
closeUserModalBtn.addEventListener('click', closeModal);
saveUserBtn.addEventListener('click', saveUser);
userModal.addEventListener('click', (event) => {
    if (event.target === userModal) {
        closeModal();
    }
});

document.addEventListener('DOMContentLoaded', () => {
    if (window.NewsPortalAuth && !window.NewsPortalAuth.hasStoredAuthToken()) {
        setMessage(tableBody, 8, 'Please log in again to view users. Redirecting...', 'muted');
        window.NewsPortalAuth.redirectToLogin();
        return;
    }

    loadUsers();
});
