document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('resetPasswordForm');
  const errorEl = document.getElementById('resetError');
  const successEl = document.getElementById('resetSuccess');
  const tokenInput = document.getElementById('resetToken');

  const hide = (el) => el?.classList.add('hidden');
  const show = (el, message) => {
    if (!el) return;
    el.textContent = message;
    el.classList.remove('hidden');
  };

  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');
  if (token && tokenInput) tokenInput.value = token;

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    hide(errorEl);
    hide(successEl);

    const formData = new FormData(form);
    try {
      await api.post('/auth/reset-password', {
        token: formData.get('token'),
        password: formData.get('password'),
      });
      show(successEl, 'Password reset successfully. Redirecting to login...');
      setTimeout(() => {
        window.location.href = '/login';
      }, 1200);
    } catch (error) {
      show(errorEl, error.message || 'Failed to reset password');
    }
  });
});
