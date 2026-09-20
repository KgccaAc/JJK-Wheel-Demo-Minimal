import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const cwd = resolve(process.cwd());
const root = cwd.endsWith('backend') ? resolve(cwd, '..') : cwd;
const port = 18000 + (process.pid % 1000);
const dataDir = await mkdtemp(join(tmpdir(), 'jjk-local-worker-'));
const env = { ...process.env, LOCAL_WORKER_HOST: '127.0.0.1', LOCAL_WORKER_PORT: String(port), LOCAL_WORKER_DATA_DIR: dataDir, LOCAL_WORKER_CHECKPOINT_PATH: join(dataDir, 'checkpoint.json'), LOCAL_WORKER_EVENT_PATH: join(dataDir, 'events.jsonl') };
const child = spawn(process.execPath, [join(root, 'backend', 'local-worker.mjs')], { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] });
let childOutput = ''; let childError = '';
child.stdout.on('data', (chunk) => { childOutput += chunk.toString(); });
child.stderr.on('data', (chunk) => { childError += chunk.toString(); });
const waitForHealth = async () => {
  for (let i = 0; i < 50; i += 1) {
    try { const response = await fetch(`http://127.0.0.1:${port}/health`); if (response.ok) return response.json(); } catch {}
    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
  }
  throw new Error(`local_worker_health_timeout stdout=${childOutput.slice(-500)} stderr=${childError.slice(-1000)}`);
};
const packet = async (operation, payload = {}) => {
  const response = await fetch(`http://127.0.0.1:${port}/online-room`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ protocol_version: 'online-battle-v3', request_id: `${operation}-${Date.now()}-${Math.random()}`, operation, payload }) });
  return { status: response.status, body: await response.json() };
};
try {
  const health = await waitForHealth();
  assert.equal(health.protocol_version, 'online-battle-v3');
  const servers = await packet('listServers');
  assert.equal(servers.status, 200); assert.equal(servers.body.ok, true); assert.ok(servers.body.servers.length >= 1);
  const created = await packet('createRoom', { player_id: 'local-a', character_id: 'yuji' });
  assert.equal(created.status, 200); assert.equal(created.body.ok, true);
  const roomId = created.body.room.room_id;
  const joined = await packet('joinRoom', { room_id: roomId, player_id: 'local-b', character_id: 'nanami' });
  assert.equal(joined.status, 200); assert.equal(joined.body.room.players.length, 2);
  console.log(`LOCAL_WORKER_ACCEPTANCE PASS room=${roomId} servers=${servers.body.servers.length}`);
} finally {
  child.kill();
  await rm(dataDir, { recursive: true, force: true });
}
