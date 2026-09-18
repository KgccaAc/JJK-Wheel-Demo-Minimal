import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer, request as httpRequest } from 'node:http';
import { extname, join, normalize } from 'node:path';

const host = process.env.PREVIEW_WEB_HOST || '127.0.0.1';
const port = Number.parseInt(process.env.PREVIEW_WEB_PORT || '8088', 10);
const root = process.env.PREVIEW_WEB_ROOT || join(process.cwd(), 'web-preview');
const roomPort = Number.parseInt(process.env.PREVIEW_ROOM_PORT || '8789', 10);
const workerPort = Number.parseInt(process.env.LOCAL_WORKER_PORT || '8787', 10);
const types = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.wasm':'application/wasm', '.pck':'application/octet-stream', '.png':'image/png', '.json':'application/json' };

const server = createServer(async (req, res) => {
  const pathname = decodeURIComponent(new URL(req.url || '/', `http://${host}`).pathname);
  if (pathname === '/preview-room-api' || pathname.startsWith('/preview-room-api/')) {
    const upstreamPath = pathname.replace(/^\/preview-room-api/, '') || '/';
    const upstream = httpRequest({ host: '127.0.0.1', port: roomPort, method: req.method, path: upstreamPath, headers: { ...req.headers, host: `127.0.0.1:${roomPort}` } }, (upstreamResponse) => {
      res.writeHead(upstreamResponse.statusCode || 502, upstreamResponse.headers);
      upstreamResponse.pipe(res);
    });
    upstream.once('error', () => { if (!res.headersSent) { res.writeHead(502, { 'content-type':'application/json' }); res.end(JSON.stringify({ ok:false, error:{ code:'LOCAL_ROOM_UNAVAILABLE' } })); } });
    req.pipe(upstream);
    return;
  }
  if (pathname === '/local-worker-api' || pathname.startsWith('/local-worker-api/')) {
    const upstreamPath = pathname.replace(/^\/local-worker-api/, '') || '/';
    const upstream = httpRequest({ host: '127.0.0.1', port: workerPort, method: req.method, path: upstreamPath, headers: { ...req.headers, host: `127.0.0.1:${workerPort}` } }, (upstreamResponse) => {
      res.writeHead(upstreamResponse.statusCode || 502, upstreamResponse.headers);
      upstreamResponse.pipe(res);
    });
    upstream.once('error', () => { if (!res.headersSent) { res.writeHead(502, { 'content-type':'application/json' }); res.end(JSON.stringify({ ok:false, error:'LOCAL_WORKER_UNAVAILABLE' })); } });
    req.pipe(upstream);
    return;
  }
  const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const target = normalize(join(root, relative));
  if (!target.startsWith(normalize(root))) { res.writeHead(403); res.end(); return; }
  try {
    if (!(await stat(target)).isFile()) throw new Error('not_file');
    res.writeHead(200, { 'content-type':types[extname(target)] || 'application/octet-stream', 'cache-control':'no-store' });
    createReadStream(target).pipe(res);
  } catch { res.writeHead(404, { 'content-type':'text/plain; charset=utf-8' }); res.end('Not found'); }
});
server.listen(port, host, () => console.log(`[preview-web] http://${host}:${port}/`));

