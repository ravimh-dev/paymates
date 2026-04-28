document.addEventListener('DOMContentLoaded', () => {
  requireAuth();

  const pathParts = window.location.pathname.split('/').filter(Boolean);
  const groupId = pathParts[0] === 'settlements' ? pathParts[1] || '' : '';
  const currentUser = Auth.getUser();

  const groupSelect = document.getElementById('settlementGroupSelect');
  const planList = document.getElementById('transactionsList');
  const historyList = document.getElementById('historyList');
  const txCount = document.getElementById('txCount');
  const planMeta = document.getElementById('planMeta');
  const backToGroup = document.getElementById('backToGroup');
  const downloadPdfBtn = document.getElementById('downloadSettlementPdfBtn');

  const renderTransactions = (transactions, currency) => {
    if (!planList) return;

    if (!transactions.length) {
      planList.innerHTML = '<div class="empty-panel">All settled. No transactions required.</div>';
      if (txCount) txCount.textContent = '0 transactions';
      return;
    }

    if (txCount) txCount.textContent = `${transactions.length} transaction${transactions.length === 1 ? '' : 's'}`;

    planList.innerHTML = transactions.map((transaction, index) => `
      <div class="transaction-row">
        <span class="transaction-row__index">${String(index + 1).padStart(2, '0')}</span>
        <div class="transaction-row__copy">
          <strong>${transaction.from_name}</strong> pays <strong>${transaction.to_name}</strong>
        </div>
        <div class="transaction-row__amount">${fmt.currency(transaction.amount, currency)}</div>
        <button type="button" class="btn btn-success btn-sm settle-now-btn"
          data-from="${transaction.from_user_id}"
          data-to="${transaction.to_user_id}"
          data-amount="${transaction.amount}">
          Mark Paid
        </button>
      </div>
    `).join('');
  };

  const renderHistory = (history, currency) => {
    if (!historyList) return;

    if (!history.length) {
      historyList.innerHTML = '<div class="empty-panel">No settlements recorded yet.</div>';
      return;
    }

    historyList.innerHTML = history.map((settlement) => `
      <div class="settlement-row">
        <div>
          <strong>${settlement.from_name}</strong> paid <strong>${settlement.to_name}</strong>
          <span>${fmt.dateTime(settlement.created_at)}</span>
        </div>
        <div class="settlement-row__amount">${fmt.currency(settlement.amount, currency)}</div>
        ${settlement.status === 'pending' && settlement.created_by === currentUser?.id
          ? `<button type="button" class="btn btn-ghost btn-sm cancel-settlement-btn" data-id="${settlement.id}">Cancel</button>`
          : ''}
      </div>
    `).join('');
  };

  const loadSettlementData = async (selectedGroupId) => {
    try {
      const [groupResponse, planResponse, historyResponse] = await Promise.all([
        api.get(`/groups/${selectedGroupId}`),
        api.get(`/settlements/plan/${selectedGroupId}`),
        api.get(`/settlements/history/${selectedGroupId}`),
      ]);

      const group = groupResponse.data;
      const transactions = planResponse.data?.transactions || [];
      const history = historyResponse.data || [];

      document.title = `${group.name} · Settlements`;
      if (backToGroup) backToGroup.href = `/groups/${selectedGroupId}`;
      if (planMeta) planMeta.textContent = `${group.name} · ${fmt.dateTime(planResponse.data?.computed_at || new Date())}`;

      renderTransactions(transactions, group.currency);
      renderHistory(history, group.currency);
      appShell.loadSidebarGroups();
    } catch (error) {
      if (planList) planList.innerHTML = `<div class="empty-panel empty-panel--error">${error.message || 'Failed to load settlement plan'}</div>`;
    }
  };

  const downloadPdf = async () => {
    const targetGroupId = groupSelect?.value || groupId;
    if (!targetGroupId) {
      window.alert('Select a group first.');
      return;
    }

    const token = Auth.getToken();
    const response = await fetch(`/api/settlements/${targetGroupId}/export/pdf`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      credentials: 'include',
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.message || 'Failed to download PDF');
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `settlement-${targetGroupId}.pdf`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  document.getElementById('transactionsList')?.addEventListener('click', async (event) => {
    const button = event.target.closest('.settle-now-btn');
    if (!button || !groupId) return;

    try {
      await api.post('/settlements/execute', {
        group_id: groupId,
        from_user_id: button.dataset.from,
        to_user_id: button.dataset.to,
        amount: Number(button.dataset.amount),
        settlement_type: 'full',
      });
      loadSettlementData(groupId);
    } catch (error) {
      window.alert(error.message || 'Settlement failed');
    }
  });

  historyList?.addEventListener('click', async (event) => {
    const button = event.target.closest('.cancel-settlement-btn');
    if (!button) return;
    if (!window.confirm('Cancel this pending settlement?')) return;
    try {
      await api.patch(`/settlements/${button.dataset.id}/cancel`);
      loadSettlementData(groupId);
    } catch (error) {
      window.alert(error.message || 'Failed to cancel settlement');
    }
  });

  downloadPdfBtn?.addEventListener('click', () => {
    downloadPdf().catch((error) => window.alert(error.message || 'Failed to download PDF'));
  });

  groupSelect?.addEventListener('change', () => {
    const selectedGroupId = groupSelect.value;
    if (!selectedGroupId) return;
    window.history.replaceState({}, '', `/settlements/${selectedGroupId}`);
    loadSettlementData(selectedGroupId);
  });

  const loadLanding = async () => {
    try {
      const response = await api.get('/groups');
      const groups = response.data || [];
      if (groupSelect) {
        groupSelect.innerHTML = groups.map((group) => `<option value="${group.id}">${group.name}</option>`).join('');
      }

      if (groupId) {
        groupSelect && (groupSelect.value = groupId);
        loadSettlementData(groupId);
        return;
      }

      if (groups.length) {
        const firstGroupId = groups[0].id;
        if (groupSelect) groupSelect.value = firstGroupId;
        window.history.replaceState({}, '', `/settlements/${firstGroupId}`);
        loadSettlementData(firstGroupId);
      } else {
        if (planList) planList.innerHTML = '<div class="empty-panel">Create a group first to see settlement suggestions.</div>';
        if (historyList) historyList.innerHTML = '<div class="empty-panel">No settlement history yet.</div>';
      }
    } catch (error) {
      if (planList) planList.innerHTML = `<div class="empty-panel empty-panel--error">${error.message || 'Failed to load settlements'}</div>`;
    }
  };

  loadLanding();
});
