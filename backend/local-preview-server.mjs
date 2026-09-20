import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer, request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { connect as tlsConnect } from 'node:tls';
import { resolve, extname, join, normalize, relative as pathRelative, isAbsolute, sep } from 'node:path';
import { createAiDialogueService } from './ai-dialogue-server.mjs';
import { createStoryContentService } from './story-content-server.mjs';
import { createStoryBattleService } from './story-battle-server.mjs';
import { createWheelContentService } from './wheel-content-server.mjs';

const HOST = process.env.LOCAL_PREVIEW_HOST || '127.0.0.1';
const PORT = Number.parseInt(process.env.LOCAL_PREVIEW_PORT || '8089', 10);
const WEB_ROOT = resolve(process.env.LOCAL_PREVIEW_WEB_ROOT || join(process.cwd(), 'web-preview'));
const EDITOR_ROOT = resolve(process.env.STORY_EDITOR_ROOT || join(process.cwd(), 'web-editor'));
const RUNTIME_ROOT = resolve(process.env.STORY_RUNTIME_ROOT || join(process.cwd(), 'web-runtime'));
const WORKER_PORT = Number.parseInt(process.env.LOCAL_WORKER_PORT || '8787', 10);
const ROOM_PORT = Number.parseInt(process.env.PREVIEW_ROOM_PORT || '8789', 10);
// Optional local-only API bridge. It forwards to the public preview API over
// HTTPS; it never connects to a server-internal port or persistence layer.
const REMOTE_ROOM_PREFIX = (process.env.LOCAL_PREVIEW_REMOTE_ROOM_PREFIX || '').replace(/\/$/, '');
const AI_DIALOGUE = createAiDialogueService();
const STORY_CONTENT = createStoryContentService();
const STORY_BATTLE = createStoryBattleService();
const WHEEL_CONTENT = createWheelContentService();
const MIME = { '.html':'text/html; charset=utf-8', '.js':'application/javascript; charset=utf-8', '.mjs':'application/javascript; charset=utf-8', '.json':'application/json; charset=utf-8', '.wasm':'application/wasm', '.pck':'application/octet-stream', '.png':'image/png', '.svg':'image/svg+xml', '.css':'text/css; charset=utf-8' };

async function readJsonBody(req) {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 256 * 1024) throw new Error('request_too_large');
  }
  return JSON.parse(raw || '{}');
}

function sendJson(res, status, body, extra = {}) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'access-control-allow-origin': `http://${HOST}:${PORT}`,
    ...extra,
  });
  res.end(JSON.stringify(body));
}

async function handleAiRoute(req, res) {
  const path = (req.url || '').split('?')[0];
  if (!(path === '/api/ai/status' || path.startsWith('/api/ai/dialogue/'))) return false;
  if (req.method === 'OPTIONS') {
    sendJson(res, 204, null, { 'access-control-allow-methods': 'GET,POST,OPTIONS', 'access-control-allow-headers': 'Content-Type' });
    return true;
  }
  try {
    const body = req.method === 'GET' ? {} : await readJsonBody(req);
    const result = await AI_DIALOGUE.handle({ method: req.method, path, body });
    sendJson(res, result.status, result.body);
  } catch (error) {
    sendJson(res, error?.message === 'request_too_large' ? 413 : 400, { ok: false, error: error?.message === 'request_too_large' ? error.message : 'invalid_request' });
  }
  return true;
}

async function handleStoryRoute(req, res) {
  const path = (req.url || '').split('?')[0];
  if (!(path.startsWith('/api/story/') || path.startsWith('/api/saves/'))) return false;
  if (req.method === 'OPTIONS') { sendJson(res, 204, null, { 'access-control-allow-methods': 'GET,POST,OPTIONS', 'access-control-allow-headers': 'Content-Type' }); return true; }
  try {
    const body = req.method === 'GET' ? {} : await readJsonBody(req);
    const result = await STORY_CONTENT.handle({ method: req.method, path, body });
    sendJson(res, result.status, result.body);
  } catch (error) { sendJson(res, 400, { ok: false, error: 'invalid_story_request', detail: error?.message }); }
  return true;
}

async function handleBattleRoute(req, res) {
  const path = (req.url || '').split('?')[0];
  if (!path.startsWith('/api/battles/')) return false;
  if (req.method === 'OPTIONS') { sendJson(res, 204, null, { 'access-control-allow-methods': 'GET,POST,OPTIONS', 'access-control-allow-headers': 'Content-Type' }); return true; }
  try {
    const body = req.method === 'GET' ? {} : await readJsonBody(req);
    const result = await STORY_BATTLE.handle({ method: req.method, path, body });
    sendJson(res, result.status, result.body);
  } catch (error) { sendJson(res, 400, { ok: false, error: 'invalid_battle_request', detail: error?.message }); }
  return true;
}

async function handleWheelRoute(req, res) {
  const path = (req.url || '').split('?')[0];
  if (path !== '/api/wheel/config') return false;
  try {
    const result = await WHEEL_CONTENT.handle({ method: req.method, path });
    sendJson(res, result.status, result.body);
  } catch { sendJson(res, 503, { ok: false, error: 'wheel_content_unavailable' }); }
  return true;
}

function proxyRoom(req, res, port, path) {
  const headers = { ...req.headers };
  // The deployed preview authority intentionally allowlists its own HTTPS
  // preview origin. The local proxy is only a test harness, so rewrite the
  // upstream Origin while restoring the local CORS origin on the response.
  if (port === 443) headers.origin = 'https://119.91.224.223';
  const upstream = httpRequest({ host: '127.0.0.1', port, method: req.method, path, headers }, (reply) => {
    res.writeHead(reply.statusCode || 502, { ...reply.headers, 'access-control-allow-origin': `http://${HOST}:${PORT}` });
    reply.pipe(res);
  });
  upstream.on('error', () => { res.writeHead(502, { 'content-type':'application/json' }); res.end(JSON.stringify({ ok:false, error:'local_worker_unavailable' })); });
  req.pipe(upstream);
}

function proxyRemoteRoom(req, res, path) {
  const headers = { ...req.headers, origin: 'https://119.91.224.223' };
  const upstream = httpsRequest({
    hostname: '119.91.224.223',
    port: 443,
    method: req.method,
    path: `${REMOTE_ROOM_PREFIX}${path}`,
    headers,
    rejectUnauthorized: false,
  }, (reply) => {
    res.writeHead(reply.statusCode || 502, {
      ...reply.headers,
      'access-control-allow-origin': `http://${HOST}:${PORT}`,
    });
    reply.pipe(res);
  });
  upstream.on('error', () => {
    res.writeHead(502, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: false, error: 'remote_preview_room_unavailable' }));
  });
  req.pipe(upstream);
}

function proxyRoomSocket(request, clientSocket, head) {
  const localPrefix = '/preview-room-api';
  const upstreamPath = request.url?.startsWith(localPrefix)
    ? `${REMOTE_ROOM_PREFIX}${request.url.slice(localPrefix.length) || '/'}`
    : request.url || '/';
  const upstream = tlsConnect({ host: '119.91.224.223', port: 443, servername: '119.91.224.223', rejectUnauthorized: false }, () => {
    const headers = { ...request.headers, host: '119.91.224.223', origin: 'https://119.91.224.223' };
    const lines = [`${request.method || 'GET'} ${upstreamPath} HTTP/1.1`];
    for (const [key, value] of Object.entries(headers)) {
      if (value == null) continue;
      lines.push(`${key}: ${Array.isArray(value) ? value.join(', ') : value}`);
    }
    lines.push('', '');
    upstream.write(lines.join('\r\n'));
    if (head?.length) upstream.write(head);
    clientSocket.pipe(upstream);
    upstream.pipe(clientSocket);
  });
  upstream.on('error', () => clientSocket.destroy());
  clientSocket.on('error', () => upstream.destroy());
}

const server = createServer(async (req, res) => {
  if (await handleAiRoute(req, res)) return;
  if (await handleStoryRoute(req, res)) return;
  if (await handleBattleRoute(req, res)) return;
  if (await handleWheelRoute(req, res)) return;
  // Godot Web selects this same-origin prefix. Keep the unprefixed route for
  // the V3 battle context, whose transport is initialized from localhost.
  // Official mode in the local browser preview follows the same v2 contract
  // as production. The v1 worker remains available only through its explicit
  // /online-room route for manual Mock selection.
  if (req.url === '/preview-room-api' || req.url?.startsWith('/preview-room-api/')) {
    const upstreamPath = req.url.replace(/^\/preview-room-api/, '') || '/';
    if (REMOTE_ROOM_PREFIX) return proxyRemoteRoom(req, res, upstreamPath);
    return proxyRoom(req, res, ROOM_PORT, upstreamPath);
  }
  if (req.method === 'POST' && (req.url === '/online-room' || req.url === '/local-worker-api/online-room')) return proxyRoom(req, res, WORKER_PORT, '/online-room');
  if (req.method === 'GET' && req.url === '/health') { res.writeHead(200, { 'content-type':'application/json' }); res.end(JSON.stringify({ ok:true, service:'jjk-local-preview', worker:`127.0.0.1:${WORKER_PORT}` })); return; }
  const raw = decodeURIComponent((req.url || '/').split('?')[0]);
  if (req.method === 'GET' && raw === '/story-editor') { res.writeHead(302, { location: '/story-editor/' }); res.end(); return; }
  let root = WEB_ROOT;
  let relative = raw === '/' ? 'index.html' : raw.replace(/^\/+/, '');
  if (raw === '/story-editor' || raw.startsWith('/story-editor/')) { root = EDITOR_ROOT; relative = raw.replace(/^\/story-editor\/?/, '') || 'index.html'; }
  else if (raw === '/web-runtime' || raw.startsWith('/web-runtime/')) { root = RUNTIME_ROOT; relative = raw.replace(/^\/web-runtime\/?/, ''); }
  const target = resolve(join(root, normalize(relative)));
  const targetRelative = pathRelative(root, target);
  if (targetRelative === '..' || targetRelative.startsWith(`..${sep}`) || isAbsolute(targetRelative)) { res.writeHead(403); res.end(); return; }
  try {
    const info = await stat(target);
    if (!info.isFile()) throw new Error('not_file');
    res.writeHead(200, { 'content-type': MIME[extname(target)] || 'application/octet-stream', 'cache-control':'no-store' });
    createReadStream(target).pipe(res);
  } catch { res.writeHead(404); res.end('not found'); }
});
server.on('upgrade', (request, socket, head) => {
  if (REMOTE_ROOM_PREFIX && request.url?.startsWith('/preview-room-api/api/rooms/socket')) return proxyRoomSocket(request, socket, head);
  socket.write('HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n');
  socket.destroy();
});
server.listen(PORT, HOST, () => console.log(`[local-preview] http://${HOST}:${PORT}`));

