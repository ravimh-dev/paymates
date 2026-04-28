document.addEventListener('DOMContentLoaded', () => {
  requireAuth();

  const user = Auth.getUser();
  const greetingEl = document.getElementById('dashboardGreeting');
  const statsEl = document.getElementById('dashboardStats');
  const groupsGrid = document.getElementById('dashboardGroupsGrid');
  const newGroupBtn = document.getElementById('newGroupBtn');
  const newGroupModal = document.getElementById('newGroupModal');
  const closeGroupModal = document.getElementById('closeGroupModal');
  const cancelGroupBtn = document.getElementById('cancelGroupBtn');
  const newGroupForm = document.getElementById('newGroupForm');
  const groupError = document.getElementById('groupError');

  if (greetingEl && user) {
    greetingEl.textContent = `Welcome back, ${user.name}`;
  }

  const openModal = () => newGroupModal?.classList.remove('hidden');
  const closeModal = () => {
    newGroupModal?.classList.add('hidden');
    newGroupForm?.reset();
    groupError?.classList.add('hidden');
  };

  newGroupBtn?.addEventListener('click', openModal);
  closeGroupModal?.addEventListener('click', closeModal);
  cancelGroupBtn?.addEventListener('click', closeModal);
  newGroupModal?.addEventListener('click', (event) => {
    if (event.target === newGroupModal) closeModal();
  });

  const getNetBalanceForGroup = async (group) => {
    try {
      const response = await api.get(`/groups/${group.id}/balances`);
      const balances = response.data || [];
      const currentUserBalance = balances.find((balance) => balance.user_id === user?.id);
      const totalPositive = balances.reduce((sum, balance) => sum + Math.max(balance.balance, 0), 0);
      const totalNegative = balances.reduce((sum, balance) => sum + Math.max(-balance.balance, 0), 0);
      return {
        ...group,
        balances,
        currentUserBalance: currentUserBalance?.balance || 0,
        totalPositive,
        totalNegative,
      };
    } catch {
      return {
        ...group,
        balances: [],
        currentUserBalance: 0,
        totalPositive: 0,
        totalNegative: 0,
      };
    }
  };

  const renderStats = (groups) => {
    const totals = groups.reduce((accumulator, group) => {
      const balance = group.currentUserBalance || 0;
      accumulator.totalGroups += 1;
      accumulator.owedToYou += Math.max(balance, 0);
      accumulator.youOwe += Math.max(-balance, 0);
      if (balance > 0) accumulator.creditGroups += 1;
      if (balance < 0) accumulator.debtGroups += 1;
      return accumulator;
    }, {
      totalGroups: 0,
      owedToYou: 0,
      youOwe: 0,
      creditGroups: 0,
      debtGroups: 0,
    });

    if (!statsEl) return;

    statsEl.innerHTML = `
      <article class="stat-card">
        <span class="stat-card__label">Groups</span>
        <strong class="stat-card__value">${totals.totalGroups}</strong>
        <span class="stat-card__hint">${totals.creditGroups} positive, ${totals.debtGroups} pending</span>
      </article>
      <article class="stat-card">
        <span class="stat-card__label">Owed to you</span>
        <strong class="stat-card__value stat-card__value--positive">${fmt.currency(totals.owedToYou, user?.currency || 'INR')}</strong>
        <span class="stat-card__hint">Money others still owe</span>
      </article>
      <article class="stat-card">
        <span class="stat-card__label">You owe</span>
        <strong class="stat-card__value stat-card__value--negative">${fmt.currency(totals.youOwe, user?.currency || 'INR')}</strong>
        <span class="stat-card__hint">Money to settle</span>
      </article>
      <article class="stat-card">
        <span class="stat-card__label">Net</span>
        <strong class="stat-card__value ${totals.owedToYou - totals.youOwe >= 0 ? 'stat-card__value--positive' : 'stat-card__value--negative'}">${fmt.currency(Math.abs(totals.owedToYou - totals.youOwe), user?.currency || 'INR')}</strong>
        <span class="stat-card__hint">${totals.owedToYou - totals.youOwe >= 0 ? 'You are ahead' : 'You are behind'}</span>
      </article>
    `;
  };

  const renderGroups = (groups) => {
    if (!groupsGrid) return;

    if (!groups.length) {
      groupsGrid.innerHTML = `
        <div class="empty-panel">
          <h3>No groups yet</h3>
          <p>Create your first group to start splitting expenses with friends.</p>
          <button type="button" class="btn btn-primary" id="emptyCreateGroup">Create Group</button>
        </div>
      `;

      document.getElementById('emptyCreateGroup')?.addEventListener('click', openModal);
      return;
    }

    groupsGrid.innerHTML = groups.map((group) => {
      const balance = group.currentUserBalance || 0;
      const balanceClass = balance > 0 ? 'balance-positive' : balance < 0 ? 'balance-negative' : 'balance-neutral';
      const balanceLabel = balance > 0
        ? `${fmt.currency(balance, user?.currency || group.currency)} owed to you`
        : balance < 0
          ? `${fmt.currency(Math.abs(balance), user?.currency || group.currency)} you owe`
          : 'All settled up';

      return `
        <a href="/groups/${group.id}" class="group-card group-card--dashboard">
          <div class="group-card__top">
            <div>
              <div class="group-card__eyebrow">${group.currency}</div>
              <h3 class="group-card__title">${group.name}</h3>
            </div>
            <span class="group-status status-${group.status}">${group.status}</span>
          </div>
          <p class="group-card__desc">${group.description || 'No description yet.'}</p>
          <div class="group-card__meta">
            <span>${group.member_count || 0} members</span>
            <span class="${balanceClass}">${balanceLabel}</span>
          </div>
        </a>
      `;
    }).join('');
  };

  const loadGroups = async () => {
    if (!groupsGrid) return;
    groupsGrid.innerHTML = '<div class="loading-state">Loading groups...</div>';

    try {
      const response = await api.get('/groups');
      const groups = response.data || [];
      const hydrated = await Promise.all(groups.map(getNetBalanceForGroup));
      renderStats(hydrated);
      renderGroups(hydrated);
      appShell.loadSidebarGroups();
    } catch (error) {
      groupsGrid.innerHTML = `<div class="empty-panel empty-panel--error">${error.message || 'Failed to load groups'}</div>`;
    }
  };

  newGroupForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    groupError?.classList.add('hidden');

    const formData = new FormData(newGroupForm);

    try {
      await api.post('/groups', {
        name: formData.get('name'),
        description: formData.get('description') || undefined,
        currency: formData.get('currency') || 'INR',
      });
      closeModal();
      loadGroups();
    } catch (error) {
      if (groupError) {
        groupError.textContent = error.message || 'Failed to create group';
        groupError.classList.remove('hidden');
      }
    }
  });

  loadGroups();
});
