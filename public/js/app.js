const Auth = {
  getToken: () => localStorage.getItem("access_token"),
  setToken: (token) => localStorage.setItem("access_token", token),
  setUser: (user) => localStorage.setItem("user", JSON.stringify(user)),
  getUser: () => {
    try {
      return JSON.parse(localStorage.getItem("user") || "null");
    } catch {
      return null;
    }
  },
  clear: () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user");
  },
  isLoggedIn: () => !!localStorage.getItem("access_token"),
  isTokenExpired: (token = localStorage.getItem("access_token")) => {
    if (!token) return true;
    try {
      const payloadPart = token.split(".")[1];
      if (!payloadPart) return true;
      const normalized = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
      const padded = normalized.padEnd(
        Math.ceil(normalized.length / 4) * 4,
        "=",
      );
      const payload = JSON.parse(atob(padded));
      if (!payload.exp) return false;
      return Date.now() >= payload.exp * 1000;
    } catch {
      return true;
    }
  },
  hasValidSession: () => {
    const token = localStorage.getItem("access_token");
    return !!token && !Auth.isTokenExpired(token);
  },
};

let refreshPromise = null;

const redirectToLogin = () => {
  Auth.clear();
  if (!window.location.pathname.includes("/login")) {
    window.location.href = "/login";
  }
};

const persistTokens = (tokens) => {
  if (!tokens) return;
  if (tokens.accessToken) Auth.setToken(tokens.accessToken);
};

const refreshSession = async () => {
  if (!refreshPromise) {
    refreshPromise = fetch("/api/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: "{}",
    })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload.message || "Session refresh failed");
        }
        persistTokens(payload.data);
        return payload.data;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
};

const apiFetch = async (method, path, body) => {
  const headers = { "Content-Type": "application/json" };
  const token = Auth.getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  if (token && Auth.isTokenExpired(token) && !path.startsWith("/auth/")) {
    try {
      await refreshSession();
    } catch {
      redirectToLogin();
      throw {
        status: 401,
        message: "Session expired",
      };
    }
  }

  const requestOptions = {
    method,
    headers,
    credentials: "include",
    body: body ? JSON.stringify(body) : undefined,
  };

  const perform = async () => {
    const response = await fetch(`/api${path}`, requestOptions);
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = {
        status: response.status,
        message: payload.message || "Request failed",
        errors: payload.errors,
        meta: payload.meta,
      };

      if (response.status === 401 && !path.startsWith("/auth/")) {
        try {
          await refreshSession();
          const retryToken = Auth.getToken();
          if (retryToken) headers.Authorization = `Bearer ${retryToken}`;
          const retryResponse = await fetch(`/api${path}`, requestOptions);
          const retryPayload = await retryResponse.json().catch(() => ({}));
          if (!retryResponse.ok) {
            throw {
              status: retryResponse.status,
              message: retryPayload.message || "Request failed",
              errors: retryPayload.errors,
              meta: retryPayload.meta,
            };
          }
          return retryPayload;
        } catch (refreshError) {
          redirectToLogin();
          throw error;
        }
      }

      throw error;
    }

    return payload;
  };

  return perform();
};

const api = {
  get: (path) => apiFetch("GET", path),
  post: (path, body) => apiFetch("POST", path, body),
  put: (path, body) => apiFetch("PUT", path, body),
  patch: (path, body) => apiFetch("PATCH", path, body),
  del: (path) => apiFetch("DELETE", path),
};

const fmt = {
  currency: (amount, currency = "INR") =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
    }).format(Number(amount || 0)),
  date: (value) =>
    new Date(value).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }),
  dateTime: (value) =>
    new Date(value).toLocaleString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }),
  initials: (name) =>
    (name || "?")
      .split(" ")
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase(),
  categoryEmoji: (category) =>
    ({
      food: "🍽️",
      transport: "🚗",
      accommodation: "🏨",
      entertainment: "🎭",
      utilities: "⚡",
      shopping: "🛍️",
      healthcare: "🏥",
      other: "📦",
    })[category] || "📦",
};

const requireAuth = () => {
  if (window.location.pathname.includes("/login")) return;
  if (!Auth.hasValidSession()) {
    redirectToLogin();
  }
};

const getNavKey = () => {
  const path = window.location.pathname;
  if (path.startsWith("/notifications")) return "notifications";
  if (
    path.startsWith("/groups/") &&
    path !== "/groups" &&
    !path.includes("/settlements")
  )
    return "groups";
  if (path.startsWith("/settlements")) return "settlements";
  if (path.startsWith("/balances")) return "balances";
  if (path.startsWith("/history")) return "history";
  if (path.startsWith("/groups")) return "groups";
  return "dashboard";
};

const handleLogout = async () => {
  try {
    await api.post("/auth/logout");
  } catch {
    // Logout should still clear local state if the token is stale.
  }
  Auth.clear();
  window.location.href = "/login";
};

const loadSidebarGroups = async () => {
  const sidebarGroupList = document.getElementById("sidebarGroupList");
  if (!sidebarGroupList || !Auth.isLoggedIn()) return;

  sidebarGroupList.innerHTML =
    '<li class="sidebar-empty">Loading groups...</li>';

  try {
    const response = await api.get("/groups");
    const groups = response.data || [];
    const currentPath = window.location.pathname;

    if (!groups.length) {
      sidebarGroupList.innerHTML =
        '<li class="sidebar-empty">No groups yet</li>';
      return;
    }

    sidebarGroupList.innerHTML = groups
      .map((group) => {
        const isActive =
          currentPath === `/groups/${group.id}` ||
          currentPath === `/settlements/${group.id}`;
        return `
        <li>
          <a href="/groups/${group.id}" class="sidebar-link ${isActive ? "active" : ""}">
            <span class="sidebar-link__icon">#</span>
            <span class="sidebar-group-name">${group.name}</span>
          </a>
        </li>
      `;
      })
      .join("");
  } catch {
    sidebarGroupList.innerHTML =
      '<li class="sidebar-empty sidebar-empty--error">Failed to load groups</li>';
  }
};

const setupShell = () => {
  const user = Auth.getUser();

  document.querySelectorAll("[data-nav]").forEach((link) => {
    if (link.dataset.nav === getNavKey()) {
      link.classList.add("active");
    }
  });

  const sidebarAvatar = document.getElementById("sidebarAvatar");
  const sidebarUserName = document.getElementById("sidebarUserName");
  const sidebarUserEmail = document.getElementById("sidebarUserEmail");

  if (user) {
    if (sidebarAvatar) sidebarAvatar.textContent = fmt.initials(user.name);
    if (sidebarUserName) sidebarUserName.textContent = user.name;
    if (sidebarUserEmail) sidebarUserEmail.textContent = user.email;
  }

  document.getElementById("logoutBtn")?.addEventListener("click", handleLogout);
  document
    .getElementById("logoutBtnSidebar")
    ?.addEventListener("click", handleLogout);

  void loadSidebarGroups();
};

document.addEventListener("DOMContentLoaded", () => {
  if (window.location.pathname.includes("/login")) return;
  if (!Auth.hasValidSession()) {
    redirectToLogin();
    return;
  }
  setupShell();
});

window.Auth = Auth;
window.api = api;
window.fmt = fmt;
window.requireAuth = requireAuth;
window.appShell = {
  loadSidebarGroups,
  setupShell,
  handleLogout,
};
