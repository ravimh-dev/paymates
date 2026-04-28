document.addEventListener('DOMContentLoaded', () => {
  requireAuth();

  const form = document.getElementById('createGroupForm');
  const errorEl = document.getElementById('createGroupError');

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    errorEl?.classList.add('hidden');

    const formData = new FormData(form);
    try {
      await api.post('/groups', {
        name: formData.get('name'),
        description: formData.get('description') || undefined,
        currency: formData.get('currency') || 'INR',
      });
      window.location.href = '/groups';
    } catch (error) {
      if (errorEl) {
        errorEl.textContent = error.message || 'Failed to create group';
        errorEl.classList.remove('hidden');
      }
    }
  });
});
