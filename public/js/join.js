document.addEventListener('DOMContentLoaded', () => {
  const token = window.__inviteToken;
  const hint = document.getElementById('inviteHint');
  const errorEl = document.getElementById('joinError');
  const successEl = document.getElementById('joinSuccess');
  const button = document.getElementById('joinGroupBtn');

  const setMessage = (el, message) => {
    if (!el) return;
    el.textContent = message;
    el.classList.remove('hidden');
  };

  if (!token) {
    setMessage(errorEl, 'Missing invite token.');
    button?.setAttribute('disabled', 'true');
    return;
  }

  if (hint) {
    hint.textContent = `Invite token: ${token.slice(0, 8)}...`;
  }

  if (!Auth.isLoggedIn()) {
    localStorage.setItem('post_login_redirect', window.location.pathname);
    setMessage(errorEl, 'Please sign in first. You will return here after login.');
    button?.setAttribute('disabled', 'true');
    setTimeout(() => {
      window.location.href = '/login';
    }, 1200);
    return;
  }

  button?.addEventListener('click', async () => {
    try {
      await api.get(`/groups/join/${token}`);
      setMessage(successEl, 'You joined the group successfully. Redirecting...');
      setTimeout(() => {
        window.location.href = '/groups';
      }, 1000);
    } catch (error) {
      setMessage(errorEl, error.message || 'Unable to join group');
    }
  });
});
