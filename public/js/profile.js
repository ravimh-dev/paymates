document.addEventListener('DOMContentLoaded', () => {
  requireAuth();

  const profileForm = document.getElementById('profileForm');
  const passwordForm = document.getElementById('passwordForm');
  const profileError = document.getElementById('profileError');
  const passwordError = document.getElementById('passwordError');
  const deleteAccountError = document.getElementById('deleteAccountError');
  const deleteAccountBtn = document.getElementById('deleteAccountBtn');

  const setError = (el, message) => {
    if (!el) return;
    el.textContent = message;
    el.classList.remove('hidden');
  };

  const hideError = (el) => el?.classList.add('hidden');

  const loadProfile = async () => {
    try {
      const response = await api.get('/users/me');
      const user = response.data;
      document.getElementById('profileName').value = user.name || '';
      document.getElementById('profileAvatar').value = user.avatar_url || '';
      document.getElementById('profileTimezone').value = user.timezone || '';
      document.getElementById('profileCurrency').value = user.currency || 'INR';
      Auth.setUser(user);
      appShell.setupShell();
    } catch (error) {
      setError(profileError, error.message || 'Failed to load profile');
    }
  };

  profileForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    hideError(profileError);

    const formData = new FormData(profileForm);
    try {
      const response = await api.put('/users/me', {
        name: formData.get('name'),
        avatar_url: formData.get('avatar_url') || undefined,
        timezone: formData.get('timezone') || undefined,
        currency: formData.get('currency') || undefined,
      });
      Auth.setUser(response.data);
      appShell.setupShell();
    } catch (error) {
      setError(profileError, error.message || 'Failed to update profile');
    }
  });

  passwordForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    hideError(passwordError);

    const formData = new FormData(passwordForm);
    try {
      await api.post('/users/me/change-password', {
        currentPassword: formData.get('currentPassword'),
        newPassword: formData.get('newPassword'),
      });
      passwordForm.reset();
      window.alert('Password updated successfully');
    } catch (error) {
      setError(passwordError, error.message || 'Failed to change password');
    }
  });

  deleteAccountBtn?.addEventListener('click', async () => {
    if (!window.confirm('Delete your account? This will deactivate your profile.')) return;
    hideError(deleteAccountError);

    try {
      await api.del('/users/me');
      Auth.clear();
      window.location.href = '/login';
    } catch (error) {
      setError(deleteAccountError, error.message || 'Failed to delete account');
    }
  });

  loadProfile();
});
