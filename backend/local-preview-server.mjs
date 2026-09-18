import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer, request as httpRequest } from 'node:http';
import { resolve, extname, join, normalize } from 'node:path';

const HOST = process.env.LOCAL_PREVIEW_HOST || '127.0.0.1';
const PORT = Number.parseInt(process.env.LOCAL_PREVIEW_PORT || '8089', 10);
const WEB_ROOT = resolve(process.env.LOCAL_PREVIEW_WEB_ROOT || join(process.cwd(), 'web-preview'));
const WORKER_PORT = Number.parseInt(process.env.LOCAL_WORKER_PORT || '8787', 10);
const ROOM_PORT = Number.parseInt(process.env.PREVIEW_ROOM_PORT || '8789', 10);
const MIME = { '.html':'text/html; charset=utf-8', '.js':'application/javascript; charset=utf-8', '.wasm':'application/wasm', '.pck':'application/octet-stream', '.png':'image/png' };

function proxyRoom(req, res, port, path) {
  const upstream = httpRequest({ host: '127.0.0.1', port, method: req.method, path, headers: req.headers }, (reply) => {
    res.writeHead(reply.statusCode || 502, { ...reply.headers, 'access-control-allow-origin': `http://${HOST}:${PORT}` });
    reply.pipe(res);
  });
  upstream.on('error', () => { res.writeHead(502, { 'content-type':'application/json' }); res.end(JSON.stringify({ ok:false, error:'local_worker_unavailable' })); });
  req.pipe(upstream);
}

const server = createServer(async (req, res) => {
  // Godot Web selects this same-origin prefix. Keep the unprefixed route for
  // the V3 battle context, whose transport is initialized from localhost.
  // Official mode in the local browser preview follows the same v2 contract
  // as production. The v1 worker remains available only through its explicit
  // /online-room route for manual Mock selection.
  if (req.url === '/preview-room-api' || req.url?.startsWith('/preview-room-api/')) {
    const upstreamPath = req.url.replace(/^\/preview-room-api/, '') || '/';
    return proxyRoom(req, res, ROOM_PORT, upstreamPath);
  }
  if (req.method === 'POST' && (req.url === '/online-room' || req.url === '/local-worker-api/online-room')) return proxyRoom(req, res, WORKER_PORT, '/online-room');
  if (req.method === 'GET' && req.url === '/health') { res.writeHead(200, { 'content-type':'application/json' }); res.end(JSON.stringify({ ok:true, service:'jjk-local-preview', worker:`127.0.0.1:${WORKER_PORT}` })); return; }
  const raw = decodeURIComponent((req.url || '/').split('?')[0]);
  const relative = raw === '/' ? 'index.html' : raw.replace(/^\/+/, '');
  const target = resolve(join(WEB_ROOT, normalize(relative)));
  if (!target.startsWith(WEB_ROOT)) { res.writeHead(403); res.end(); return; }
  try {
    const info = await stat(target);
    if (!info.isFile()) throw new Error('not_file');
    res.writeHead(200, { 'content-type': MIME[extname(target)] || 'application/octet-stream', 'cache-control':'no-store' });
    createReadStream(target).pipe(res);
  } catch { res.writeHead(404); res.end('not found'); }
});
server.listen(PORT, HOST, () => console.log(`[local-preview] http://${HOST}:${PORT}`));

