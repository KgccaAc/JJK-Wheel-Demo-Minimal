import { createServer } from 'node:http';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { dirname, join } from 'node:path';
import { canonicalForSide, createBattle, projectForSide, submitStage } from './battle-v3-resolver.mjs';
import { createError, createRequestContext, StructuredLogger } from './observability/logger.mjs';
import { CheckpointStore } from './persistence/checkpoint-store.mjs';
import { EventStore } from './persistence/event-store.mjs';
import { increment, snapshot as metricsSnapshot } from './observability/metrics.mjs';

const PROTOCOL_VERSION = 'online-battle-v3';
const HOST = process.env.LOCAL_WORKER_HOST || '127.0.0.1';
const PORT = Number.parseInt(process.env.LOCAL_WORKER_PORT || '8787', 10);
const DATA_DIR = process.env.LOCAL_WORKER_DATA_DIR || join(process.cwd(), 'backend', '.runtime');
const STATE_PATH = join(DATA_DIR, 'online-room-state.json');
const CHECKPOINT_PATH = process.env.LOCAL_WORKER_CHECKPOINT_PATH || join(DATA_DIR, 'checkpoint.json');
const EVENT_PATH = process.env.LOCAL_WORKER_EVENT_PATH || join(DATA_DIR, 'events.jsonl');
const SERVER_REGIONS = [
  { id: 'local', name: '本地实例', status: 'online' },
  { id: 'official-1', name: '官方服务器1', status: 'reserved' },
  { id: 'east', name: '华东预留节点', status: 'reserved' },
  { id: 'south', name: '华南预留节点', status: 'reserved' },
];
const OPERATIONS = new Set(['createRoom', 'joinRoom', 'getRoom', 'watchRoom', 'leaveRoom', 'deleteRoom', 'setRoomMode', 'setSpectatorPolicy', 'lockCharacter', 'queueMatch', 'cancelMatch', 'listServers', 'getPlayerScore', 'getBattleBootstrap', 'submitStageInput', 'resyncBattle']);
const logger = new StructuredLogger({ service: 'jjk-local-worker' });
const checkpointStore = new CheckpointStore(CHECKPOINT_PATH);
const eventStore = new EventStore(EVENT_PATH);

let state = { version: 1, rooms: {}, queue: {}, scores: {} };
let saveTail = Promise.resolve();
const requestResults = new Map();

function validState(candidate) {
  return candidate && typeof candidate === 'object'
    && candidate.version === 1
    && candidate.rooms && typeof candidate.rooms === 'object'
    && candidate.queue && typeof candidate.queue === 'object'
    && candidate.scores && typeof candidate.scores === 'object';
}

async function loadState() {
  await mkdir(dirname(STATE_PATH), { recursive: true });
  try {
    const candidate = JSON.parse(await readFile(STATE_PATH, 'utf8'));
    if (validState(candidate)) state = candidate;
  } catch (error) {
    if (error.code !== 'ENOENT') logger.warn(createError({ code: 'STATE_FILE_UNREADABLE', category: 'PERSISTENCE', severity: 'warning', message: 'ignored unreadable state file', userMessage: '本地房间状态无法读取，将使用空状态。', context: { operation: 'loadState' }, details: { cause: error.message } }));
  }
  if (Object.keys(state.rooms).length === 0) {
    try {
      const checkpoint = await checkpointStore.load();
      if (validState(checkpoint)) state = checkpoint;
    } catch (error) {
      logger.warn(createError({ code: 'CHECKPOINT_READ_FAILED', category: 'PERSISTENCE', severity: 'warning', message: 'checkpoint restore failed', userMessage: '检查点恢复失败，将使用当前状态。', context: { operation: 'loadState' }, details: { cause: error.message } }));
    }
  }
}

function saveState() {
  saveTail = saveTail.then(async () => {
    const tempPath = `${STATE_PATH}.tmp`;
    await writeFile(tempPath, JSON.stringify(state, null, 2), 'utf8');
    await rename(tempPath, STATE_PATH);
    await checkpointStore.save(state);
  });
  return saveTail;
}

function playerId(payload) {
  const id = String(payload.player_id || 'local-player').trim();
  return id || 'local-player';
}

function roomId(payload) {
	return String(payload.room_id || '').trim();
}

function characterSnapshot(payload) {
	const snapshot = payload.character_snapshot;
	if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return null;
	return structuredClone(snapshot);
}

function response(packet, body, status = 200) {
  return {
    status,
    body: {
      protocol_version: PROTOCOL_VERSION,
      request_id: String(packet.request_id || ''),
      accepted_operation: String(packet.operation || ''),
      ...body,
    },
  };
}

function failure(packet, error, status = 400, detail = '') {
  const code = String(error || 'INTERNAL_ERROR').toUpperCase();
  const record = createError({ code, category: code.includes('BATTLE') || code.includes('REVISION') ? 'BATTLE' : 'WORKER', message: detail || String(error), userMessage: detail || String(error), context: { requestId: packet?.request_id, traceId: packet?.trace_id, operation: packet?.operation }, details: { status } });
  logger.error(record);
  return response(packet, { ok: false, error, error_record: record, ...(detail ? { detail } : {}) }, status);
}

function getRoom(payload) {
  const id = roomId(payload);
  return id ? state.rooms[id] : null;
}

function snapshotRoom(room) {
  return structuredClone(room);
}

function battleFor(room) {
  if (!room.battle || room.battle.rulesetVersion !== 'battle-rules-v3') {
    if (room.players.length !== 2 || room.players.some((entry) => !entry.character_snapshot)) return null;
    room.battle = createBattle(room.players[0].character_snapshot, room.players[1].character_snapshot, room.room_id);
  }
  return room.battle;
}

function sideFor(room, id) { return room.players.findIndex((entry) => entry.player_id === id); }
function visibleResponse(packet, battle, side, extra = {}) {
  return response(packet, { ok: true, battle_revision: battle.revision, visible_state: canonicalForSide(battle, side), projection: projectForSide(battle, side), ...extra });
}

async function v3BattleResponse(packet, room, id, payload) {
  const requestId = String(packet.request_id || '');
  if (requestId && requestResults.has(requestId)) return requestResults.get(requestId);
  if (!room.players.some((entry) => entry.player_id === id)) return failure(packet, 'player_not_in_room', 403);
  if (room.state !== 'battle_ready') return failure(packet, 'battle_not_ready', 409);
  const battle = battleFor(room);
  if (!battle) return failure(packet, 'battle_snapshot_missing', 409);
  const side = sideFor(room, id);
  if (packet.operation === 'getBattleBootstrap' || packet.operation === 'resyncBattle') return visibleResponse(packet, battle, side, { type: 'bootstrap' });
  const requestedRevision = Number(payload.battle_revision);
  if (!Number.isInteger(requestedRevision) || requestedRevision !== battle.revision) return failure(packet, 'stale_battle_revision', 409);
  const result = submitStage(battle, side, String(payload.stage || ''), payload.data);
  if (!result.ok) return failure(packet, String(result.error || 'invalid_stage_input'), 409);
  room.battle = result.state;
  await eventStore.append({ event: result.type, requestId: packet.request_id || '', traceId: packet.trace_id || '', roomId: room.room_id, battleId: room.battle.battleId || room.room_id, revision: room.battle.revision, stage: payload.stage });
  const output = visibleResponse(packet, room.battle, side, { type: result.type, next_stage: result.nextStage, peer_submission: result.type === 'submission_accepted' ? 'waiting' : 'complete' });
  if (requestId) { requestResults.set(requestId, output); if (requestResults.size > 2048) requestResults.delete(requestResults.keys().next().value); }
  return output;
}

function ensureScore(id) {
  if (!Number.isFinite(state.scores[id])) state.scores[id] = 1000;
  return state.scores[id];
}

async function handlePacket(packet) {
  if (!packet || typeof packet !== 'object') return failure({}, 'invalid_online_room_packet');
  increment('worker_requests_total', 1, { operation: String(packet.operation || 'unknown') });
  logger.info('request_received', { requestId: packet.request_id || '', traceId: packet.trace_id || packet.request_id || '', operation: packet.operation || '' });
  if (packet.protocol_version !== PROTOCOL_VERSION) return failure(packet, 'unsupported_protocol_version', 400, `expected ${PROTOCOL_VERSION}`);
  if (!OPERATIONS.has(packet.operation)) return failure(packet, 'unsupported_online_room_operation', 400);
  const payload = packet.payload && typeof packet.payload === 'object' && !Array.isArray(packet.payload) ? packet.payload : {};
  const id = playerId(payload);

  if (packet.operation === 'listServers') return response(packet, { ok: true, servers: SERVER_REGIONS });
  if (packet.operation === 'getPlayerScore') {
    const score = ensureScore(id);
    await saveState();
    return response(packet, { ok: true, player_id: id, score, data: { score } });
  }
  if (packet.operation === 'createRoom') {
    const id = `local-${randomUUID().slice(0, 8)}`;
	const room = {
		room_id: id,
		state: 'waiting_for_opponent',
      mode: String(payload.mode || '1v1'),
      region: String(payload.region || 'local'),
      spectator_allowed: payload.spectator_allowed !== false,
		players: [{ player_id: playerId(payload), character_id: String(payload.character_id || ''), character_snapshot: characterSnapshot(payload), locked: false }],
      spectators: [],
      created_at: new Date().toISOString(),
    };
    state.rooms[id] = room;
    ensureScore(playerId(payload));
    await saveState();
    return response(packet, { ok: true, room: snapshotRoom(room) });
  }
  if (packet.operation === 'queueMatch') {
    state.queue[id] = { player_id: id, region: String(payload.region || 'local'), character_id: String(payload.character_id || ''), status: 'queued', queued_at: new Date().toISOString() };
    ensureScore(id);
    await saveState();
    return response(packet, { ok: true, queue: structuredClone(state.queue[id]) });
  }
  if (packet.operation === 'cancelMatch') {
    delete state.queue[id];
    await saveState();
    return response(packet, { ok: true, queue: { player_id: id, status: 'cancelled' } });
  }

  const room = getRoom(payload);
  if (!room) return failure(packet, 'room_not_found', 404);
  if (['getBattleBootstrap', 'submitStageInput', 'resyncBattle'].includes(packet.operation)) {
    const result = await v3BattleResponse(packet, room, id, payload);
    await saveState();
    return result;
  }
	if (packet.operation === 'getRoom') return response(packet, { ok: true, room: snapshotRoom(room) });
	if (packet.operation === 'joinRoom') {
    if (room.players.some((entry) => entry.player_id === id)) return response(packet, { ok: true, room: snapshotRoom(room) });
    if (room.players.length >= 2) return failure(packet, 'room_is_full', 409);
		room.players.push({ player_id: id, character_id: String(payload.character_id || ''), character_snapshot: characterSnapshot(payload), locked: false });
		room.state = 'waiting_for_locks';
    ensureScore(id);
    await saveState();
    return response(packet, { ok: true, room: snapshotRoom(room) });
  }
  if (packet.operation === 'watchRoom') {
    if (!room.spectator_allowed) return failure(packet, 'spectator_not_allowed', 403);
    if (!room.spectators.includes(id)) room.spectators.push(id);
    await saveState();
    return response(packet, { ok: true, room: snapshotRoom(room) });
  }
  if (packet.operation === 'leaveRoom') {
    room.players = room.players.filter((entry) => entry.player_id !== id);
    room.spectators = room.spectators.filter((entry) => entry !== id);
    if (room.players.length === 0) delete state.rooms[room.room_id];
    await saveState();
    return response(packet, { ok: true, room_id: room.room_id, left: true });
  }
  if (packet.operation === 'deleteRoom') {
    delete state.rooms[room.room_id];
    await saveState();
    return response(packet, { ok: true, room_id: room.room_id, deleted: true });
  }
  if (packet.operation === 'setRoomMode') room.mode = String(payload.mode || room.mode);
  if (packet.operation === 'setSpectatorPolicy') room.spectator_allowed = payload.allowed !== false;
	if (packet.operation === 'lockCharacter') {
    const entry = room.players.find((player) => player.player_id === id);
    if (!entry) return failure(packet, 'player_not_in_room', 403);
		entry.locked = payload.locked !== false;
		if (payload.character_id !== undefined) entry.character_id = String(payload.character_id);
		if (payload.character_snapshot !== undefined) entry.character_snapshot = characterSnapshot(payload);
		room.state = room.players.length == 2 && room.players.every((player) => player.locked) ? 'battle_ready' : (room.players.length < 2 ? 'waiting_for_opponent' : 'waiting_for_locks');
  }
  await saveState();
  return response(packet, { ok: true, room: snapshotRoom(room) });
}

function sendJson(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
}

async function readJson(req) {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 1_000_000) throw new Error('request_too_large');
  }
  return JSON.parse(raw || '{}');
}

await loadState();
const server = createServer(async (req, res) => {
  try {
    if (req.method === 'GET' && req.url === '/health') {
      sendJson(res, 200, { ok: true, service: 'jjk-local-worker', protocol_version: PROTOCOL_VERSION, persistent_state: STATE_PATH, checkpoint_path: CHECKPOINT_PATH, event_log_path: EVENT_PATH, capabilities: ['getBattleBootstrap', 'submitStageInput', 'resyncBattle', 'checkpoint_restore', 'event_store'] });
      return;
    }
    if (req.method === 'GET' && req.url === '/metrics') {
      sendJson(res, 200, { ok: true, service: 'jjk-local-worker', metrics: metricsSnapshot() });
      return;
    }
    if (req.method === 'POST' && req.url === '/online-room') {
      const startedAt = Date.now();
      const packet = await readJson(req);
      const result = await handlePacket(packet);
      logger.info({ event: 'request_completed', requestId: packet.request_id || '', traceId: packet.trace_id || '', operation: packet.operation || '', durationMs: Date.now() - startedAt, status: result.status });
      sendJson(res, result.status, result.body);
      return;
    }
    sendJson(res, 404, { ok: false, error: 'route_not_found' });
  } catch (error) {
    const status = error.message === 'request_too_large' ? 413 : 400;
    logger.error(createError({ code: error.message === 'request_too_large' ? 'REQUEST_TOO_LARGE' : 'INVALID_REQUEST', category: 'INPUT', message: error.message, userMessage: '请求格式无效。', context: createRequestContext({ requestId: req.headers['x-request-id'], traceId: req.headers['x-trace-id'] }), details: { route: req.url }, cause: error }));
    increment('worker_request_errors_total', 1, { route: String(req.url || '') });
    sendJson(res, status, { ok: false, error: error.message === 'request_too_large' ? 'request_too_large' : 'invalid_json_packet' });
  }
});

server.listen(PORT, HOST, () => console.log(`[local-worker] listening on http://${HOST}:${PORT}`));
server.on('error', (error) => {
  logger.error(createError({ code: 'WORKER_START_FAILED', category: 'WORKER', severity: 'fatal', message: error.message, userMessage: '联机服务启动失败。', context: { operation: 'listen' }, details: { systemCode: error.code }, cause: error }));
  process.exitCode = 1;
});

