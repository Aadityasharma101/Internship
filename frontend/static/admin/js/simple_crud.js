const simpleCrudConfig = window.simpleCrudConfig || {};
const simpleState = {
    page: 1,
    response: null,
    items: [],
    endpoint: simpleCrudConfig.endpoints?.[0] || '/'
};

const simpleEls = {
    tbody: document.getElementById('resourceTableBody'),
    prev: document.getElementById('prevResourceBtn'),
    next: document.getElementById('nextResourceBtn'),
    pageInfo: document.getElementById('resourcePageInfo'),
    refresh: document.getElementById('refreshResourceBtn'),
    search: document.getElementById('resourceSearchInput'),
    visible: document.getElementById('visibleResourceCount'),
    total: document.getElementById('totalResources'),
    active: document.getElementById('activeResources'),
    secondary: document.getElementById('secondaryResources'),
    modal: document.getElementById('resourceModal'),
    modalTitle: document.getElementById('resourceModalTitle'),
    open: document.getElementById('openResourceModalBtn'),
    close: document.getElementById('closeResourceModalBtn'),
    save: document.getElementById('saveResourceBtn'),
    status: document.getElementById('resourceFormStatus'),
    form: document.getElementById('resourceForm'),
    id: document.getElementById('resourceId')
};

const RH = ResourceHelpers;

function resourceValue(item, field) {
    return RH.getValue(item, field.keys || [field.name], field.fallback || '');
}

function titleFor(item) {
    const field = simpleCrudConfig.titleField || simpleCrudConfig.fields?.[0];
    return RH.getValue(item, field.keys || [field.name], 'Untitled');
}

function renderCell(item, column) {
    const value = resourceValue(item, column);

    if (column.type === 'status') {
        const isActive = value === true || String(value).toLowerCase() === 'active' || String(value).toLowerCase() === 'published';
        return `<span class="pill ${isActive ? 'pill-green' : 'pill-orange'}">${RH.escapeHTML(isActive ? (column.activeLabel || 'Active') : (column.inactiveLabel || 'Inactive'))}</span>`;
    }

    if (column.type === 'date') {
        return RH.escapeHTML(RH.formatDate(value));
    }

    if (column.type === 'url' && value) {
        return `<a class="muted-text" href="${RH.escapeHTML(value)}" target="_blank" rel="noopener">${RH.escapeHTML(value)}</a>`;
    }

    if (column.primary) {
        return `
            <div class="primary-cell">
                <strong>${RH.escapeHTML(value || 'Untitled')}</strong>
                <span>${RH.escapeHTML(resourceValue(item, column.description || { keys: ['description', 'summary'], fallback: 'No description added' }))}</span>
            </div>
        `;
    }

    return RH.escapeHTML(value || column.fallback || 'Not available');
}

function renderItems(items) {
    const query = simpleEls.search.value.trim().toLowerCase();
    const filtered = items.filter((item) => JSON.stringify(item).toLowerCase().includes(query));

    simpleEls.visible.textContent = `${filtered.length} ${simpleCrudConfig.itemPlural || 'items'} shown`;

    if (!filtered.length) {
        RH.setMessage(simpleEls.tbody, simpleCrudConfig.columns.length + 1, query ? 'No records match your search.' : 'No records found.');
        return;
    }

    simpleEls.tbody.innerHTML = filtered.map((item) => `
        <tr>
            ${simpleCrudConfig.columns.map((column) => `<td>${renderCell(item, column)}</td>`).join('')}
            <td>
                <div class="row-actions">
                    ${simpleCrudConfig.allowEdit === false ? '' : `
                        <button type="button" data-action="edit" data-id="${RH.escapeHTML(item.id)}" title="Edit" aria-label="Edit ${RH.escapeHTML(titleFor(item))}">
                            <i class="fa-regular fa-pen-to-square"></i>
                        </button>
                    `}
                    ${simpleCrudConfig.allowDelete === false ? '' : `
                        <button class="danger-action" type="button" data-action="delete" data-id="${RH.escapeHTML(item.id)}" title="Delete" aria-label="Delete ${RH.escapeHTML(titleFor(item))}">
                            <i class="fa-regular fa-trash-can"></i>
                        </button>
                    `}
                </div>
            </td>
        </tr>
    `).join('');
}

function updateSummary(items, totalCount) {
    simpleEls.total.textContent = totalCount ?? items.length;

    if (simpleEls.active) {
        simpleEls.active.textContent = items.filter((item) => {
            const value = RH.getValue(item, ['is_active', 'active', 'status'], true);
            return value === true || String(value).toLowerCase() === 'active';
        }).length;
    }

    if (simpleEls.secondary) {
        simpleEls.secondary.textContent = items.filter((item) => RH.getValue(item, simpleCrudConfig.secondaryKeys || ['is_featured', 'featured'], false)).length;
    }
}

function updatePagination(data) {
    simpleEls.prev.disabled = !data.previous;
    simpleEls.next.disabled = !data.next;
    simpleEls.pageInfo.textContent = `Page ${simpleState.page}`;
}

async function loadResources(page = 1) {
    RH.setMessage(simpleEls.tbody, simpleCrudConfig.columns.length + 1, `Loading ${simpleCrudConfig.itemPlural || 'records'}...`, 'loading');

    try {
        const result = await RH.loadList(simpleCrudConfig.endpoints, page);
        simpleState.endpoint = result.endpoint;
        simpleState.page = page;
        simpleState.response = result.data;
        simpleState.items = result.data.results;
        updateSummary(simpleState.items, result.data.count);
        renderItems(simpleState.items);
        updatePagination(result.data);
    } catch (error) {
        console.error(`Unable to load ${simpleCrudConfig.itemPlural}:`, error);
        RH.setMessage(simpleEls.tbody, simpleCrudConfig.columns.length + 1, `Unable to load ${simpleCrudConfig.itemPlural || 'records'}. Check the API endpoint or permissions.`);
        updateSummary([], 0);
        updatePagination({ previous: null, next: null });
    }
}

function resetForm() {
    simpleEls.id.value = '';
    simpleEls.form.reset();
    simpleEls.status.textContent = '';
    simpleCrudConfig.fields.forEach((field) => {
        const input = document.getElementById(field.id);

        if (field.type === 'checkbox') {
            input.checked = Boolean(field.default);
        }
    });
}

function openCreateModal() {
    resetForm();
    simpleEls.modalTitle.textContent = `Create ${simpleCrudConfig.itemName}`;
    simpleEls.save.textContent = 'Create';
    simpleEls.modal.classList.remove('hidden');
}

function openEditModal(item) {
    resetForm();
    simpleEls.id.value = item.id || '';
    simpleCrudConfig.fields.forEach((field) => {
        const input = document.getElementById(field.id);
        const value = resourceValue(item, field);

        if (field.type === 'checkbox') {
            input.checked = value === true || String(value).toLowerCase() === 'active';
        } else {
            input.value = value || '';
        }
    });
    simpleEls.modalTitle.textContent = `Edit ${simpleCrudConfig.itemName}`;
    simpleEls.save.textContent = 'Save Changes';
    simpleEls.modal.classList.remove('hidden');
}

function closeModal() {
    simpleEls.modal.classList.add('hidden');
}

function buildPayload() {
    return simpleCrudConfig.fields.reduce((payload, field) => {
        const input = document.getElementById(field.id);
        let value = field.type === 'checkbox' ? input.checked : input.value.trim();

        if (field.type === 'number' && value !== '') {
            value = Number(value);
        }

        if (field.type !== 'checkbox' && value === '' && !field.includeEmpty) {
            return payload;
        }

        (field.payloadNames || [field.name]).forEach((name) => {
            payload[name] = value;
        });

        return payload;
    }, {});
}

async function saveResource() {
    const id = simpleEls.id.value;
    const payload = buildPayload();
    const requiredField = simpleCrudConfig.fields.find((field) => field.required);

    if (requiredField && !payload[requiredField.name]) {
        simpleEls.status.textContent = `${requiredField.label} is required.`;
        return;
    }

    simpleEls.save.disabled = true;
    simpleEls.status.textContent = id ? 'Saving changes...' : 'Creating record...';

    try {
        if (id) {
            await RH.updateItem(simpleState.endpoint, id, payload);
        } else {
            await RH.createItem([simpleState.endpoint, ...simpleCrudConfig.endpoints], payload);
        }
        closeModal();
        await loadResources(simpleState.page);
    } catch (error) {
        console.error('Unable to save resource:', error);
        simpleEls.status.textContent = RH.formatApiError(error, 'Unable to save. Check required fields and permissions.');
    } finally {
        simpleEls.save.disabled = false;
    }
}

async function deleteResource(item) {
    if (!window.confirm(`Delete "${titleFor(item)}"? This cannot be undone.`)) {
        return;
    }

    try {
        await RH.deleteItem(simpleState.endpoint, item.id);
        await loadResources(simpleState.page);
    } catch (error) {
        console.error('Unable to delete resource:', error);
        window.alert('Unable to delete this record. Check permissions and try again.');
    }
}

simpleEls.tbody.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-action]');

    if (!button) {
        return;
    }

    const item = simpleState.items.find((record) => String(record.id) === String(button.dataset.id));

    if (!item) {
        return;
    }

    if (button.dataset.action === 'edit') {
        openEditModal(item);
    }

    if (button.dataset.action === 'delete') {
        deleteResource(item);
    }
});

simpleEls.prev.addEventListener('click', () => {
    if (simpleState.response?.previous && simpleState.page > 1) {
        loadResources(simpleState.page - 1);
    }
});

simpleEls.next.addEventListener('click', () => {
    if (simpleState.response?.next) {
        loadResources(simpleState.page + 1);
    }
});

simpleEls.refresh.addEventListener('click', () => loadResources(simpleState.page));
simpleEls.search.addEventListener('input', () => renderItems(simpleState.items));
simpleEls.open.addEventListener('click', openCreateModal);
simpleEls.close.addEventListener('click', closeModal);
simpleEls.save.addEventListener('click', saveResource);
simpleEls.modal.addEventListener('click', (event) => {
    if (event.target === simpleEls.modal) {
        closeModal();
    }
});

document.addEventListener('DOMContentLoaded', () => loadResources());
