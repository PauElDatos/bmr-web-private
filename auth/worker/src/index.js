import {
  buildCookie,
  deleteCookie,
  htmlResponse,
  jsonResponse,
  parseCookies,
  randomBase64Url,
  signPayload,
  verifyPayload
} from './session.js';
import { buildPatreonAuthorizeUrl, evaluateEntitlement, exchangeCodeForToken, fetchPatreonIdentity } from './patreon.js';
import { fetchFromStaticOrigin, getPrivateDataObject } from './r2.js';

export default {
  async fetch(request, env) {
    try {
      if (request.method === 'OPTIONS') {
        return corsResponse(new Response(null, { status: 204 }), request, env);
      }
      return await handleRequest(request, env);
    } catch (err) {
      console.error(err);
      return corsResponse(jsonResponse({ ok: false, error: String(err?.message || err) }, 500), request, env);
    }
  }
};

async function handleRequest(request, env) {
  const url = new URL(request.url);
  const pathname = url.pathname;

  if (pathname === '/auth/login') return corsResponse(await handleLogin(request, env), request, env);
  if (pathname === '/auth/callback') return corsResponse(await handleCallback(request, env), request, env);
  if (pathname === '/auth/logout') return corsResponse(handleLogout(env), request, env);
  if (pathname === '/api/me') return corsResponse(await handleMe(request, env), request, env);
  if (pathname === '/auth/denied') return corsResponse(deniedPage(url.searchParams.get('reason') || 'access_denied'), request, env);

  const session = await getSession(request, env);

  if (pathname.startsWith('/data/')) {
    if (!session) return corsResponse(jsonResponse({ ok: false, error: 'auth_required' }, 401), request, env);
    return corsResponse(await serveData(request, env, pathname), request, env);
  }

  const gateStatic = String(env.GATE_STATIC_SITE || 'true').toLowerCase() !== 'false';
  if (gateStatic && !session) {
    if (wantsHtml(request)) return corsResponse(loginPage(env), request, env);
    return corsResponse(jsonResponse({ ok: false, error: 'auth_required' }, 401), request, env);
  }

  return corsResponse(await serveStatic(request, env, pathname), request, env);
}

async function handleLogin(request, env) {
  requireEnv(env, ['PATREON_CLIENT_ID', 'PATREON_REDIRECT_URI', 'SESSION_SECRET']);
  const state = randomBase64Url(32);
  const headers = new Headers();
  headers.set('location', buildPatreonAuthorizeUrl(env, state));
  headers.append('set-cookie', buildCookie(env.STATE_COOKIE_NAME || 'bmr_oauth_state', state, {
    maxAge: 600,
    path: '/',
    sameSite: 'None'
  }));
  return new Response(null, { status: 302, headers });
}

async function handleCallback(request, env) {
  requireEnv(env, ['PATREON_CLIENT_ID', 'PATREON_CLIENT_SECRET', 'PATREON_REDIRECT_URI', 'SESSION_SECRET']);
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const returnedState = url.searchParams.get('state');
  const cookies = parseCookies(request.headers.get('cookie') || '');
  const expectedState = cookies[env.STATE_COOKIE_NAME || 'bmr_oauth_state'];

  if (!code || !returnedState || !expectedState || returnedState !== expectedState) {
    return redirectWithClearedState('/auth/denied?reason=invalid_state', env);
  }

  const token = await exchangeCodeForToken(env, code);
  const identity = await fetchPatreonIdentity(env, token.access_token);
  const entitlement = evaluateEntitlement(env, identity);

  if (!entitlement.allowed) {
    return redirectWithClearedState(`/auth/denied?reason=${encodeURIComponent(entitlement.reason)}`, env);
  }

  const ttl = Number(env.SESSION_TTL_SECONDS || 259200);
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: entitlement.user.patreon_user_id,
    name: entitlement.user.full_name,
    email: entitlement.user.email,
    tiers: entitlement.entitlements.map((x) => x.tier_id),
    entitlements: entitlement.entitlements,
    iat: now,
    exp: now + ttl
  };
  const sessionToken = await signPayload(payload, env.SESSION_SECRET);
  const redirectTo = env.PUBLIC_LOGIN_REDIRECT || '/#/';
  const headers = new Headers({ location: redirectTo });
  headers.append('set-cookie', deleteCookie(env.STATE_COOKIE_NAME || 'bmr_oauth_state'));
  headers.append('set-cookie', buildCookie(env.SESSION_COOKIE_NAME || 'bmr_session', sessionToken, {
    maxAge: ttl,
    path: '/',
    sameSite: 'None'
  }));
  return new Response(null, { status: 302, headers });
}

function handleLogout(env) {
  const headers = new Headers({ location: '/auth/login' });
  headers.append('set-cookie', deleteCookie(env.SESSION_COOKIE_NAME || 'bmr_session'));
  headers.append('set-cookie', deleteCookie(env.STATE_COOKIE_NAME || 'bmr_oauth_state'));
  return new Response(null, { status: 302, headers });
}

async function handleMe(request, env) {
  const session = await getSession(request, env);
  if (!session) return jsonResponse({ authenticated: false }, 401);
  return jsonResponse({
    authenticated: true,
    user: {
      patreon_user_id: session.sub,
      name: session.name,
      email: session.email,
      tiers: session.tiers || [],
      entitlements: session.entitlements || [],
      expires_at: session.exp ? new Date(session.exp * 1000).toISOString() : null
    }
  });
}

async function getSession(request, env) {
  const cookies = parseCookies(request.headers.get('cookie') || '');
  const token = cookies[env.SESSION_COOKIE_NAME || 'bmr_session'];
  if (!token) return null;
  return verifyPayload(token, env.SESSION_SECRET);
}

async function serveData(request, env, pathname) {
  const key = pathname.replace(/^\/+/, '');
  const r2 = await getPrivateDataObject(env, key);
  if (r2) return withSecurityHeaders(r2);
  return withSecurityHeaders(await fetchFromStaticOrigin(env, request, pathname));
}

async function serveStatic(request, env, pathname) {
  let res = await fetchFromStaticOrigin(env, request, pathname);
  if (res.status === 404 && !pathname.includes('.')) {
    res = await fetchFromStaticOrigin(env, request, '/index.html');
  }
  return withSecurityHeaders(res);
}

function withSecurityHeaders(response) {
  const headers = new Headers(response.headers);
  headers.set('x-content-type-options', 'nosniff');
  headers.set('referrer-policy', 'strict-origin-when-cross-origin');
  headers.set('permissions-policy', 'camera=(), microphone=(), geolocation=()');
  if (!headers.has('cache-control')) headers.set('cache-control', 'private, max-age=60');
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function corsResponse(response, request, env) {
  const headers = new Headers(response.headers);
  const origin = request.headers.get('Origin') || '';
  const allowedOrigins = [
    'https://paueldatos.github.io',
    'https://paueldatos.github.io/'
  ];
  if (allowedOrigins.includes(origin)) {
    headers.set('Access-Control-Allow-Origin', origin.replace(/\/$/, ''));
    headers.set('Access-Control-Allow-Credentials', 'true');
    headers.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'content-type');
    headers.append('Vary', 'Origin');
  }
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function wantsHtml(request) {
  return (request.headers.get('accept') || '').includes('text/html');
}

function requireEnv(env, names) {
  const missing = names.filter((name) => !env[name]);
  if (missing.length) throw new Error(`Faltan variables/secrets: ${missing.join(', ')}`);
}

function redirectWithClearedState(location, env) {
  const headers = new Headers({ location });
  headers.append('set-cookie', deleteCookie(env.STATE_COOKIE_NAME || 'bmr_oauth_state'));
  return new Response(null, { status: 302, headers });
}

function loginPage(env) {
  const siteName = env.PUBLIC_SITE_NAME || 'BMR Market Intelligence';
  return htmlResponse(`<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(siteName)} · Acceso Patreon</title>
  <style>
    :root{color-scheme:dark;--bg:#070b12;--card:#101827;--line:#243247;--text:#e7eefc;--muted:#8fa0bb;--accent:#f96854;--accent2:#31d0aa}*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:radial-gradient(circle at 20% 0%,rgba(249,104,84,.16),transparent 35%),radial-gradient(circle at 80% 20%,rgba(49,208,170,.14),transparent 40%),var(--bg);font-family:Inter,system-ui,Segoe UI,Arial,sans-serif;color:var(--text)}.card{width:min(560px,92vw);padding:34px;border:1px solid var(--line);border-radius:28px;background:linear-gradient(180deg,rgba(255,255,255,.06),rgba(255,255,255,.02));box-shadow:0 24px 80px rgba(0,0,0,.38)}.kicker{letter-spacing:.16em;text-transform:uppercase;color:var(--accent2);font-weight:700;font-size:12px}h1{font-size:34px;margin:10px 0 12px}p{color:var(--muted);line-height:1.6}.btn{display:inline-flex;align-items:center;gap:10px;margin-top:18px;background:var(--accent);color:white;text-decoration:none;padding:13px 18px;border-radius:16px;font-weight:800}.foot{margin-top:18px;font-size:12px;color:#718098}</style>
</head>
<body>
  <section class="card">
    <div class="kicker">Acceso privado</div>
    <h1>${escapeHtml(siteName)}</h1>
    <p>Esta web está protegida. Inicia sesión con Patreon para verificar que tu cuenta pertenece a uno de los niveles autorizados.</p>
    <a class="btn" href="/auth/login">Entrar con Patreon</a>
    <div class="foot">El acceso se valida en el servidor. Los secretos OAuth y la comprobación de tier no se exponen al navegador.</div>
  </section>
</body>
</html>`);
}

function deniedPage(reason) {
  return htmlResponse(`<!doctype html><html lang="es"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Acceso denegado</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#070b12;color:#e7eefc;font-family:Inter,system-ui,Arial}.card{width:min(520px,92vw);border:1px solid #243247;border-radius:24px;padding:28px;background:#101827}p{color:#8fa0bb;line-height:1.6}a{color:#31d0aa}</style></head><body><section class="card"><h1>Acceso denegado</h1><p>No se ha encontrado una membresía Patreon activa en los niveles permitidos.</p><p>Motivo técnico: <code>${escapeHtml(reason)}</code></p><p><a href="/auth/login">Intentar de nuevo</a></p></section></body></html>`, 403);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
