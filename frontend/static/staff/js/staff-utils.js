(function (window) {
    const Api = window.NewsPortalApi;

    function getInitials(value) {
        const parts = String(value || 'ST').trim().split(/\s+/).filter(Boolean);

        if (parts.length >= 2) {
            return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
        }

        return String(parts[0] || 'ST').slice(0, 2).toUpperCase();
    }

    function sortByNewest(items, dateKeys = ['updated_at', 'created_at', 'published_at']) {
        return [...(items || [])].sort((left, right) => {
            const leftDate = new Date(Api.getValue(left, dateKeys, 0));
            const rightDate = new Date(Api.getValue(right, dateKeys, 0));
            return rightDate - leftDate;
        });
    }

    async function loadAllPages(loader, options = {}, maxPages = 20) {
        const items = [];
        let page = 1;
        let lastPage = null;

        while (page <= maxPages) {
            const result = await loader(page, options);
            const response = result?.data || {};
            lastPage = { ...result, data: response };
            items.push(...(response.results || []));

            if (!response.next) {
                break;
            }

            page += 1;
        }

        return {
            endpoint: lastPage?.endpoint || '',
            data: {
                count: lastPage?.data?.count ?? items.length,
                next: lastPage?.data?.next || null,
                previous: lastPage?.data?.previous || null,
                results: items
            }
        };
    }

    function setTableMessage(tbody, colspan, message) {
        if (!tbody) {
            return;
        }

        tbody.innerHTML = `
            <tr class="loading-row">
                <td colspan="${colspan}">${Api.escapeHtml(message)}</td>
            </tr>
        `;
    }

    function createActionButton(action, icon, label, extraClass = '') {
        return `
            <button type="button" data-action="${Api.escapeHtml(action)}" class="${extraClass}" aria-label="${Api.escapeHtml(label)}" title="${Api.escapeHtml(label)}">
                <i class="${Api.escapeHtml(icon)}"></i>
            </button>
        `;
    }

    window.StaffUtils = {
        createActionButton,
        getInitials,
        loadAllPages,
        setTableMessage,
        sortByNewest
    };
})(window);
