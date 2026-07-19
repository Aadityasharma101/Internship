const ResourceHelpers = (() => {
    function escapeHTML(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function formatDate(value) {
        if (!value) {
            return 'Not available';
        }

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {
            return 'Not available';
        }

        return new Intl.DateTimeFormat('en', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        }).format(date);
    }

    function normalizeList(data) {
        if (Array.isArray(data)) {
            return { results: data, count: data.length, next: null, previous: null };
        }

        return {
            results: data?.results || data?.data || [],
            count: data?.count ?? data?.total ?? (data?.results || data?.data || []).length,
            next: data?.next || null,
            previous: data?.previous || null
        };
    }

    function buildPagedEndpoint(endpoint, page) {
        const separator = endpoint.includes('?') ? '&' : '?';
        return `${endpoint}${separator}page=${page}`;
    }

    async function firstSuccessful(endpoints, requestFactory) {
        let lastError = null;

        for (const endpoint of [...new Set(endpoints.filter(Boolean))]) {
            try {
                return {
                    endpoint,
                    response: await requestFactory(endpoint)
                };
            } catch (error) {
                lastError = error;

                // Endpoint alternatives are useful for backwards-compatible GET
                // routes, but a validation/permission error is an answer from the
                // API, not a reason to repeat a mutation elsewhere. Retrying a
                // POST on every 400 was causing duplicate requests and hiding the
                // useful field-level error returned by the server.
                const status = error?.response?.status;
                if (status && ![404, 405].includes(status)) {
                    throw error;
                }
            }
        }

        throw lastError;
    }

    async function loadList(endpoints, page) {
        const result = await firstSuccessful(endpoints, (endpoint) => api.get(apiUrl(buildPagedEndpoint(endpoint, page))));
        return {
            endpoint: result.endpoint,
            data: normalizeList(result.response.data)
        };
    }

    function detailEndpoints(baseEndpoint, id) {
        const clean = String(baseEndpoint).split('?')[0].replace(/\/+$/, '');
        return [`${clean}/${id}/`, `${clean}/${id}`];
    }

    async function createItem(endpoints, payload) {
        return firstSuccessful(endpoints, (endpoint) => api.post(apiUrl(endpoint), payload));
    }

    async function updateItem(baseEndpoint, id, payload) {
        return firstSuccessful(detailEndpoints(baseEndpoint, id), async (endpoint) => {
            try {
                return await api.patch(apiUrl(endpoint), payload);
            } catch (error) {
                if (error?.response?.status === 405) {
                    return api.put(apiUrl(endpoint), payload);
                }
                throw error;
            }
        });
    }

    async function deleteItem(baseEndpoint, id) {
        return firstSuccessful(detailEndpoints(baseEndpoint, id), (endpoint) => api.delete(apiUrl(endpoint)));
    }

    function getValue(source, keys, fallback = '') {
        for (const key of keys) {
            const value = key.split('.').reduce((item, part) => item?.[part], source);

            if (value !== null && value !== undefined && value !== '') {
                return value;
            }
        }

        return fallback;
    }

    function setMessage(tbody, colspan, message, type = 'muted') {
        tbody.innerHTML = `
            <tr class="${type}-row">
                <td colspan="${colspan}">${escapeHTML(message)}</td>
            </tr>
        `;
    }

    function formatApiError(error, fallback = 'Unable to save. Please try again.') {
        const data = error?.response?.data;

        if (!data) {
            return fallback;
        }

        if (typeof data === 'string') {
            return data;
        }

        if (data.detail) {
            return Array.isArray(data.detail) ? data.detail.join(' ') : String(data.detail);
        }

        const messages = Object.entries(data)
            .map(([field, value]) => {
                const message = Array.isArray(value) ? value.join(' ') : String(value);
                return `${field.replace(/_/g, ' ')}: ${message}`;
            })
            .filter(Boolean);

        return messages.join(' ') || fallback;
    }

    return {
        buildPagedEndpoint,
        createItem,
        deleteItem,
        escapeHTML,
        firstSuccessful,
        formatDate,
        formatApiError,
        getValue,
        loadList,
        normalizeList,
        setMessage,
        updateItem
    };
})();
