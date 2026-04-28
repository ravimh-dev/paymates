document.addEventListener('DOMContentLoaded', () => {
  requireAuth();

  const $ = (id) => document.getElementById(id);
  const listEl = $('notificationsList');
  const unreadEl = $('notificationUnreadCount');
  const errorEl = $('notificationsError');

  const showError = (message) => {
    if (!errorEl) return;
    errorEl.textContent = message;
    errorEl.classList.remove('hidden');
  };

  const hideError = () => errorEl?.classList.add('hidden');

  const render = (notifications = []) => {
    if (unreadEl) {
      unreadEl.textContent = String(notifications.filter((item) => !item.is_read).length);
    }

    if (!notifications.length) {
      listEl.innerHTML = '<div class="empty-panel">No notifications yet.</div>';
      return;
    }

    listEl.innerHTML = notifications.map((notification) => `
      <article class="notification-card ${notification.is_read ? 'notification-card--read' : 'notification-card--unread'}" data-id="${notification.id}">
        <div class="notification-card__meta">
          <strong>${notification.title}</strong>
          <span>${fmt.dateTime(notification.created_at)}</span>
        </div>
        <p class="notification-card__body">${notification.body}</p>
        <div class="notification-card__actions">
          ${notification.is_read ? '<span class="pill pill--muted">Read</span>' : `<button type="button" class="btn btn-ghost btn-sm mark-read-btn" data-id="${notification.id}">Mark read</button>`}
        </div>
      </article>
    `).join('');
  };

  const loadNotifications = async () => {
    hideError();
    const [listResponse, unreadResponse] = await Promise.all([
      api.get('/notifications?limit=50'),
      api.get('/notifications/unread-count'),
    ]);
    render(listResponse.data || []);
    if (unreadEl) unreadEl.textContent = String(unreadResponse.data?.count || 0);
  };

  $('refreshNotificationsBtn')?.addEventListener('click', () => {
    loadNotifications().catch((error) => showError(error.message || 'Failed to refresh'));
  });

  $('markAllNotificationsBtn')?.addEventListener('click', async () => {
    try {
      await api.patch('/notifications/read-all');
      await loadNotifications();
    } catch (error) {
      showError(error.message || 'Failed to mark all read');
    }
  });

  listEl?.addEventListener('click', async (event) => {
    const button = event.target.closest('.mark-read-btn');
    if (!button) return;

    try {
      await api.patch(`/notifications/${button.dataset.id}/read`);
      await loadNotifications();
    } catch (error) {
      showError(error.message || 'Failed to mark notification as read');
    }
  });

  loadNotifications().catch((error) => showError(error.message || 'Failed to load notifications'));
});
