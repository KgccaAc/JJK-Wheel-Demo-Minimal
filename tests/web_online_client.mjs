import assert from 'node:assert/strict';
import { OnlinePreviewClient } from '../web-runtime/online-client.mjs';

const calls = [];
const fetchImpl = async (url, options = {}) => {
  calls.push({ url, packet: JSON.parse(options.body || '{}') });
  return new Response(JSON.stringify({ ok: true, data: { room: { roomId: 'prv-test', revision: calls.length, state: calls.length > 1 ? 'READY' : 'LOBBY', members: [] } } }), { status: 200, headers: { 'content-type': 'application/json' } });
};
const client = new OnlinePreviewClient({ identityId: 'web-test', fetchImpl });
await client.createRoom({ id: 'wheel-character', displayName: '转盘角色' });
await client.lockCharacter(true, { id: 'wheel-character' });
assert.equal(calls[0].packet.operation, 'create_room');
assert.equal(calls[1].packet.operation, 'lock_character');
assert.equal(calls[1].packet.expectedRoomRevision, 1);
assert.equal(client.snapshot().room.state, 'READY');
console.log('WEB_ONLINE_CLIENT PASS create=true lock=true revision=true');
