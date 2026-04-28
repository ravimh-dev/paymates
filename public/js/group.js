document.addEventListener('DOMContentLoaded', () => {
  requireAuth();

  const groupId = window.location.pathname.split('/')[2];
  if (!groupId) {
    window.location.href = '/groups';
    return;
  }

  const $ = (id) => document.getElementById(id);
  const currentUser = Auth.getUser();
  let groupMembers = [];
  let currentSplitType = 'equal';
  let currentGroup = null;
  let currentExpense = null;
  let currentUserRole = 'viewer';

  const renderBalanceLabel = (balance, currency) => {
    if (balance > 0) return { text: `${fmt.currency(balance, currency)} owed to you`, className: 'balance-positive' };
    if (balance < 0) return { text: `${fmt.currency(Math.abs(balance), currency)} you owe`, className: 'balance-negative' };
    return { text: 'All settled up', className: 'balance-neutral' };
  };

  const renderSummary = (group, balances) => {
    const currentBalance = balances.find((entry) => entry.user_id === currentUser?.id)?.balance || 0;
    const totalOwedToYou = balances.reduce((sum, entry) => sum + Math.max(entry.balance, 0), 0);
    const totalYouOwe = balances.reduce((sum, entry) => sum + Math.max(-entry.balance, 0), 0);
    const summaryEl = $('groupSummary');

    if (!summaryEl) return;

    summaryEl.innerHTML = `
      <article class="stat-card">
        <span class="stat-card__label">Members</span>
        <strong class="stat-card__value">${group.member_count || group.members?.length || 0}</strong>
        <span class="stat-card__hint">People in this group</span>
      </article>
      <article class="stat-card">
        <span class="stat-card__label">Total spent</span>
        <strong class="stat-card__value">${fmt.currency(group.total_expenses || 0, group.currency)}</strong>
        <span class="stat-card__hint">Group expenses so far</span>
      </article>
      <article class="stat-card">
        <span class="stat-card__label">Owed to you</span>
        <strong class="stat-card__value stat-card__value--positive">${fmt.currency(totalOwedToYou, group.currency)}</strong>
        <span class="stat-card__hint">Positive balances</span>
      </article>
      <article class="stat-card">
        <span class="stat-card__label">You owe</span>
        <strong class="stat-card__value stat-card__value--negative">${fmt.currency(totalYouOwe, group.currency)}</strong>
        <span class="stat-card__hint">Negative balances</span>
      </article>
    `;

    const balanceBadge = $('userBalanceBadge');
    if (balanceBadge) {
      const label = renderBalanceLabel(currentBalance, group.currency);
      balanceBadge.className = `group-balance-chip ${label.className}`;
      balanceBadge.textContent = label.text;
    }
  };

  const renderMembers = (members, group) => {
    groupMembers = members || [];
    const membersEl = $('membersList');
    if (!membersEl) return;

    if (!members.length) {
      membersEl.innerHTML = '<div class="empty-panel">No members found.</div>';
      return;
    }

    membersEl.innerHTML = members.map((member) => `
      <div class="member-row">
        <div class="avatar">${fmt.initials(member.name)}</div>
        <div class="member-row__info">
          <strong>${member.name}</strong>
          <span>${member.email}</span>
        </div>
        <span class="role-badge role-${member.role}">${member.role}</span>
        ${member.user_id !== currentUser?.id ? `<button type="button" class="btn btn-ghost btn-sm member-remove-btn" data-user="${member.user_id}">Remove</button>` : ''}
      </div>
    `).join('');

    document.querySelectorAll('.member-remove-btn').forEach((button) => {
      button.addEventListener('click', async () => {
        if (!window.confirm('Remove this member?')) return;
        try {
          await api.del(`/groups/${group.id}/members/${button.dataset.user}`);
          loadGroup();
        } catch (error) {
          window.alert(error.message || 'Failed to remove member');
        }
      });
    });
  };

  const renderBalances = (balances, group) => {
    const balancesEl = $('balancesList');
    if (!balancesEl) return;

    if (!balances.length) {
      balancesEl.innerHTML = '<div class="empty-panel">No balances yet. Add an expense to begin.</div>';
      return;
    }

    balancesEl.innerHTML = balances.map((balance) => {
      const label = renderBalanceLabel(balance.balance, group.currency);
      return `
        <div class="balance-row">
          <div class="balance-row__user">
            <div class="avatar">${fmt.initials(balance.name)}</div>
            <div>
              <strong>${balance.name}</strong>
              <span>${balance.email}</span>
            </div>
          </div>
          <div class="balance-row__value ${label.className}">${label.text}</div>
        </div>
      `;
    }).join('');
  };

  const renderExpenses = (expenses) => {
    const expensesEl = $('expensesList');
    if (!expensesEl) return;

    if (!expenses.length) {
      expensesEl.innerHTML = '<div class="empty-panel">No expenses yet.</div>';
      return;
    }

    expensesEl.innerHTML = expenses.map((expense) => `
      <article class="expense-card" data-expense-id="${expense.id}">
        <div class="expense-card__icon">${fmt.categoryEmoji(expense.category)}</div>
        <div class="expense-card__content">
          <h4>${expense.description}</h4>
          <p>Paid by ${expense.payer_name} · ${fmt.dateTime(expense.expense_date)} · ${expense.split_type} split</p>
          <p class="expense-card__participants">Split among ${expense.splits?.map((split) => split.name).join(', ') || 'n/a'}</p>
        </div>
        <div class="expense-card__amount">${fmt.currency(expense.amount, expense.currency)}</div>
        <div class="expense-card__actions">
          <button type="button" class="btn btn-ghost btn-sm expense-edit-btn" data-expense="${expense.id}">Edit</button>
          <button type="button" class="btn btn-danger btn-sm expense-delete-btn" data-expense="${expense.id}">Delete</button>
        </div>
      </article>
    `).join('');
  };

  const renderSettlementPlan = (plan) => {
    const planEl = $('settlementPlanList');
    const countEl = $('settlementPlanCount');
    if (!planEl) return;

    const transactions = plan || [];
    if (countEl) {
      countEl.textContent = `${transactions.length} transaction${transactions.length === 1 ? '' : 's'}`;
    }

    if (!transactions.length) {
      planEl.innerHTML = '<div class="empty-panel">Everyone is settled up.</div>';
      return;
    }

    planEl.innerHTML = transactions.map((transaction, index) => `
      <div class="transaction-row">
        <span class="transaction-row__index">${String(index + 1).padStart(2, '0')}</span>
        <div class="transaction-row__copy">
          <strong>${transaction.from_name}</strong> pays <strong>${transaction.to_name}</strong>
        </div>
        <div class="transaction-row__amount">${fmt.currency(transaction.amount, transaction.currency)}</div>
        <button type="button" class="btn btn-success btn-sm settle-now-btn"
          data-from="${transaction.from_user_id}"
          data-to="${transaction.to_user_id}"
          data-amount="${transaction.amount}">
          Mark Paid
        </button>
      </div>
    `).join('');
  };

  const renderRecentSettlements = (settlements) => {
    const recentEl = $('recentSettlementsList');
    if (!recentEl) return;

    if (!settlements.length) {
      recentEl.innerHTML = '<div class="empty-panel">No settlements recorded yet.</div>';
      return;
    }

    recentEl.innerHTML = settlements.slice(0, 5).map((settlement) => `
      <div class="settlement-row">
        <div>
          <strong>${settlement.from_name}</strong> paid <strong>${settlement.to_name}</strong>
          <span>${fmt.dateTime(settlement.created_at)}</span>
        </div>
        <div class="settlement-row__amount">${fmt.currency(settlement.amount, settlement.currency)}</div>
      </div>
    `).join('');
  };

  const renderGroupHeader = (group) => {
    $('groupName').textContent = group.name;
    $('groupSubtitle').textContent = group.description || 'Manage members, expenses, and settlements from one place.';
    $('groupCurrency').textContent = group.currency;
    $('groupBackLink').href = '/groups';
    $('groupSettleLink').href = `/settlements/${groupId}`;
    $('groupSettleLink2')?.setAttribute('href', `/settlements/${groupId}`);
    document.title = `${group.name} · Expense Splitter`;
  };

  const populatePaidBySelect = (members) => {
    const select = $('paidBySelect');
    if (select) {
      select.innerHTML = members.map((member) => `
        <option value="${member.user_id}" ${member.user_id === currentUser?.id ? 'selected' : ''}>${member.name}</option>
      `).join('');
    }

    const participantsGrid = $('participantsGrid');
    if (participantsGrid) {
      participantsGrid.innerHTML = members.map((member) => `
        <label class="participant-checkbox">
          <input type="checkbox" name="participantIds" value="${member.user_id}" checked />
          <span>${member.name}${member.user_id === currentUser?.id ? ' (You)' : ''}</span>
        </label>
      `).join('');
    }
  };

  const renderSplitFields = (type) => {
    const container = $('splitDetails');
    if (!container) return;

    if (type === 'equal') {
      container.innerHTML = '<p class="form-help">Amount will be split equally among the selected participants.</p>';
      return;
    }

    container.innerHTML = groupMembers.map((member) => `
      <div class="split-member-row">
        <span class="split-member-name">${member.name}</span>
        <input class="form-input split-amount-input" type="number" step="0.01" min="0" data-user="${member.user_id}" placeholder="${type === 'percentage' ? '%' : 'Amount'}" />
      </div>
    `).join('');
  };

  const openModal = (modal) => modal?.classList.remove('hidden');
  const closeModal = (modal, form, errorId) => {
    modal?.classList.add('hidden');
    form?.reset();
    if (errorId) $(errorId)?.classList.add('hidden');
  };
  const hideError = (el) => el?.classList.add('hidden');
  const setError = (el, message) => {
    if (!el) return;
    el.textContent = message;
    el.classList.remove('hidden');
  };

  const applyRoleVisibility = () => {
    const isAdmin = currentUserRole === 'admin';
    ['editGroupBtn', 'deleteGroupBtn', 'inviteGroupBtn'].forEach((id) => {
      const button = $(id);
      if (button) button.classList.toggle('hidden', !isAdmin);
    });
  };

  const loadGroup = async () => {
    try {
      const [groupResponse, balancesResponse, expensesResponse, planResponse, historyResponse] = await Promise.all([
        api.get(`/groups/${groupId}`),
        api.get(`/groups/${groupId}/balances`),
        api.get(`/expenses?groupId=${groupId}&limit=20`),
        api.get(`/settlements/plan/${groupId}`),
        api.get(`/settlements/history/${groupId}`),
      ]);

      const group = groupResponse.data;
      currentGroup = group;
      const balances = balancesResponse.data || [];
      const expenses = expensesResponse.data || [];
      const settlementPlan = planResponse.data?.transactions || [];
      const settlements = historyResponse.data || [];
      currentUserRole = (group.members || []).find((member) => member.user_id === currentUser?.id)?.role || 'viewer';

      renderGroupHeader(group);
      renderSummary(group, balances);
      renderMembers(group.members || [], group);
      renderBalances(balances, group);
      renderExpenses(expenses);
      renderSettlementPlan(settlementPlan);
      renderRecentSettlements(settlements);
      populatePaidBySelect(group.members || []);
      renderSplitFields(currentSplitType);
      applyRoleVisibility();
      appShell.loadSidebarGroups();
    } catch (error) {
      $('groupName').textContent = 'Group not found';
      $('groupSubtitle').textContent = error.message || 'Unable to load this group.';
    }
  };

  $('categoryFilter')?.addEventListener('change', async (event) => {
    try {
      const response = await api.get(`/expenses?groupId=${groupId}&limit=20${event.target.value ? `&category=${event.target.value}` : ''}`);
      renderExpenses(response.data || []);
    } catch (error) {
      window.alert(error.message || 'Failed to filter expenses');
    }
  });

  $('addMemberBtn')?.addEventListener('click', () => openModal($('addMemberModal')));
  $('closeMemberModal')?.addEventListener('click', () => closeModal($('addMemberModal'), $('addMemberForm'), 'memberError'));
  $('cancelMemberBtn')?.addEventListener('click', () => closeModal($('addMemberModal'), $('addMemberForm'), 'memberError'));
  $('addMemberModal')?.addEventListener('click', (event) => {
    if (event.target === $('addMemberModal')) closeModal($('addMemberModal'), $('addMemberForm'), 'memberError');
  });

  $('addMemberForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const errorEl = $('memberError');
    errorEl?.classList.add('hidden');

    const formData = new FormData($('addMemberForm'));
    try {
      await api.post(`/groups/${groupId}/members`, { email: formData.get('email') });
      closeModal($('addMemberModal'), $('addMemberForm'), 'memberError');
      loadGroup();
    } catch (error) {
      if (errorEl) {
        errorEl.textContent = error.message || 'Failed to add member';
        errorEl.classList.remove('hidden');
      }
    }
  });

  $('addExpenseBtn')?.addEventListener('click', () => openModal($('addExpenseModal')));
  $('closeExpenseModal')?.addEventListener('click', () => closeModal($('addExpenseModal'), $('addExpenseForm'), 'expError'));
  $('cancelExpenseBtn')?.addEventListener('click', () => closeModal($('addExpenseModal'), $('addExpenseForm'), 'expError'));
  $('addExpenseModal')?.addEventListener('click', (event) => {
    if (event.target === $('addExpenseModal')) closeModal($('addExpenseModal'), $('addExpenseForm'), 'expError');
  });

  document.querySelectorAll('.split-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.split-tab').forEach((button) => button.classList.remove('active'));
      tab.classList.add('active');
      currentSplitType = tab.dataset.type || 'equal';
      renderSplitFields(currentSplitType);
    });
  });

  $('addExpenseForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const errorEl = $('expError');
    errorEl?.classList.add('hidden');

    const formData = new FormData($('addExpenseForm'));
    const participantIds = Array.from(document.querySelectorAll('input[name="participantIds"]:checked')).map((input) => input.value);

    const body = {
      group_id: groupId,
      paid_by: formData.get('paid_by'),
      description: formData.get('description'),
      amount: Number(formData.get('amount')),
      currency: formData.get('currency') || currentUser?.currency || 'INR',
      category: formData.get('category') || 'other',
      split_type: currentSplitType,
      participants: currentSplitType === 'equal' ? participantIds : undefined,
      splits: currentSplitType === 'equal'
        ? undefined
        : Array.from(document.querySelectorAll('.split-amount-input')).map((input) => ({
            user_id: input.dataset.user,
            [currentSplitType === 'percentage' ? 'percentage' : 'amount']: Number(input.value) || 0,
          })),
    };

    try {
      await api.post('/expenses', body);
      closeModal($('addExpenseModal'), $('addExpenseForm'), 'expError');
      loadGroup();
    } catch (error) {
      if (errorEl) {
        errorEl.textContent = error.message || 'Failed to add expense';
        errorEl.classList.remove('hidden');
      }
    }
  });

  $('inviteGroupBtn')?.addEventListener('click', async () => {
    const modal = $('inviteGroupModal');
    const errorEl = $('inviteError');
    const input = $('inviteLinkInput');
    hideError(errorEl);

    try {
      const response = await api.get(`/groups/${groupId}/invite`);
      if (input) input.value = response.data?.link || '';
      openModal(modal);
    } catch (error) {
      setError(errorEl, error.message || 'Failed to load invite link');
      openModal(modal);
    }
  });

  $('closeInviteModal')?.addEventListener('click', () => closeModal($('inviteGroupModal')));
  $('closeInviteBtn')?.addEventListener('click', () => closeModal($('inviteGroupModal')));
  $('inviteGroupModal')?.addEventListener('click', (event) => {
    if (event.target === $('inviteGroupModal')) closeModal($('inviteGroupModal'));
  });
  $('copyInviteBtn')?.addEventListener('click', async () => {
    const input = $('inviteLinkInput');
    if (!input?.value) return;
    await navigator.clipboard.writeText(input.value);
    window.alert('Invite link copied');
  });

  $('editGroupBtn')?.addEventListener('click', () => {
    if (!currentGroup) return;
    $('editGroupName').value = currentGroup.name || '';
    $('editGroupDescription').value = currentGroup.description || '';
    $('editGroupCurrency').value = currentGroup.currency || 'INR';
    $('editGroupStatus').value = currentGroup.status || 'active';
    openModal($('editGroupModal'));
  });
  $('closeGroupEditModal')?.addEventListener('click', () => closeModal($('editGroupModal'), $('editGroupForm'), 'groupEditError'));
  $('cancelGroupEditBtn')?.addEventListener('click', () => closeModal($('editGroupModal'), $('editGroupForm'), 'groupEditError'));
  $('editGroupModal')?.addEventListener('click', (event) => {
    if (event.target === $('editGroupModal')) closeModal($('editGroupModal'), $('editGroupForm'), 'groupEditError');
  });
  $('editGroupForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const errorEl = $('groupEditError');
    hideError(errorEl);

    const formData = new FormData($('editGroupForm'));
    try {
      await api.put(`/groups/${groupId}`, {
        name: formData.get('name'),
        description: formData.get('description') || undefined,
        currency: formData.get('currency') || undefined,
        status: formData.get('status') || undefined,
      });
      closeModal($('editGroupModal'), $('editGroupForm'), 'groupEditError');
      loadGroup();
    } catch (error) {
      setError(errorEl, error.message || 'Failed to update group');
    }
  });

  $('deleteGroupBtn')?.addEventListener('click', async () => {
    if (!window.confirm('Delete this group? This cannot be undone.')) return;
    try {
      await api.del(`/groups/${groupId}`);
      window.location.href = '/groups';
    } catch (error) {
      window.alert(error.message || 'Failed to delete group');
    }
  });

  $('expensesList')?.addEventListener('click', async (event) => {
    const editButton = event.target.closest('.expense-edit-btn');
    const deleteButton = event.target.closest('.expense-delete-btn');
    if (editButton) {
      try {
        const response = await api.get(`/expenses/${editButton.dataset.expense}`);
        currentExpense = response.data;
        $('expenseDetailId').value = currentExpense.id;
        $('expenseDetailDescription').value = currentExpense.description || '';
        $('expenseDetailCategory').value = currentExpense.category || 'other';
        $('expenseDetailDate').value = (currentExpense.expense_date || '').toString().slice(0, 10);
        $('expenseDetailNotes').value = currentExpense.notes || '';
        openModal($('expenseDetailModal'));
      } catch (error) {
        window.alert(error.message || 'Failed to load expense');
      }
    }

    if (deleteButton) {
      if (!window.confirm('Delete this expense?')) return;
      try {
        await api.del(`/expenses/${deleteButton.dataset.expense}`);
        loadGroup();
      } catch (error) {
        window.alert(error.message || 'Failed to delete expense');
      }
    }
  });

  $('closeExpenseDetailModal')?.addEventListener('click', () => closeModal($('expenseDetailModal'), $('expenseDetailForm'), 'expenseDetailError'));
  $('expenseDetailModal')?.addEventListener('click', (event) => {
    if (event.target === $('expenseDetailModal')) closeModal($('expenseDetailModal'), $('expenseDetailForm'), 'expenseDetailError');
  });
  $('deleteExpenseBtn')?.addEventListener('click', async () => {
    const expenseId = $('expenseDetailId').value;
    if (!expenseId) return;
    if (!window.confirm('Delete this expense?')) return;
    try {
      await api.del(`/expenses/${expenseId}`);
      closeModal($('expenseDetailModal'), $('expenseDetailForm'), 'expenseDetailError');
      loadGroup();
    } catch (error) {
      setError($('expenseDetailError'), error.message || 'Failed to delete expense');
    }
  });
  $('expenseDetailForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const errorEl = $('expenseDetailError');
    hideError(errorEl);

    const formData = new FormData($('expenseDetailForm'));
    const expenseId = $('expenseDetailId').value;

    try {
      await api.put(`/expenses/${expenseId}`, {
        description: formData.get('description'),
        category: formData.get('category'),
        expense_date: formData.get('expense_date') || undefined,
        notes: formData.get('notes') || undefined,
      });
      closeModal($('expenseDetailModal'), $('expenseDetailForm'), 'expenseDetailError');
      loadGroup();
    } catch (error) {
      setError(errorEl, error.message || 'Failed to update expense');
    }
  });

  $('settlementPlanList')?.addEventListener('click', async (event) => {
    const button = event.target.closest('.settle-now-btn');
    if (!button) return;

    try {
      await api.post('/settlements/execute', {
        group_id: groupId,
        from_user_id: button.dataset.from,
        to_user_id: button.dataset.to,
        amount: Number(button.dataset.amount),
        settlement_type: 'full',
      });
      loadGroup();
    } catch (error) {
      window.alert(error.message || 'Settlement failed');
    }
  });

  loadGroup();
});
