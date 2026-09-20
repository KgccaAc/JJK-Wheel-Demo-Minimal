const json = async (fetchImpl, url, body) => {
  const response = await fetchImpl(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const payload = await response.json();
  if (!response.ok || payload?.ok === false) { const error = new Error(payload?.error?.code || payload?.error || `online_http_${response.status}`); error.status = response.status; error.payload = payload; throw error; }
  return payload;
};

export class OnlinePreviewClient {
  constructor({ basePath = '/preview-room-api', identityId = `web-${crypto.randomUUID?.() || Date.now()}`, fetchImpl = globalThis.fetch } = {}) { this.basePath = basePath.replace(/\/$/, ''); this.identityId = identityId; this.fetchImpl = fetchImpl === globalThis.fetch ? fetchImpl.bind(globalThis) : fetchImpl; this.requestCounter = 0; this.room = null; }
  packet(operation, payload = {}) { const id = `${this.identityId}-${++this.requestCounter}`; return { protocolVersion: 'online-battle-v3', requestId: id, traceId: id, identity: { identityId: this.identityId, guest: true }, operation, expectedRoomRevision: this.room?.revision, payload }; }
  async operation(operation, payload = {}) { const result = await json(this.fetchImpl, `${this.basePath}/api/rooms`, this.packet(operation, payload)); this.room = result.data?.room || this.room; return result; }
  async health() { const response = await this.fetchImpl(`${this.basePath}/health`); return response.json(); }
  createRoom(profile = {}) { return this.operation('create_room', { mode: 'private_1v1', spectatorPolicy: 'read_only', characterId: profile.id || 'web-character', characterSnapshot: profile }); }
  joinRoom(roomId, profile = {}) { return this.operation('join_room', { roomId, characterId: profile.id || 'web-character', characterSnapshot: profile }); }
  lockCharacter(locked, profile = {}) { return this.operation('lock_character', { roomId: this.room?.roomId, locked, characterId: profile.id || 'web-character', characterSnapshot: profile }); }
  snapshot() { return { identityId: this.identityId, room: structuredClone(this.room) }; }
}
