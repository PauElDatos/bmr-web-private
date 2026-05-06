const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export function parseCookies(cookieHeader = '') {
  const out = {};
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key) out[key] = decodeURIComponent(value);
  }
  return out;
}

export function buildCookie(name, value, options = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  if (options.maxAge !== undefined) parts.push(`Max-Age=${Math.floor(options.maxAge)}`);
  if (options.path) parts.push(`Path=${options.path}`);
  if (options.domain) parts.push(`Domain=${options.domain}`);
  if (options.httpOnly !== false) parts.push('HttpOnly');
  if (options.secure !== false) parts.push('Secure');
  parts.push(`SameSite=${options.sameSite || 'Lax'}`);
  return parts.join('; ');
}

export function deleteCookie(name) {
  return buildCookie(name, '', { maxAge: 0, path: '/', sameSite: 'Lax' });
}

export function randomBase64Url(bytes = 32) {
  const array = new Uint8Array(bytes);
  crypto.getRandomValues(array);
  return base64UrlEncode(array);
}

export function base64UrlEncode(input) {
  const bytes = input instanceof Uint8Array ? input : textEncoder.encode(String(input));
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function base64UrlDecode(input) {
  const normalized = String(input).replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function hmacKey(secret) {
  return crypto.subtle.importKey(
    'raw',
    textEncoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

export async function signPayload(payload, secret) {
  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'BMR' }));
  const body = base64UrlEncode(JSON.stringify(payload));
  const data = `${header}.${body}`;
  const key = await hmacKey(secret);
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', key, textEncoder.encode(data)));
  return `${data}.${base64UrlEncode(signature)}`;
}

export async function verifyPayload(token, secret) {
  if (!token || !secret) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, body, signature] = parts;
  const data = `${header}.${body}`;
  const key = await hmacKey(secret);
  const sigBytes = base64UrlDecode(signature);
  const ok = await crypto.subtle.verify('HMAC', key, sigBytes, textEncoder.encode(data));
  if (!ok) return null;
  const json = textDecoder.decode(base64UrlDecode(body));
  const payload = JSON.parse(json);
  if (payload.exp && Date.now() / 1000 > payload.exp) return null;
  return payload;
}

export function jsonResponse(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...headers
    }
  });
}

export function htmlResponse(html, status = 200, headers = {}) {
  return new Response(html, {
    status,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      ...headers
    }
  });
}
