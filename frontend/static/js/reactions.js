/* Existing article reaction API client and compact picker. */
(function () {
    const TYPES = {
        like: { label: 'Like', icon: '👍' },
        love: { label: 'Love', icon: '❤️' },
        sad: { label: 'Sad', icon: '😢' },
        wow: { label: 'Wow', icon: '😮' },
    };
    const state = new Map();
    const apiUrl = (path) => `${window.location.origin}${path}`;

    function normalizeType(value) {
        const key = String(value || '').toLowerCase().replace(/[^a-z]/g, '');
        return TYPES[key] ? key : '';
    }

    function normalizeBreakdown(value) {
        const result = { like: 0, love: 0, sad: 0, wow: 0 };
        Object.entries(value || {}).forEach(([key, count]) => {
            const type = normalizeType(key);
            if (type) result[type] = Number(count) || 0;
        });
        return result;
    }

    function renderControl(article) {
        const id = Number(article?.id);
        if (!id) return '';
        const current = state.get(id) || {
            selected: normalizeType(article.user_has_reacted || article.user_reaction || article.reaction_type),
            counts: normalizeBreakdown(article.reactions_breakdown),
            total: Number(article.reactions_total) || 0,
        };
        const selected = current.selected;
        const active = selected ? TYPES[selected] : TYPES.like;
        return `<div class="reaction-control" data-reaction-id="${id}">
            <button type="button" class="reaction-trigger${selected ? ' is-selected' : ''}" data-reaction-trigger aria-label="React to article" aria-expanded="false" aria-haspopup="true" title="Choose a reaction"><span class="reaction-trigger-icon">${active.icon}</span><span>${active.label}</span><span class="reaction-total">${current.total || 0}</span></button>
            <div class="reaction-picker" data-reaction-picker role="menu" hidden>${Object.entries(TYPES).map(([type, info]) => `<button type="button" role="menuitem" class="reaction-option${selected === type ? ' is-selected' : ''}" data-reaction-choice="${type}" title="${info.label}"><span>${info.icon}</span><small>${info.label}</small></button>`).join('')}</div>
        </div>`;
    }

    function paint(id, data) {
        const item = {
            selected: normalizeType(data?.user_has_reacted || data?.user_reaction || data?.reaction_type || data?.reaction || data?.selected_reaction),
            counts: normalizeBreakdown(data?.reactions_breakdown),
            total: Number(data?.reactions_total) || 0,
        };
        state.set(Number(id), item);
        document.querySelectorAll(`[data-reaction-id="${id}"]`).forEach((control) => {
            const trigger = control.querySelector('[data-reaction-trigger]');
            const picker = control.querySelector('[data-reaction-picker]');
            const selected = item.selected;
            const active = selected ? TYPES[selected] : TYPES.like;
            trigger.classList.toggle('is-selected', Boolean(selected));
            trigger.querySelector('.reaction-trigger-icon').textContent = active.icon;
            trigger.querySelector('span:nth-child(2)').textContent = active.label;
            const total = control.querySelector('.reaction-total');
            if (total) total.textContent = String(item.total);
            control.querySelectorAll('[data-reaction-choice]').forEach((option) => option.classList.toggle('is-selected', option.dataset.reactionChoice === selected));
            picker.hidden = true;
        });
    }

    async function authHeaders() {
        try { const token = await window.NewsPortalSession?.getAccessToken?.(); return token ? { Authorization: `Bearer ${token}` } : {}; }
        catch { return {}; }
    }

    async function load(articleIds) {
        const headers = await authHeaders();
        await Promise.all([...new Set(articleIds.map(Number).filter(Boolean))].map(async (id) => {
            try {
                const response = await fetch(apiUrl(`/api/articles/${id}/reactions/`), { headers: { Accept: 'application/json', ...headers } });
                if (response.ok) paint(id, await response.json());
            } catch (error) { console.warn('Could not load article reactions.', error); }
        }));
    }

    async function choose(button, type) {
        const control = button.closest('[data-reaction-id]');
        const id = Number(control?.dataset.reactionId);
        if (!id || button.disabled) return;
        const headers = await authHeaders();
        if (!headers.Authorization) { window.location.href = `/login/?next=${encodeURIComponent(window.location.pathname)}`; return; }
        button.disabled = true;
        try {
            const response = await fetch(apiUrl(`/api/articles/${id}/react/`), {
                method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...headers },
                body: JSON.stringify({ reaction_type: type }),
            });
            const data = await response.json().catch(() => ({}));
            if (response.status === 401) { window.NewsPortalSession?.clear?.(); window.location.href = `/login/?next=${encodeURIComponent(window.location.pathname)}`; return; }
            if (!response.ok) throw new Error(data.detail || 'Unable to save reaction.');
            const refreshed = await fetch(apiUrl(`/api/articles/${id}/reactions/`), { headers: { Accept: 'application/json', ...headers } });
            if (!refreshed.ok) throw new Error('Reaction saved, but its current state could not be loaded.');
            paint(id, await refreshed.json());
        } catch (error) { alert(error.message || 'Unable to save reaction.'); }
        finally { button.disabled = false; }
    }

    document.addEventListener('click', (event) => {
        const choice = event.target.closest('[data-reaction-choice]');
        if (choice) { choose(choice, choice.dataset.reactionChoice); return; }
        const trigger = event.target.closest('[data-reaction-trigger]');
        if (trigger) {
            const picker = trigger.closest('.reaction-control').querySelector('[data-reaction-picker]');
            picker.hidden = !picker.hidden;
            trigger.setAttribute('aria-expanded', String(!picker.hidden));
            return;
        }
        document.querySelectorAll('[data-reaction-picker]').forEach((picker) => { if (!event.target.closest('.reaction-control')) picker.hidden = true; });
    });

    window.ArticleReactions = { renderControl, load, paint };
}());
