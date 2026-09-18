import { createHash } from 'node:crypto';

const PROTOCOL_VERSION = 'online-battle-v3';
const COMMANDS = new Set(['subscribe_room', 'unsubscribe_room', 'ping']);
const MAX_FRAME_BYTES = 64 * 1024;

function jsonFrame(value) {
  const payload = Buffer.from(JSON.stringify(value));
  if (payload.length > MAX_FRAME_BYTES) throw new Error('frame_too_large');
  if (payload.length < 126) return Buffer.concat([Buffer.from([0x81, payload.length]), payload]);
  if (payload.length < 65536) { const header = Buffer.alloc(4); header[0] = 0x81; header[1] = 126; header.writeUInt16BE(payload.length, 2); return Buffer.concat([header, payload]); }
  const header = Buffer.alloc(10); header[0] = 0x81; header[1] = 127; header.writeBigUInt64BE(BigInt(payload.length), 2); return Buffer.concat([header, payload]);
}

function parseFrames(buffer) {
  const frames = []; let offset = 0;
  while (buffer.length - offset >= 2) {
    const first = buffer[offset]; const second = buffer[offset + 1]; const opcode = first & 0x0f; const masked = Boolean(second & 0x80); let length = second & 0x7f; let header = 2;
    if (length === 126) { if (buffer.length - offset < 4) break; length = buffer.readUInt16BE(offset + 2); header = 4; }
    else if (length === 127) { if (buffer.length - offset < 10) break; const big = buffer.readBigUInt64BE(offset + 2); if (big > BigInt(MAX_FRAME_BYTES)) throw new Error('frame_too_large'); length = Number(big); header = 10; }
    const maskBytes = masked ? 4 : 0; if (buffer.length - offset < header + maskBytes + length) break;
    const mask = masked ? buffer.subarray(offset + header, offset + header + 4) : null; const start = offset + header + maskBytes; const data = Buffer.from(buffer.subarray(start, start + length));
    if (mask) for (let i = 0; i < data.length; i += 1) data[i] ^= mask[i % 4];
    frames.push({ opcode, data }); offset = start + length;
  }
  return { frames, rest: buffer.subarray(offset) };
}

function acceptKey(key) { return createHash('sha1').update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`).digest('base64'); }

export function createRoomSocketHub({ authorize, roomSnapshot, battleSnapshot, logger = console, metrics = () => {} } = {}) {
  const rooms = new Map();
  const connections = new Set();
  const detachFromRoom = (connection, notify = true) => {
    const previousRoomId = connection.roomId;
    if (!previousRoomId || !rooms.has(previousRoomId)) return;
    const set = rooms.get(previousRoomId);
    set.delete(connection);
    if (!set.size) rooms.delete(previousRoomId);
    if (notify && connection.identityId) {
      for (const peer of set) sendEvent(peer, { type: 'peer_disconnected', roomId: previousRoomId, identityId: connection.identityId, graceUntil: new Date(Date.now() + 15000).toISOString() });
    }
    connection.roomId = '';
  };
  const remove = (connection, notify = true) => {
    if (connection.closed) return;
    connection.closed = true; connections.delete(connection);
    detachFromRoom(connection, notify);
    try { connection.socket.end(); } catch {}
    metrics('room_socket_active', -1); metrics('room_socket_events_total', 1, { event: 'disconnect' });
  };
  const send = (connection, value) => { if (!connection.closed) { try { connection.socket.write(jsonFrame(value)); } catch { remove(connection, false); } } };
  const sendError = (connection, packet, code, message) => send(connection, { type: 'error', protocolVersion: PROTOCOL_VERSION, requestId: String(packet?.requestId || ''), traceId: String(packet?.traceId || packet?.requestId || ''), error: { code, category: code === 'INVALID_REQUEST' ? 'INPUT' : 'ROOM', message, details: {} } });
  const sendEvent = (connection, event) => send(connection, { protocolVersion: PROTOCOL_VERSION, traceId: connection.traceId || '', ...event });
  const subscribe = (connection, packet) => {
    const identity = packet?.identity; const roomId = String(packet?.payload?.roomId || connection.roomId || '');
    if (packet?.protocolVersion !== PROTOCOL_VERSION || !packet?.requestId || !identity?.identityId || packet.type !== 'subscribe_room' || !roomId) return sendError(connection, packet, 'INVALID_REQUEST', 'protocolVersion, requestId, identity and roomId are required');
    const auth = authorize?.(roomId, identity); if (!auth?.ok) return sendError(connection, packet, auth?.code || 'NOT_ROOM_PLAYER', auth?.message || 'only room players may subscribe');
    if (connection.roomId && connection.roomId !== roomId) detachFromRoom(connection, false);
    const set = rooms.get(roomId) || new Set();
    if (set.size >= 4 || [...set].filter((entry) => entry !== connection && entry.identityId === identity.identityId).length >= 2) return sendError(connection, packet, 'WORKER_OVERLOADED', 'room socket capacity is full');
    set.delete(connection);
    connection.roomId = roomId; connection.identityId = String(identity.identityId); connection.traceId = String(packet.traceId || packet.requestId); connection.identity = { ...identity }; set.add(connection); rooms.set(roomId, set);
    metrics('room_socket_events_total', 1, { event: 'subscribe' }); sendEvent(connection, { type: 'subscribed', requestId: packet.requestId, roomId, roomRevision: Number(auth.roomRevision || 0), battleRevision: Number(auth.battleRevision || 0) });
    const room = roomSnapshot?.(roomId); if (room) sendEvent(connection, { type: 'room_state_changed', roomId, roomRevision: Number(room.revision || 0), room });
    const battle = battleSnapshot?.(roomId, identity.identityId); if (battle) sendEvent(connection, { type: 'battle_bootstrap', roomId, ...battle });
  };
  const handlePacket = (connection, packet) => {
    if (!packet || typeof packet !== 'object' || !COMMANDS.has(packet.type)) return sendError(connection, packet, 'INVALID_REQUEST', 'unknown WebSocket command');
    if (packet.type === 'ping') return sendEvent(connection, { type: 'pong', requestId: packet.requestId, traceId: packet.traceId || packet.requestId, serverTime: new Date().toISOString() });
    if (packet.type === 'subscribe_room') return subscribe(connection, packet);
    if (packet.type === 'unsubscribe_room') { if (connection.roomId) detachFromRoom(connection, false); return sendEvent(connection, { type: 'unsubscribed', requestId: packet.requestId, roomId: String(packet.payload?.roomId || ''), roomRevision: 0, battleRevision: 0 }); }
    return undefined;
  };
  const upgrade = (request, socket, head) => {
    const url = new URL(request.url || '/', 'http://localhost');
    if (url.pathname !== '/api/rooms/socket' || !url.searchParams.get('roomId') || request.headers.upgrade?.toLowerCase() !== 'websocket') { socket.write('HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n'); socket.destroy(); return false; }
    const key = request.headers['sec-websocket-key']; if (!key) { socket.write('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n'); socket.destroy(); return false; }
    socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${acceptKey(key)}\r\n\r\n`);
    const connection = { socket, roomId: '', identityId: '', traceId: '', closed: false, buffer: Buffer.from(head || []) }; connections.add(connection); metrics('room_socket_active', 1); metrics('room_socket_connections_total', 1);
    const process = (chunk) => { try { connection.buffer = Buffer.concat([connection.buffer, chunk]); if (connection.buffer.length > MAX_FRAME_BYTES * 2) throw new Error('frame_too_large'); const parsed = parseFrames(connection.buffer); connection.buffer = parsed.rest; for (const frame of parsed.frames) { if (frame.opcode === 0x8) return remove(connection); if (frame.opcode === 0x9) { connection.socket.write(Buffer.from([0x8a, frame.data.length, ...frame.data])); continue; } if (frame.opcode === 0x1) handlePacket(connection, JSON.parse(frame.data.toString('utf8'))); } } catch (error) { logger.warn?.({ event: 'room_socket_error', code: error.message }); sendError(connection, {}, error.message === 'frame_too_large' ? 'WORKER_OVERLOADED' : 'INVALID_REQUEST', 'WebSocket frame is invalid'); remove(connection); } };
    socket.on('data', process); socket.on('error', () => remove(connection, false)); socket.on('close', () => remove(connection, true)); return true;
  };
  const broadcastRoom = (roomId, event) => { for (const connection of rooms.get(String(roomId)) || []) sendEvent(connection, event); };
  const broadcastBattle = (roomId, eventByIdentity) => { for (const connection of rooms.get(String(roomId)) || []) { const event = typeof eventByIdentity === 'function' ? eventByIdentity(connection.identityId) : eventByIdentity; if (event) sendEvent(connection, event); } };
  const disconnectRoom = (roomId, identityId = '') => {
    for (const connection of [...(rooms.get(String(roomId)) || [])]) {
      if (!identityId || connection.identityId === String(identityId)) remove(connection, false);
    }
  };
  return { upgrade, broadcastRoom, broadcastBattle, disconnectRoom, close: () => { for (const connection of [...connections]) remove(connection, false); } };
}
