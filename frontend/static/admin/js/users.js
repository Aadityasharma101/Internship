let currentPage = 1;
let lastResponse = null;
let currentUsers = [];

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
const openUserModalBtn = document.getElementById('openUserModalBtn');
const closeUserModalBtn = document.getElementById('closeUserModalBtn');

function escapeHTML(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function getFullName(user) {
    const name = `${user.first_name || ''} ${user.last_name || ''}`.trim();
    return name || 'Unnamed user';
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

function formatDate(value) {
    if (!value) {
        return 'Not available';
    }

    return new Intl.DateTimeFormat('en', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    }).format(new Date(value));
}

function setTableMessage(message, type = 'muted') {
    tableBody.innerHTML = `
        <tr class="${type}-row">
            <td colspan="8">${escapeHTML(message)}</td>
        </tr>
    `;
}

function renderAvatar(user) {
    if (user.profile_pic) {
        return `<img class="profile-img" src="${escapeHTML(user.profile_pic)}" alt="${escapeHTML(getFullName(user))}">`;
    }

    return `<span class="profile-initials">${escapeHTML(getInitials(user))}</span>`;
}

function renderUsers(users) {
    const query = userSearchInput.value.trim().toLowerCase();
    const filteredUsers = users.filter((user) => {
        const roleName = user.role?.role_name || 'No role';
        const searchable = [
            getFullName(user),
            user.email,
            user.bio,
            roleName
        ].join(' ').toLowerCase();

        return searchable.includes(query);
    });

    visibleUsersCount.textContent = `${filteredUsers.length} user${filteredUsers.length === 1 ? '' : 's'} shown`;

    if (!filteredUsers.length) {
        setTableMessage(query ? 'No users match your search.' : 'No users found.');
        return;
    }

    tableBody.innerHTML = filteredUsers.map((user) => {
        const roleName = user.role?.role_name || 'No role';
        const bio = user.bio || 'No bio added';

        return `
            <tr>
                <td>${renderAvatar(user)}</td>
                <td>
                    <div class="user-cell">
                        <strong>${escapeHTML(getFullName(user))}</strong>
                        <span>${escapeHTML(user.email)}</span>
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
                    <span class="status-pill ${user.is_active ? 'status-active' : 'status-inactive'}">
                        ${user.is_active ? 'Active' : 'Inactive'}
                    </span>
                </td>
                <td>${escapeHTML(formatDate(user.created_at))}</td>
                <td>
                    <div class="row-actions">
                        <button type="button" title="View user" aria-label="View ${escapeHTML(getFullName(user))}">
                            <i class="fa-regular fa-eye"></i>
                        </button>
                        <button type="button" title="Edit user" aria-label="Edit ${escapeHTML(getFullName(user))}">
                            <i class="fa-regular fa-pen-to-square"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function updateSummary(users, totalCount) {
    totalUsers.textContent = totalCount ?? users.length;
    activeUsers.textContent = users.filter((user) => user.is_active).length;
    verifiedUsers.textContent = users.filter((user) => user.is_verified).length;
}

function updatePagination(data) {
    prevBtn.disabled = !data.previous;
    nextBtn.disabled = !data.next;
    pageInfo.textContent = `Page ${currentPage}`;
}

async function loadUsers(page = 1) {
    setTableMessage('Loading users...', 'loading');

    try {
        const response = await api.get(`users/?page=${page}`);
        const data = response.data;

        currentPage = page;
        lastResponse = data;
        currentUsers = data.results || [];

        updateSummary(currentUsers, data.count);
        renderUsers(currentUsers);
        updatePagination(data);

    } catch (error) {
        console.error('Error loading users:', error);
        setTableMessage('Unable to load users. Please check the API token or try again.');
        updatePagination({ previous: null, next: null });
    }
}

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

openUserModalBtn.addEventListener('click', () => userModal.classList.remove('hidden'));
closeUserModalBtn.addEventListener('click', () => userModal.classList.add('hidden'));
userModal.addEventListener('click', (event) => {
    if (event.target === userModal) {
        userModal.classList.add('hidden');
    }
});

document.addEventListener('DOMContentLoaded', () => loadUsers());
