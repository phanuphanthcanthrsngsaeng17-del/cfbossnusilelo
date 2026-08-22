// Cloudflare Pages proxy for the Boss API.
// Keeps the frontend on the Cloudflare domain while the existing Node/Vercel
// runtime remains the execution backend until it is migrated safely.

const DEFAULT_BACKEND = 'https://cfbossnusilelo.vercel.app';

export async function onRequest(context) {
  const { request, env } = context;
  const backend = String(env.BOSS_BACKEND_URL || DEFAULT_BACKEND).replace(/\/$/, '');
  const incoming = new URL(request.url);
  const target = new URL(backend + incoming.pathname + incoming.search);

  const headers = new Headers(request.headers);
  headers.delete('host');
  headers.delete('content-length');

  const init = {
    method: request.method,
    headers,
    redirect: 'manual'
  };

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    init.body = request.body;
  }

  try {
    const upstream = await fetch(target, init);
    const responseHeaders = new Headers(upstream.headers);
    responseHeaders.set('Cache-Control', 'no-store');
    responseHeaders.set('X-Boss-Edge', 'cloudflare-proxy');
    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders
    });
  } catch (error) {
    return Response.json({
      ok: false,
      error: 'Boss backend unreachable',
      code: 'BACKEND_UNREACHABLE'
    }, { status: 502, headers: { 'Cache-Control': 'no-store' } });
  }
}
