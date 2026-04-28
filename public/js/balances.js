document.addEventListener('DOMContentLoaded', () => {
  requireAuth();

  const balanceSummary = document.getElementById('balanceSummary');
  const balanceList = document.getElementById('balanceList');

  const loadBalances = async () => {
    if (!balanceList) return;

    try {
      const groupsResponse = await api.get('/groups');
      const groups = groupsResponse.data || [];
      const user = Auth.getUser();

      if (!groups.length) {
        balanceList.innerHTML = '<div class="empty-panel">No groups yet.</div>';
        if (balanceSummary) balanceSummary.innerHTML = '';
        return;
      }

      const hydrated = await Promise.all(groups.map(async (group) => {
        try {
          const response = await api.get(`/groups/${group.id}/balances`);
          const balances = response.data || [];
          const mine = balances.find((balance) => balance.user_id === user?.id)?.balance || 0;
          return { ...group, balances, mine };
        } catch {
          return { ...group, balances: [], mine: 0 };
        }
      }));

      const owedToYou = hydrated.reduce((sum, group) => sum + Math.max(group.mine, 0), 0);
      const youOwe = hydrated.reduce((sum, group) => sum + Math.max(-group.mine, 0), 0);

      if (balanceSummary) {
        balanceSummary.innerHTML = `
          <article class="stat-card">
            <span class="stat-card__label">Owed to you</span>
            <strong class="stat-card__value stat-card__value--positive">${fmt.currency(owedToYou, user?.currency || 'INR')}</strong>
            <span class="stat-card__hint">Across all groups</span>
          </article>
          <article class="stat-card">
            <span class="stat-card__label">You owe</span>
            <strong class="stat-card__value stat-card__value--negative">${fmt.currency(youOwe, user?.currency || 'INR')}</strong>
            <span class="stat-card__hint">Across all groups</span>
          </article>
        `;
      }

      balanceList.innerHTML = hydrated.map((group) => {
        const mine = group.mine;
        const label = mine > 0
          ? `${fmt.currency(mine, group.currency)} owed to you`
          : mine < 0
            ? `${fmt.currency(Math.abs(mine), group.currency)} you owe`
            : 'All settled up';
        return `
          <a class="balance-group-card" href="/groups/${group.id}">
            <div>
              <h3>${group.name}</h3>
              <p>${group.member_count || 0} members</p>
            </div>
            <strong class="${mine > 0 ? 'balance-positive' : mine < 0 ? 'balance-negative' : 'balance-neutral'}">${label}</strong>
          </a>
        `;
      }).join('');
    } catch (error) {
      balanceList.innerHTML = `<div class="empty-panel empty-panel--error">${error.message || 'Failed to load balances'}</div>`;
    }
  };

  loadBalances();
});
