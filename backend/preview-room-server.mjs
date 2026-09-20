import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { canonicalForSide, createBattle, projectForSide, submitStage } from './battle-v3-resolver.mjs';
import { increment, snapshot } from './observability/metrics.mjs';
import { StructuredLogger } from './observability/logger.mjs';
import { createRequestContext, finishRequestContext } from './observability/request-context.mjs';
import { ERROR_CODES } from './observability/error-codes.mjs';
import { createRoomSocketHub } from './online-room-socket.mjs';

const PROTOCOL_VERSION = 'online-battle-v3';
const HOST = process.env.PREVIEW_ROOM_HOST || '127.0.0.1';
const PORT = Number.parseInt(process.env.PREVIEW_ROOM_PORT || '8789', 10);
const DATA_DIR = process.env.PREVIEW_ROOM_DATA_DIR || join(process.cwd(), 'backend', '.preview-room-data');
const DATABASE_PATH = join(DATA_DIR, 'room.sqlite');
const ALLOWED_ORIGIN = process.env.PREVIEW_ROOM_ALLOWED_ORIGIN || 'https://119.91.224.223';
const ALLOWED_ORIGINS = new Set([
  ...ALLOWED_ORIGIN.split(',').map((entry) => entry.trim()).filter(Boolean),
  'http://127.0.0.1:8088',
  'http://localhost:8088',
  'http://127.0.0.1:8090',
  'http://localhost:8090',
]);
const ENABLED_MODES = new Set(['ranked_1v1', 'private_1v1']);
const OPERATIONS = new Set(['create_room', 'join_room', 'leave_room', 'delete_room', 'set_spectator_policy', 'lock_character', 'get_room', 'get_battle_bootstrap', 'submit_stage_input', 'resync_battle', 'get_player_score', 'queue_match', 'cancel_match']);
const logger = new StructuredLogger({ service: 'jjk-preview-room' });

let db;
const text = (value, fallback = '', max = 160) => String(value ?? fallback).trim().slice(0, max);
const clone = (value) => structuredClone(value);
const isObject = (value) => value && typeof value === 'object' && !Array.isArray(value);
const safeJson = (value, fallback = {}) => { try { return JSON.parse(value); } catch { return fallback; } };
const roomCode = () => `prv-${randomUUID().replaceAll('-', '').slice(0, 10)}`;
const error = (code, message, details = {}) => ({ ok: false, error: { code, message, category: ERROR_CODES[code] || 'UNKNOWN', details } });

function initializeDatabase() {
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS identities (identity_id TEXT PRIMARY KEY, card_id TEXT, guest INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, last_seen_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS rooms (room_id TEXT PRIMARY KEY, mode TEXT NOT NULL, state TEXT NOT NULL, revision INTEGER NOT NULL, host_identity_id TEXT NOT NULL, spectator_policy TEXT NOT NULL, created_at TEXT NOT NULL, closed_at TEXT, battle_json TEXT);
    CREATE TABLE IF NOT EXISTS room_members (room_id TEXT NOT NULL, identity_id TEXT NOT NULL, role TEXT NOT NULL, side INTEGER, locked INTEGER NOT NULL DEFAULT 0, character_id TEXT, snapshot_hash TEXT, character_revision INTEGER, canonical_v3_json TEXT, joined_at TEXT NOT NULL, PRIMARY KEY(room_id, identity_id));
    CREATE TABLE IF NOT EXISTS room_requests (identity_id TEXT NOT NULL, request_id TEXT NOT NULL, response_status INTEGER NOT NULL, response_json TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY(identity_id, request_id));
    CREATE TABLE IF NOT EXISTS ratings (identity_id TEXT PRIMARY KEY, rating INTEGER NOT NULL, games INTEGER NOT NULL DEFAULT 0, wins INTEGER NOT NULL DEFAULT 0, losses INTEGER NOT NULL DEFAULT 0);
  `);
  const columns = db.prepare('PRAGMA table_info(rooms)').all().map((entry) => entry.name);
  if (!columns.includes('battle_json')) db.exec('ALTER TABLE rooms ADD COLUMN battle_json TEXT');
}

function upsertIdentity(identity) {
  const now = new Date().toISOString();
  db.prepare(`INSERT INTO identities(identity_id, card_id, guest, created_at, last_seen_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(identity_id) DO UPDATE SET card_id=excluded.card_id, guest=excluded.guest, last_seen_at=excluded.last_seen_at`).run(identity.identityId, identity.cardId, identity.guest ? 1 : 0, now, now);
  db.prepare('INSERT INTO ratings(identity_id, rating) VALUES (?, 1000) ON CONFLICT(identity_id) DO NOTHING').run(identity.identityId);
}

function readRoom(roomId) { return db.prepare('SELECT * FROM rooms WHERE room_id=?').get(roomId); }
function roomMember(roomId, identityId) { return db.prepare('SELECT * FROM room_members WHERE room_id=? AND identity_id=?').get(roomId, identityId); }
function reviseRoom(roomId) { db.prepare('UPDATE rooms SET revision=revision+1 WHERE room_id=?').run(roomId); return readRoom(roomId); }

// A room receives an immutable character snapshot from its member.  Login-card
// parsing/sync happens in the client before this boundary; the room service must
// not query an unrelated character registry or silently replace custom data.
function selectedCharacter(payload) {
  const uploaded = isObject(payload.characterSnapshot) ? payload.characterSnapshot : null;
  if (!uploaded) return null;
  const profile = clone(isObject(uploaded.canonicalV3) ? uploaded.canonicalV3 : uploaded);
  const characterId = text(payload.characterId || uploaded.characterId || uploaded.id || profile.id, '', 120);
  if (!characterId) return null;
  if (!text(profile.id, '', 120)) profile.id = characterId;
  const snapshotHash = text(payload.snapshotHash || uploaded.snapshotHash || uploaded.snapshot_hash, '', 80);
  const revision = Number(uploaded.characterRevision || uploaded.character_revision || 1);
  return { characterId, snapshotHash, characterRevision: Number.isInteger(revision) && revision > 0 ? revision : 1, profile };
}

function writeSelectedCharacter(roomId, identityId, selection, locked) {
  db.prepare('UPDATE room_members SET locked=?, character_id=?, snapshot_hash=?, character_revision=?, canonical_v3_json=? WHERE room_id=? AND identity_id=?')
    .run(locked ? 1 : 0, selection.characterId, selection.snapshotHash, selection.characterRevision, JSON.stringify(selection.profile), roomId, identityId);
}

function refreshRoomReadiness(roomId) {
  const playerState = db.prepare("SELECT COUNT(*) AS total, SUM(CASE WHEN locked=1 THEN 1 ELSE 0 END) AS locked_count FROM room_members WHERE room_id=? AND role='player'").get(roomId);
  const ready = Number(playerState.total) === 2 && Number(playerState.locked_count) === 2;
  db.prepare('UPDATE rooms SET state=? WHERE room_id=?').run(ready ? 'READY' : 'LOBBY', roomId);
}

function publicRoom(roomId) {
  const room = readRoom(roomId); if (!room) return null;
  const members = db.prepare('SELECT identity_id, role, side, locked, character_id, snapshot_hash, character_revision, canonical_v3_json FROM room_members WHERE room_id=? ORDER BY joined_at').all(roomId).map((member) => ({ identityId: member.identity_id, role: member.role, side: member.side, locked: Boolean(member.locked), characterId: member.character_id || '', snapshotHash: member.snapshot_hash || '', characterRevision: member.character_revision || 0, characterSnapshot: safeJson(member.canonical_v3_json, {}) }));
  return { roomId: room.room_id, mode: room.mode, state: room.state, revision: room.revision, hostIdentityId: room.host_identity_id, spectatorPolicy: room.spectator_policy, createdAt: room.created_at, members };
}
function battleSnapshotRoom(roomId) {
  const room = readRoom(roomId); if (!room) return null;
  const members = db.prepare('SELECT identity_id, role, side, locked, character_id, snapshot_hash, character_revision, canonical_v3_json FROM room_members WHERE room_id=? ORDER BY joined_at').all(roomId).map((member) => ({ identityId: member.identity_id, role: member.role, side: member.side, locked: Boolean(member.locked), characterId: member.character_id || '', snapshotHash: member.snapshot_hash || '', characterRevision: member.character_revision || 0, canonicalV3: safeJson(member.canonical_v3_json, {}) }));
  return { roomId: room.room_id, mode: room.mode, state: room.state, revision: room.revision, hostIdentityId: room.host_identity_id, members };
}
const emptyBattle = () => ({ protocolVersion: 'input-room-v3', turn: 1, stage: '', phase: 'idle', commits: {}, revealAcks: {}, receipts: {}, revealedInputs: {} });
function readBattle(roomId) { const row = readRoom(roomId); return row?.battle_json ? safeJson(row.battle_json, emptyBattle()) : emptyBattle(); }
function writeBattle(roomId, battle) { db.prepare('UPDATE rooms SET battle_json=? WHERE room_id=?').run(JSON.stringify(battle), roomId); }
function validRoundInput(input) { return isObject(input) && text(input.ruleset_version) === 'battle-rules-v3' && text(input.strategy_id) && Array.isArray(input.discard_instance_ids) && Number.isInteger(input.initiative_commitment) && Array.isArray(input.card_instance_ids) && Array.isArray(input.domain_instance_ids); }
function sameJson(left, right) { return JSON.stringify(left) === JSON.stringify(right); }
function battleSync(packet, roomId, identity, operation, payload) {
  const members = battleSnapshotRoom(roomId).members; let battle = readBattle(roomId);
  if (!members.some((entry) => entry.identityId === identity.identityId)) return { status:403, body:responseError(packet, 'NOT_ROOM_PLAYER', 'only room players may synchronize inputs') };
  if (operation === 'get_battle') return { status:200, body:envelope(packet, { battle }) };
  const turn = Number(payload.turn); const stage = text(payload.stage);
  if (battle.phase === 'idle') { if (turn !== 1 || stage !== 'round_input') return { status:409, body:responseError(packet, 'TURN_DESCRIPTOR_CONFLICT', 'invalid initial turn') }; battle = { ...emptyBattle(), turn, stage, phase:'waiting_for_peer_commit' }; }
  else if (battle.turn !== turn || battle.stage !== stage) { if (battle.phase === 'resolved' && turn === battle.turn + 1 && stage === 'round_input') battle = { ...emptyBattle(), turn, stage, phase:'waiting_for_peer_commit' }; else return { status:409, body:responseError(packet, 'TURN_DESCRIPTOR_CONFLICT', 'turn does not match current battle') }; }
  if (operation === 'turn_commit') { if (!validRoundInput(payload.input)) return { status:422, body:responseError(packet, 'INVALID_ROUND_INPUT', 'round input is incomplete') }; if (!['waiting_for_peer_commit','awaiting_reveal_ack'].includes(battle.phase)) return { status:409, body:responseError(packet, 'TURN_COMMIT_CLOSED', 'commit is closed') }; if (Object.hasOwn(battle.commits, identity.identityId)) { if (sameJson(battle.commits[identity.identityId], payload.input)) return { status:200, body:envelope(packet, { battle }) }; return { status:409, body:responseError(packet, 'TURN_INPUT_CONFLICT', 'a different commit already exists') }; } battle.commits[identity.identityId] = clone(payload.input); if (members.every((entry) => Object.hasOwn(battle.commits, entry.identityId))) battle.phase = 'awaiting_reveal_ack'; }
  else if (operation === 'turn_reveal_ack') { if (battle.phase !== 'awaiting_reveal_ack') return { status:409, body:responseError(packet, 'REVEAL_NOT_READY', 'both commits are required') }; battle.revealAcks[identity.identityId] = true; if (members.every((entry) => battle.revealAcks[entry.identityId])) { battle.revealedInputs = clone(battle.commits); battle.phase = 'ready_to_resolve'; } }
  else if (operation === 'turn_resolve_receipt') { if (!['ready_to_resolve','waiting_for_peer_receipt'].includes(battle.phase)) return { status:409, body:responseError(packet, 'RECEIPT_NOT_READY', 'revealed inputs are required') }; const stateHash = text(payload.stateHash); if (!stateHash) return { status:400, body:responseError(packet, 'STATE_HASH_REQUIRED', 'state hash is required') }; battle.receipts[identity.identityId] = stateHash; battle.phase = members.every((entry) => Object.hasOwn(battle.receipts, entry.identityId)) ? (new Set(Object.values(battle.receipts)).size === 1 ? 'resolved' : 'receipt_mismatch') : 'waiting_for_peer_receipt'; }
  writeBattle(roomId, battle);
  return battle.phase === 'receipt_mismatch' ? { status:409, body:responseError(packet, 'DETERMINISTIC_STATE_MISMATCH', 'client receipts differ') } : { status:200, body:envelope(packet, { battle }) };
}

// The room database is the durable authority boundary. It stores the complete
// Worker checkpoint, but every HTTP response is filtered to the requester.
function authorityBattleSync(packet, roomId, identity, operation, payload) {
  const room = readRoom(roomId);
  const member = roomMember(roomId, identity.identityId);
  if (!room || !member || member.role !== 'player') return { status:403, body:responseError(packet, 'NOT_ROOM_PLAYER', 'only room players may synchronize battle state') };
  if (room.state !== 'READY') return { status:409, body:responseError(packet, 'BATTLE_NOT_READY', 'both players must lock before battle') };
  const snapshots = db.prepare("SELECT side, canonical_v3_json FROM room_members WHERE room_id=? AND role='player' ORDER BY side").all(roomId);
  if (snapshots.length !== 2 || snapshots.some((entry) => !isObject(safeJson(entry.canonical_v3_json, null)))) return { status:409, body:responseError(packet, 'BATTLE_SNAPSHOT_MISSING', 'locked character snapshot is unavailable') };
  let battle = room.battle_json ? safeJson(room.battle_json, null) : null;
  if (!battle || battle.rulesetVersion !== 'battle-rules-v3') {
    battle = createBattle(safeJson(snapshots[0].canonical_v3_json, {}), safeJson(snapshots[1].canonical_v3_json, {}), roomId);
    writeBattle(roomId, battle);
  }
  const side = Number(member.side);
  const visible = (extra = {}) => ({ status:200, body:envelope(packet, { battleRevision:battle.revision, visible_state:canonicalForSide(battle, side), projection:projectForSide(battle, side), ...extra }) });
  if (operation === 'get_battle_bootstrap' || operation === 'resync_battle') return visible({ type:'bootstrap' });
  const expected = Number(payload.battleRevision);
  if (!Number.isInteger(expected) || expected !== battle.revision) return { status:409, body:responseError(packet, 'STALE_BATTLE_REVISION', 'battle state has advanced', { expectedBattleRevision:battle.revision }) };
  const result = submitStage(battle, side, text(payload.stage, '', 30), isObject(payload.data) ? payload.data : {});
  if (!result.ok) {
    const code = String(result.error || 'INVALID_STAGE_INPUT') === 'INVALID_INPUT' ? 'INVALID_STAGE_INPUT' : String(result.error || 'INVALID_STAGE_INPUT');
    return { status:409, body:responseError(packet, code, 'stage input was rejected') };
  }
  battle = result.state;
  writeBattle(roomId, battle);
  return visible({ type:result.type, nextStage:result.nextStage, peerSubmission:result.type === 'submission_accepted' ? 'waiting' : 'complete' });
}

function validateIdentity(raw) {
  if (!isObject(raw)) return null;
  const identityId = text(raw.identityId, '', 100); const cardId = text(raw.cardId, '', 120); const guest = Boolean(raw.guest);
  return identityId && (guest || cardId) ? { identityId, cardId, guest } : null;
}
function allowedOrigin(req) { const origin = text(req.headers.origin, ''); return !origin || ALLOWED_ORIGINS.has(origin); }
function corsHeaders(req) { const origin = text(req.headers.origin, ''); return ALLOWED_ORIGINS.has(origin) ? { 'access-control-allow-origin': origin, vary: 'Origin' } : {}; }
function send(req, res, status, body) { res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...corsHeaders(req) }); res.end(JSON.stringify(body)); }
async function readJson(req) { let raw = ''; for await (const chunk of req) { raw += chunk; if (raw.length > 256 * 1024) throw new Error('request_too_large'); } return JSON.parse(raw || '{}'); }
const envelope = (packet, data) => ({ ok: true, protocolVersion: PROTOCOL_VERSION, requestId: packet.requestId, traceId: text(packet?.traceId || packet?.requestId), data });
const responseError = (packet, code, message, details = {}) => ({ protocolVersion: PROTOCOL_VERSION, requestId: text(packet?.requestId), traceId: text(packet?.traceId || packet?.requestId), ...error(code, message, details) });

async function handle(packet) {
  if (!isObject(packet) || packet.protocolVersion !== PROTOCOL_VERSION) return { status: 400, body: responseError(packet, 'UNSUPPORTED_PROTOCOL_VERSION', `expected ${PROTOCOL_VERSION}`) };
  const requestId = text(packet.requestId, '', 128); const identity = validateIdentity(packet.identity); const operation = text(packet.operation, '', 80); const payload = isObject(packet.payload) ? packet.payload : {};
  if (!requestId || !identity || !OPERATIONS.has(operation)) return { status: 400, body: responseError(packet, 'INVALID_REQUEST', 'requestId, identity and supported operation are required') };
  const duplicate = db.prepare('SELECT response_status, response_json FROM room_requests WHERE identity_id=? AND request_id=?').get(identity.identityId, requestId);
  if (duplicate) return { status: duplicate.response_status, body: safeJson(duplicate.response_json) };
  upsertIdentity(identity); let result;
  if (operation === 'create_room') {
    const mode = text(payload.mode, 'private_1v1', 40);
    if (!ENABLED_MODES.has(mode)) result = { status: 422, body: responseError(packet, 'MODE_NOT_ENABLED', 'the requested mode is not enabled', { mode }) };
    else { const roomId = roomCode(); const now = new Date().toISOString(); const policy = text(payload.spectatorPolicy, 'read_only', 30) === 'disabled' ? 'disabled' : 'read_only'; const selection = selectedCharacter(payload); db.prepare('INSERT INTO rooms(room_id,mode,state,revision,host_identity_id,spectator_policy,created_at,closed_at,battle_json) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL)').run(roomId, mode, 'LOBBY', 1, identity.identityId, policy, now); db.prepare('INSERT INTO room_members(room_id, identity_id, role, side, locked, character_id, snapshot_hash, character_revision, canonical_v3_json, joined_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(roomId, identity.identityId, 'player', 0, 0, selection?.characterId || '', selection?.snapshotHash || '', selection?.characterRevision || 0, selection ? JSON.stringify(selection.profile) : null, now); result = { status: 200, body: envelope(packet, { room: publicRoom(roomId) }) }; }
  } else if (operation === 'get_player_score') {
    const score = db.prepare('SELECT rating, games, wins, losses FROM ratings WHERE identity_id=?').get(identity.identityId); result = { status: 200, body: envelope(packet, { score: score.rating, rating: score }) };
  } else if (operation === 'queue_match') {
    const selection = selectedCharacter(payload);
    if (!selection) result = { status: 422, body: responseError(packet, 'CHARACTER_SNAPSHOT_MISSING', 'select a character before matchmaking') };
    else {
      const waiting = db.prepare("SELECT room_id FROM rooms WHERE mode='ranked_1v1' AND state='MATCHMAKING' AND host_identity_id<>? ORDER BY created_at LIMIT 1").get(identity.identityId);
      if (!waiting) {
        const roomId = roomCode(); const now = new Date().toISOString();
        db.prepare('INSERT INTO rooms(room_id,mode,state,revision,host_identity_id,spectator_policy,created_at,closed_at,battle_json) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL)').run(roomId, 'ranked_1v1', 'MATCHMAKING', 1, identity.identityId, 'disabled', now);
        db.prepare('INSERT INTO room_members(room_id, identity_id, role, side, locked, character_id, snapshot_hash, character_revision, canonical_v3_json, joined_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(roomId, identity.identityId, 'player', 0, 0, selection.characterId, selection.snapshotHash, selection.characterRevision, JSON.stringify(selection.profile), now);
        result = { status: 200, body: envelope(packet, { room: publicRoom(roomId), matched: false }) };
      } else {
        const roomId = waiting.room_id; const now = new Date().toISOString();
        db.prepare('INSERT INTO room_members(room_id, identity_id, role, side, locked, character_id, snapshot_hash, character_revision, canonical_v3_json, joined_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(roomId, identity.identityId, 'player', 1, 0, selection.characterId, selection.snapshotHash, selection.characterRevision, JSON.stringify(selection.profile), now);
        db.prepare('UPDATE rooms SET state=? WHERE room_id=?').run('LOBBY', roomId);
        reviseRoom(roomId);
        result = { status: 200, body: envelope(packet, { room: publicRoom(roomId), matched: true }) };
      }
    }
  } else if (operation === 'cancel_match') {
    const waiting = db.prepare("SELECT room_id FROM rooms WHERE mode='ranked_1v1' AND state='MATCHMAKING' AND host_identity_id=? ORDER BY created_at LIMIT 1").get(identity.identityId);
    if (!waiting) result = { status: 200, body: envelope(packet, { cancelled: false }) };
    else {
      db.prepare('UPDATE rooms SET state=?, closed_at=? WHERE room_id=?').run('CLOSED', new Date().toISOString(), waiting.room_id);
      reviseRoom(waiting.room_id);
      result = { status: 200, body: envelope(packet, { cancelled: true, room: publicRoom(waiting.room_id) }) };
    }
  } else {
    const roomId = text(payload.roomId, '', 80); const room = readRoom(roomId);
    if (!room) result = { status: 404, body: responseError(packet, 'ROOM_NOT_FOUND', 'room does not exist') };
    else if (operation === 'get_room') result = { status: 200, body: envelope(packet, { room: publicRoom(roomId) }) };
    else if (['get_battle_bootstrap','submit_stage_input','resync_battle'].includes(operation)) result = authorityBattleSync(packet, roomId, identity, operation, payload);
    // Character locks update only the caller's member row.  They do not
    // overwrite a shared field, so waiting for the polling interval merely to
    // refresh another player's room revision creates a false conflict.
    else if (!['join_room', 'lock_character'].includes(operation) && (!Number.isInteger(packet.expectedRoomRevision) || packet.expectedRoomRevision !== room.revision)) result = { status: 409, body: responseError(packet, 'ROOM_REVISION_CONFLICT', 'room revision is stale', { expectedRoomRevision: room.revision, received: packet.expectedRoomRevision }) };
    else if (operation === 'join_room') {
      const selection = selectedCharacter(payload); const existing = roomMember(roomId, identity.identityId);
      if (existing) { if (selection && !existing.locked) { writeSelectedCharacter(roomId, identity.identityId, selection, false); reviseRoom(roomId); } result = { status: 200, body: envelope(packet, { room: publicRoom(roomId) }) }; }
      else if (db.prepare("SELECT COUNT(*) AS count FROM room_members WHERE room_id=? AND role='player'").get(roomId).count >= 2) result = { status: 409, body: responseError(packet, 'ROOM_FULL', 'room already has two players') };
      else { db.prepare('INSERT INTO room_members(room_id, identity_id, role, side, locked, character_id, snapshot_hash, character_revision, canonical_v3_json, joined_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(roomId, identity.identityId, 'player', 1, 0, selection?.characterId || '', selection?.snapshotHash || '', selection?.characterRevision || 0, selection ? JSON.stringify(selection.profile) : null, new Date().toISOString()); reviseRoom(roomId); result = { status: 200, body: envelope(packet, { room: publicRoom(roomId) }) }; }
    } else if (operation === 'leave_room') {
      if (!roomMember(roomId, identity.identityId)) result = { status: 403, body: responseError(packet, 'NOT_ROOM_MEMBER', 'identity is not a room member') };
      else { db.prepare('DELETE FROM room_members WHERE room_id=? AND identity_id=?').run(roomId, identity.identityId); const remaining = db.prepare('SELECT COUNT(*) AS count FROM room_members WHERE room_id=?').get(roomId).count; if (remaining === 0) db.prepare('UPDATE rooms SET state=?, closed_at=? WHERE room_id=?').run('CLOSED', new Date().toISOString(), roomId); else reviseRoom(roomId); result = { status: 200, body: envelope(packet, { room: publicRoom(roomId) }) }; }
    } else if (operation === 'delete_room') {
      if (room.host_identity_id !== identity.identityId) result = { status: 403, body: responseError(packet, 'HOST_REQUIRED', 'only host can delete a room') };
      else { db.prepare('UPDATE rooms SET state=?, closed_at=? WHERE room_id=?').run('CLOSED', new Date().toISOString(), roomId); reviseRoom(roomId); result = { status: 200, body: envelope(packet, { room: publicRoom(roomId) }) }; }
    } else if (operation === 'set_spectator_policy') {
      if (room.host_identity_id !== identity.identityId) result = { status: 403, body: responseError(packet, 'HOST_REQUIRED', 'only host can change spectator policy') };
      else { const policy = text(payload.spectatorPolicy, 'read_only', 30) === 'disabled' ? 'disabled' : 'read_only'; db.prepare('UPDATE rooms SET spectator_policy=? WHERE room_id=?').run(policy, roomId); reviseRoom(roomId); result = { status: 200, body: envelope(packet, { room: publicRoom(roomId) }) }; }
    } else if (operation === 'lock_character') {
      const member = roomMember(roomId, identity.identityId); const selection = selectedCharacter(payload); const nextLocked = payload.locked !== false;
      if (!member || member.role !== 'player') result = { status: 403, body: responseError(packet, 'NOT_ROOM_PLAYER', 'only room players can lock a character') };
      else {
        const stored = safeJson(member.canonical_v3_json, {});
        if (selection) writeSelectedCharacter(roomId, identity.identityId, selection, nextLocked);
        else if (!stored || !text(member.character_id, '', 120)) result = { status: 422, body: responseError(packet, 'CHARACTER_SNAPSHOT_MISSING', 'select a character before locking') };
        else db.prepare('UPDATE room_members SET locked=? WHERE room_id=? AND identity_id=?').run(nextLocked ? 1 : 0, roomId, identity.identityId);
        if (!result) { refreshRoomReadiness(roomId); reviseRoom(roomId); result = { status: 200, body: envelope(packet, { room: publicRoom(roomId) }) }; }
      }
    }
  }
  db.prepare('INSERT INTO room_requests(identity_id, request_id, response_status, response_json, created_at) VALUES (?, ?, ?, ?, ?)').run(identity.identityId, requestId, result.status, JSON.stringify(result.body), new Date().toISOString());
  return result;
}

await mkdir(DATA_DIR, { recursive: true }); db = new DatabaseSync(DATABASE_PATH); initializeDatabase();
const socketHub = createRoomSocketHub({
  authorize: (roomId, identity) => {
    const room = readRoom(roomId); const member = roomMember(roomId, identity.identityId);
    if (!room || !member || member.role !== 'player') return { ok: false, code: 'NOT_ROOM_PLAYER', message: 'only room players may subscribe' };
    const battle = room.battle_json ? safeJson(room.battle_json, null) : null;
    return { ok: true, roomRevision: room.revision, battleRevision: Number(battle?.revision || 0) };
  },
  roomSnapshot: (roomId) => publicRoom(roomId),
  battleSnapshot: (roomId, identityId) => {
    const room = readRoom(roomId); const member = roomMember(roomId, identityId); if (!room || !member || !room.battle_json) return null;
    const battle = safeJson(room.battle_json, null); if (!battle) return null;
    return { battleRevision: battle.revision, visible_state: canonicalForSide(battle, Number(member.side)), projection: projectForSide(battle, Number(member.side)) };
  },
  metrics: (name, value = 1, labels = {}) => increment(name, value, labels),
  logger,
});

function battleSocketEvent(roomId, identityId, packet, response) {
  const room = readRoom(roomId); const member = roomMember(roomId, identityId);
  if (!room || !member || !room.battle_json) return null;
  const battle = safeJson(room.battle_json, null); if (!battle) return null;
  const data = response?.data || {};
  return {
    // First submission remains a waiting event; HTTP and WebSocket must agree.
    type: data.type === 'submission_accepted' ? 'submission_accepted' : (data.type === 'round_result' ? 'round_result' : 'stage_result'),
    requestId: packet.requestId,
    roomId,
    battleRevision: Number(battle.revision || 0),
    stage: text(packet.payload?.stage),
    nextStage: text(data.nextStage || battle.phase),
    peerSubmission: text(data.peerSubmission || (data.type === 'submission_accepted' ? 'waiting' : 'submitted')),
    accepted: data.type === 'submission_accepted',
    round: Number(battle.round || 0),
    visible_state: canonicalForSide(battle, Number(member.side)),
    projection: projectForSide(battle, Number(member.side)),
  };
}
const server = createServer(async (req, res) => {
  const context = createRequestContext(req.headers);
  const started = Date.now();
  increment('room_http_requests_total', 1, { method: req.method, route: req.url || '/' });
  if (!allowedOrigin(req)) { increment('room_http_errors_total', 1, { code: 'ORIGIN_NOT_ALLOWED' }); send(req, res, 403, { ok: false, error: { code: 'ORIGIN_NOT_ALLOWED', message: 'origin is not allowed', requestId: context.requestId, traceId: context.traceId } }); logger.warn({ event: 'request_rejected', ...finishRequestContext(context), code: 'ORIGIN_NOT_ALLOWED' }); return; }
  try {
    if (req.method === 'OPTIONS') { res.writeHead(204, { ...corsHeaders(req), 'access-control-allow-methods': 'POST,GET,OPTIONS', 'access-control-allow-headers': 'Content-Type,X-Request-Id,X-Trace-Id' }); res.end(); return; }
    if (req.method === 'GET' && req.url === '/health') { send(req, res, 200, { ok: true, service: 'jjk-preview-room', protocolVersion: PROTOCOL_VERSION, battleAuthority: true, requestId: context.requestId, traceId: context.traceId }); return; }
    if (req.method === 'GET' && req.url === '/metrics') { send(req, res, 200, { ok: true, service: 'jjk-preview-room', protocolVersion: PROTOCOL_VERSION, requestId: context.requestId, traceId: context.traceId, metrics: snapshot() }); return; }
    if (req.method === 'POST' && req.url === '/api/rooms') { const packet = await readJson(req); if (isObject(packet)) { packet.traceId ||= context.traceId; packet.requestId ||= context.requestId; } const result = await handle(packet); increment(result.status >= 400 ? 'room_operation_errors_total' : 'room_operation_success_total', 1, { operation: packet?.operation || 'unknown', status: result.status }); send(req, res, result.status, result.body); if (result.status < 400 && packet?.operation === 'submit_stage_input' && packet?.payload?.roomId) socketHub.broadcastBattle(packet.payload.roomId, (identityId) => battleSocketEvent(packet.payload.roomId, identityId, packet, result.body)); const changedRoomId = packet?.payload?.roomId || result.body?.data?.room?.roomId; if (result.status < 400 && changedRoomId && ['join_room', 'leave_room', 'lock_character', 'delete_room', 'set_spectator_policy', 'queue_match', 'cancel_match'].includes(packet.operation)) {
      socketHub.broadcastRoom(changedRoomId, { type: 'room_state_changed', roomId: changedRoomId, roomRevision: result.body?.data?.room?.revision || 0, room: result.body?.data?.room || null });
      if (packet.operation === 'leave_room') socketHub.disconnectRoom(changedRoomId, packet.identity?.identityId || '');
      if (packet.operation === 'delete_room' || packet.operation === 'cancel_match') socketHub.disconnectRoom(changedRoomId);
    } logger.info({ event: 'request_completed', operation: packet?.operation, status: result.status, requestId: context.requestId, traceId: context.traceId, durationMs: Date.now() - started }); return; }
    increment('room_http_errors_total', 1, { code: 'ROUTE_NOT_FOUND' }); send(req, res, 404, { ok: false, error: { code: 'ROUTE_NOT_FOUND', message: 'route does not exist', requestId: context.requestId, traceId: context.traceId } });
  } catch (caught) { const code = caught.message === 'request_too_large' ? 'REQUEST_TOO_LARGE' : 'INVALID_REQUEST'; increment('room_http_errors_total', 1, { code }); logger.error({ event: 'request_failed', ...finishRequestContext(context), code, message: caught.message }); send(req, res, caught.message === 'request_too_large' ? 413 : 400, { ok: false, error: { code, message: code, requestId: context.requestId, traceId: context.traceId } }); }
});
server.listen(PORT, HOST, () => console.log(`[preview-room] listening on http://${HOST}:${PORT}`));
server.on('upgrade', (request, socket, head) => socketHub.upgrade(request, socket, head));
server.on('error', (caught) => { console.error(`[preview-room] ${caught.code || 'ERROR'}: ${caught.message}`); process.exitCode = 1; });

