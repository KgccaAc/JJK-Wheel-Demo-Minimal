import { createHash, randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const HOST = process.env.PREVIEW_LOGIN_CARD_HOST || '127.0.0.1';
const PORT = Number.parseInt(process.env.PREVIEW_LOGIN_CARD_PORT || '8788', 10);
const DATA_DIR = process.env.PREVIEW_LOGIN_CARD_DATA_DIR || join(process.cwd(), 'backend', '.preview-login-card-data');
const CARD_DIR = join(DATA_DIR, 'cards');
const SCHEMA = 'jjk-preview-login-card-v1';

// Origin allow-list. This service exposes a writable (PUT) card endpoint, so a
// wildcard `access-control-allow-origin: *` would let any page on the web read
// and overwrite cards. Default to loopback only, matching the pattern already
// used by preview-room-server.mjs.
const ALLOWED_ORIGINS = new Set(
  (process.env.PREVIEW_LOGIN_CARD_ALLOWED_ORIGIN || 'http://127.0.0.1:8088,http://localhost:8088')
    .split(',').map((entry) => entry.trim()).filter(Boolean),
);

function corsHeaders(req) {
  const origin = text(req?.headers?.origin, '');
  if (!origin) return {};                       // non-browser client (Godot, curl, tests)
  return ALLOWED_ORIGINS.has(origin)
    ? { 'access-control-allow-origin': origin, vary: 'Origin' }
    : {};
}

function originAllowed(req) {
  const origin = text(req?.headers?.origin, '');
  return !origin || ALLOWED_ORIGINS.has(origin);
}

const text = (value, fallback = '', max = 180) => String(value ?? fallback).trim().slice(0, max);
const clone = (value) => structuredClone(value);
const snapshotHash = (value) => `sha256:${createHash('sha256').update(JSON.stringify(value)).digest('hex')}`;

function cardPath(cardId) { return join(CARD_DIR, `${text(cardId).replace(/[^a-zA-Z0-9_.-]/g, '_')}.json`); }

function normalizeCharacter(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const canonical = raw.canonicalV3 && typeof raw.canonicalV3 === 'object' ? clone(raw.canonicalV3) : clone(raw.card || raw.character || raw);
  const characterId = text(raw.characterId || raw.id || canonical.characterId || canonical.id);
  if (!characterId) return null;
  return {
    characterId,
    displayName: text(raw.displayName || raw.name || canonical.displayName || canonical.name, '未命名角色', 100),
    characterRevision: Math.max(1, Number(raw.characterRevision || raw.revision || 1)),
    snapshotHash: /^sha256:[a-f0-9]{64}$/i.test(text(raw.snapshotHash)) ? text(raw.snapshotHash).toLowerCase() : snapshotHash(canonical),
    canonicalV3: canonical,
  };
}

function normalizeCard(input, existing = null) {
  const cardId = text(input.cardId || input.id || existing?.cardId);
  if (!cardId) return null;
  const characters = (Array.isArray(input.characters) ? input.characters : input.characterCardTable || existing?.characters || [])
    .map(normalizeCharacter).filter(Boolean);
  return {
    schema: SCHEMA,
    cardId,
    ownerId: text(input.ownerId || existing?.ownerId || cardId),
    nickname: text(input.nickname || input.ownerNickname || existing?.nickname, '未命名', 80),
    cardVersion: Math.max(1, Number(input.cardVersion || existing?.cardVersion || 3)),
    revision: Math.max(1, Number(existing?.revision || input.revision || 1)),
    characters,
    updatedAt: new Date().toISOString(),
  };
}

async function readCard(cardId) {
  try { return JSON.parse(await readFile(cardPath(cardId), 'utf8')); } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

async function writeCard(card) {
  await mkdir(CARD_DIR, { recursive: true });
  const target = cardPath(card.cardId);
  const temp = `${target}.${randomUUID()}.tmp`;
  await writeFile(temp, `${JSON.stringify(card, null, 2)}\n`, 'utf8');
  await rename(temp, target);
}

function send(req, res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...corsHeaders(req) });
  res.end(JSON.stringify(body));
}

async function body(req) {
  let raw = '';
  for await (const chunk of req) { raw += chunk; if (raw.length > 8 * 1024 * 1024) throw new Error('request_too_large'); }
  return JSON.parse(raw || '{}');
}

await mkdir(dirname(CARD_DIR), { recursive: true });
const server = createServer(async (req, res) => {
  try {
    if (!originAllowed(req)) { send(req, res, 403, { ok: false, error: 'origin_not_allowed' }); return; }
    if (req.method === 'OPTIONS') { res.writeHead(204, { 'access-control-allow-methods': 'GET,PUT,OPTIONS', 'access-control-allow-headers': 'Content-Type', ...corsHeaders(req) }); res.end(); return; }
    if (req.method === 'GET' && req.url === '/health') { send(req, res, 200, { ok: true, service: 'jjk-preview-login-card', schema: SCHEMA }); return; }
    const match = req.url?.match(/^\/api\/login-cards\/([^/]+)$/);
    if (!match) { send(req, res, 404, { ok: false, error: 'route_not_found' }); return; }
    const cardId = decodeURIComponent(match[1]);
    if (req.method === 'GET') {
      const card = await readCard(cardId);
      if (!card) { send(req, res, 404, { ok: false, error: 'card_not_found', cardId }); return; }
      send(req, res, 200, { ok: true, card: clone(card) }); return;
    }
    if (req.method === 'PUT') {
      const incoming = await body(req);
      const existing = await readCard(cardId);
      const expectedRevision = incoming.expectedRevision === undefined ? null : Number(incoming.expectedRevision);
      if (existing && expectedRevision !== null && expectedRevision !== Number(existing.revision)) {
        send(req, res, 409, { ok: false, error: 'card_revision_conflict', cardId, revision: existing.revision, card: clone(existing) }); return;
      }
      const card = normalizeCard({ ...incoming, cardId }, existing);
      if (!card || card.characters.some((entry) => !entry.canonicalV3 || typeof entry.canonicalV3 !== 'object')) { send(req, res, 422, { ok: false, error: 'card_snapshot_invalid' }); return; }
      card.revision = existing ? Number(existing.revision) + 1 : 1;
      await writeCard(card);
      send(req, res, 200, { ok: true, card: clone(card) }); return;
    }
    send(req, res, 405, { ok: false, error: 'method_not_allowed' });
  } catch (error) { send(req, res, error.message === 'request_too_large' ? 413 : 400, { ok: false, error: error.message === 'request_too_large' ? error.message : 'invalid_request' }); }
});
server.listen(PORT, HOST, () => console.log(`[preview-login-card] listening on http://${HOST}:${PORT}`));

