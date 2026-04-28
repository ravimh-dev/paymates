document.addEventListener('DOMContentLoaded', () => {
  if (window.Auth && window.Auth.hasValidSession && window.Auth.hasValidSession()) {
    window.location.href = '/dashboard';
    return;
  }

  if (window.Auth && window.Auth.isLoggedIn && window.Auth.isLoggedIn() && window.Auth.isTokenExpired && window.Auth.isTokenExpired()) {
    window.Auth.clear();
  }

  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  const authError = document.getElementById('authError');
  const regError = document.getElementById('regError');
  const forgotPanel = document.getElementById('forgotPanel');
  const forgotError = document.getElementById('forgotError');
  const forgotSuccess = document.getElementById('forgotSuccess');
  const loginCard = document.querySelector('.auth-card');
  const registerCard = document.getElementById('registerCard');
  const serverStatus = document.getElementById('serverStatus');

  const showErr = (el, msg) => { el.textContent = msg; el.classList.remove('hidden'); };
  const hideErr = (el) => el.classList.add('hidden');

  fetch('/health')
    .then((response) => response.json())
    .then((data) => {
      if (serverStatus) serverStatus.textContent = data.status === 'ok' ? 'Server online' : 'Server status unknown';
    })
    .catch(() => {
      if (serverStatus) serverStatus.textContent = 'Server offline';
    });

  document.getElementById('showRegister')?.addEventListener('click', (e) => {
    e.preventDefault();
    loginCard.classList.add('hidden');
    registerCard.classList.remove('hidden');
  });

  document.getElementById('showLogin')?.addEventListener('click', (e) => {
    e.preventDefault();
    registerCard.classList.add('hidden');
    loginCard.classList.remove('hidden');
  });

  document.getElementById('showForgot')?.addEventListener('click', (e) => {
    e.preventDefault();
    forgotPanel?.classList.toggle('hidden');
  });

  loginForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideErr(authError);
    const btn = document.getElementById('loginBtn');
    btn.disabled = true;
    btn.textContent = 'Signing in...';
    try {
      const fd = new FormData(loginForm);
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: fd.get('email'), password: fd.get('password') }),
      });
      const data = await res.json();
      if (!res.ok) { showErr(authError, data.message || 'Login failed'); return; }
      localStorage.setItem('access_token', data.data.tokens.accessToken);
      localStorage.setItem('user', JSON.stringify(data.data.user));
      const redirectTo = localStorage.getItem('post_login_redirect');
      if (redirectTo) {
        localStorage.removeItem('post_login_redirect');
        window.location.href = redirectTo;
        return;
      }
      window.location.href = '/dashboard';
    } catch (err) {
      showErr(authError, 'Network error. Please try again.');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Sign In';
    }
  });

  registerForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideErr(regError);
    const fd = new FormData(registerForm);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: fd.get('name'), email: fd.get('email'), password: fd.get('password') }),
      });
      const data = await res.json();
      if (!res.ok) {
        const errMsg = data.errors ? data.errors.map(e => e.msg).join('. ') : data.message;
        showErr(regError, errMsg);
        return;
      }
      localStorage.setItem('access_token', data.data.tokens.accessToken);
      localStorage.setItem('user', JSON.stringify(data.data.user));
      const redirectTo = localStorage.getItem('post_login_redirect');
      if (redirectTo) {
        localStorage.removeItem('post_login_redirect');
        window.location.href = redirectTo;
        return;
      }
      window.location.href = '/dashboard';
    } catch {
      showErr(regError, 'Network error.');
    }
  });

  document.getElementById('forgotForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideErr(forgotError);
    hideErr(forgotSuccess);

    const fd = new FormData(e.currentTarget);
    try {
      const res = await api.post('/auth/forgot-password', { email: fd.get('email') });
      const resetLink = res.data?.resetLink || '';
      const resetToken = res.data?.resetToken || '';
      const message = resetLink || resetToken
        ? `Reset request created. ${resetLink ? `Open ${resetLink}` : `Token: ${resetToken}`}`
        : 'If this email exists, a reset link has been sent.';
      forgotSuccess.textContent = message;
      forgotSuccess.classList.remove('hidden');
    } catch (error) {
      showErr(forgotError, error.message || 'Unable to request reset');
    }
  });

  const params = new URLSearchParams(window.location.search);
  const resetToken = params.get('token');
  if (resetToken) {
    window.location.href = `/reset-password?token=${encodeURIComponent(resetToken)}`;
  }
});
