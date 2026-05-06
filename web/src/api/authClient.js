const defaultConfig = {
  authRequired: false,
  apiBaseUrl: '',
  loginPath: '/auth/login',
  logoutPath: '/auth/logout',
  mePath: '/api/me'
};

export function authConfig() {
  return { ...defaultConfig, ...(window.BMR_AUTH_CONFIG || window.BMR_AUTH || {}) };
}

function joinBase(base, path) {
  if (!base) return path;
  return `${base.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`;
}

export function loginUrl() {
  const cfg = authConfig();
  return joinBase(cfg.apiBaseUrl, cfg.loginPath);
}

export function logoutUrl() {
  const cfg = authConfig();
  return joinBase(cfg.apiBaseUrl, cfg.logoutPath);
}

export async function loadSession() {
  const cfg = authConfig();
  if (!cfg.authRequired) return { authenticated: true, local_mock_mode: true };
  const res = await fetch(joinBase(cfg.apiBaseUrl, cfg.mePath), {
    credentials: 'include',
    cache: 'no-store'
  });
  if (res.status === 401) return { authenticated: false };
  if (!res.ok) throw new Error(`No se pudo validar la sesión: HTTP ${res.status}`);
  return res.json();
}
