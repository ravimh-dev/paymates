document.addEventListener('DOMContentLoaded', () => {
  requireAuth();

  const groupFilter = document.getElementById('historyGroupFilter');
  const typeFilter = document.getElementById('historyTypeFilter');
  const historyList = document.getElementById('historyList');
  const currentUser = Auth.getUser();

  const loadGroups = async () => {
    const response = await api.get('/groups');
    const groups = response.data || [];
    if (!groupFilter) return groups;

    groupFilter.innerHTML = ['<option value="all">All groups</option>', ...groups.map((group) => `<option value="${group.id}">${group.name}</option>`)].join('');
    return groups;
  };

  const collectHistory = async (groups) => {
    const entries = [];

    for (const group of groups) {
      try {
        const response = await api.get(`/settlements/history/${group.id}`);
        (response.data || []).forEach((settlement) => {
      entries.push({
            type: 'settlement',
            groupId: group.id,
            groupName: group.name,
            created_at: settlement.created_at,
            amount: settlement.amount,
            currency: settlement.currency,
            status: settlement.status,
            id: settlement.id,
            created_by: settlement.created_by,
            title: `${settlement.from_name} → ${settlement.to_name}`,
            meta: settlement,
          });
        });
      } catch {
        // Ignore per-group failures and keep the rest of the feed alive.
      }
    }

    entries.sort((left, right) => new Date(right.created_at) - new Date(left.created_at));
    return entries;
  };

  const renderHistory = (entries) => {
    if (!historyList) return;

    const groupValue = groupFilter?.value || 'all';
    const typeValue = typeFilter?.value || 'all';

    const filtered = entries.filter((entry) => (groupValue === 'all' || entry.groupId === groupValue) && (typeValue === 'all' || entry.type === typeValue));

    if (!filtered.length) {
      historyList.innerHTML = '<div class="empty-panel">No matching history found.</div>';
      return;
    }

    historyList.innerHTML = filtered.map((entry) => `
      <article class="history-row">
        <div class="history-row__icon">↔</div>
        <div class="history-row__body">
          <strong>${entry.title}</strong>
          <span>${entry.groupName}</span>
          <span>${fmt.dateTime(entry.created_at)}</span>
        </div>
        <div class="history-row__amount">${fmt.currency(entry.amount, entry.currency)}</div>
        ${entry.status === 'pending' && entry.created_by === currentUser?.id
          ? `<button type="button" class="btn btn-ghost btn-sm cancel-settlement-btn" data-id="${entry.id}">Cancel</button>`
          : ''}
      </article>
    `).join('');
  };

  const init = async () => {
    try {
      const groups = await loadGroups();
      const history = await collectHistory(groups);
      renderHistory(history);

      groupFilter?.addEventListener('change', () => renderHistory(history));
      typeFilter?.addEventListener('change', () => renderHistory(history));

      historyList?.addEventListener('click', async (event) => {
        const button = event.target.closest('.cancel-settlement-btn');
        if (!button) return;
        if (!window.confirm('Cancel this pending settlement?')) return;
        try {
          await api.patch(`/settlements/${button.dataset.id}/cancel`);
          const refreshed = await collectHistory(groups);
          renderHistory(refreshed);
        } catch (error) {
          window.alert(error.message || 'Failed to cancel settlement');
        }
      });
    } catch (error) {
      if (historyList) {
        historyList.innerHTML = `<div class="empty-panel empty-panel--error">${error.message || 'Failed to load history'}</div>`;
      }
    }
  };

  init();
});
