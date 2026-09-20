import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';

const cwd = resolve(process.cwd());
const root = cwd.endsWith('backend') ? resolve(cwd, '..') : cwd;
const port = 18889;
const dataDir = await mkdtemp(join(tmpdir(), 'jjk-room-acceptance-'));
const endpoint = `http://127.0.0.1:${port}/api/rooms`;
const server = spawn(process.execPath, ['backend/preview-room-server.mjs'], {
  cwd: root,
  env: { ...process.env, PREVIEW_ROOM_PORT: String(port), PREVIEW_ROOM_DATA_DIR: dataDir },
  stdio: ['ignore', 'pipe', 'pipe'],
});

async function waitForServer() {
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/health`);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 40));
  }
  throw new Error('local room authority did not start');
}

function profile(id) {
  return {
    id,
    displayName: id,
    stats: { body: 'B', martial: 'B', cursed_energy: 'B', control: 'B', efficiency: 'B', talent: 'B' },
    cards: Array.from({ length: 10 }, (_, index) => ({ id: `${id}-card-${index}`, name: '验收牌', type: 'action', tags: [], effect: { damage: 1 }, cost: { ce: 0 } })),
  };
}

async function request(identityId, operation, payload) {
  const requestId = `${identityId}-${operation}-${crypto.randomUUID()}`;
  const response = await fetch(endpoint, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ protocolVersion: 'online-battle-v3', requestId, traceId: requestId, identity: { identityId, guest: true }, operation, payload }),
  });
  return { status: response.status, body: await response.json() };
}

try {
  await waitForServer();
  const hostProfile = profile('match-host-character');
  const guestProfile = profile('match-guest-character');
  const first = await request('match-host', 'queue_match', { characterId: hostProfile.id, characterSnapshot: hostProfile, mode: 'ranked_1v1' });
  assert.equal(first.status, 200, JSON.stringify(first.body));
  assert.equal(first.body.ok, true, JSON.stringify(first.body));
  const roomId = first.body.data?.room?.roomId;
  assert.ok(roomId, JSON.stringify(first.body));
  const second = await request('match-guest', 'queue_match', { characterId: guestProfile.id, characterSnapshot: guestProfile, mode: 'ranked_1v1' });
  assert.equal(second.status, 200, JSON.stringify(second.body));
  assert.equal(second.body.ok, true, JSON.stringify(second.body));
  assert.equal(second.body.data?.room?.roomId, roomId, JSON.stringify(second.body));
  assert.equal(second.body.data?.room?.state, 'LOBBY', JSON.stringify(second.body));
  assert.equal(second.body.data?.room?.members?.length, 2, JSON.stringify(second.body));
  const hostLock = await request('match-host', 'lock_character', { roomId, locked: true, characterId: hostProfile.id, characterSnapshot: hostProfile });
  assert.equal(hostLock.status, 200, JSON.stringify(hostLock.body));
  const guestLock = await request('match-guest', 'lock_character', { roomId, locked: true, characterId: guestProfile.id, characterSnapshot: guestProfile });
  assert.equal(guestLock.status, 200, JSON.stringify(guestLock.body));
  assert.equal(guestLock.body.data?.room?.state, 'READY', JSON.stringify(guestLock.body));
  console.log('ONLINE_ROOM_V2_ACCEPTANCE PASS');
} finally {
  if (!server.killed) {
    const exited = new Promise((resolve) => server.once('exit', resolve));
    server.kill();
    await exited;
  }
  await rm(dataDir, { recursive: true, force: true });
}
