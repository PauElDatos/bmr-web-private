const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8'
};

export function contentTypeFor(pathname) {
  const lower = pathname.toLowerCase();
  const ext = Object.keys(CONTENT_TYPES).find((suffix) => lower.endsWith(suffix));
  return ext ? CONTENT_TYPES[ext] : 'application/octet-stream';
}

export async function getPrivateDataObject(env, key) {
  const bucket = env.BMR_DATA || env.PRIVATE_DATA_BUCKET;
  if (!bucket) return null;
  const normalized = key.replace(/^\/+/, '');
  const object = await bucket.get(normalized);
  if (!object) return null;
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  headers.set('content-type', headers.get('content-type') || contentTypeFor(normalized));
  headers.set('cache-control', 'private, max-age=60');
  return new Response(object.body, { headers });
}

export async function fetchFromStaticOrigin(env, request, pathname) {
  const origin = (env.STATIC_ORIGIN || '').replace(/\/$/, '');
  if (!origin) return new Response('STATIC_ORIGIN no configurado', { status: 500 });
  const targetPath = pathname === '/' ? '/index.html' : pathname;
  const target = `${origin}${targetPath}`;
  const originReq = new Request(target, request);
  return fetch(originReq);
}
