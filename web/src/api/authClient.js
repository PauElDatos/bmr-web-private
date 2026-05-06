const defaultConfig = {
  enabled: false,
  authBase: '',
  loginPath: '/auth/login',
  logoutPath: '/auth/logout',
  mePath: '/api/me',
  protectedData: false
};

export function authConfig() {
  return { ...defaultConfig, ...(window.BMR_AUTH || {}) };
}

function joinBase(base, path) {
  if (!base) return path;
  return `${base.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`;
}

export function loginUrl() {
  const cfg = authConfig();
  return joinBase(cfg.authBase, cfg.loginPath);
}

export function logoutUrl() {
  const cfg = authConfig();
  return joinBase(cfg.authBase, cfg.logoutPath);
}

export async function loadSession() {
  const cfg = authConfig();
  if (!cfg.enabled) return { authenticated: true, local_mock_mode: true };
  const res = await fetch(joinBase(cfg.authBase, cfg.mePath), {
    credentials: 'include',
    cache: 'no-store'
  });
  if (res.status === 401) return { authenticated: false };
  if (!res.ok) throw new Error(`No se pudo validar la sesión: HTTP ${res.status}`);
  return res.json();
}
