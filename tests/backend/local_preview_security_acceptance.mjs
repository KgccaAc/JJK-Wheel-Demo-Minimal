import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { request } from 'node:http';

const cwd = resolve(process.cwd());
const root = cwd.endsWith('backend') ? resolve(cwd, '..') : cwd;
const tempRoot = await mkdtemp(join(tmpdir(), 'jjk-preview-security-'));
const webRoot = join(tempRoot, 'web-preview');
const siblingRoot = join(tempRoot, 'web-preview-evil');
await mkdir(webRoot, { recursive: true });
await mkdir(siblingRoot, { recursive: true });
await writeFile(join(webRoot, 'index.html'), 'safe', 'utf8');
await writeFile(join(siblingRoot, 'secret.txt'), 'secret-must-not-leak', 'utf8');

const port = 8092;
const runtimeDir = join(tempRoot, 'runtime');
const server = spawn(process.execPath, ['backend/local-preview-server.mjs'], {
  cwd: root,
  env: {
    ...process.env,
    LOCAL_PREVIEW_PORT: String(port),
    LOCAL_PREVIEW_WEB_ROOT: webRoot,
    STORY_EDITOR_ROOT: webRoot,
    STORY_RUNTIME_ROOT: webRoot,
    STORY_RUNTIME_DATA_DIR: runtimeDir,
    AI_DIALOGUE_DATA_DIR: join(runtimeDir, 'ai'),
    DEEPSEEK_API_KEY: '',
    DEEPSEEK_KEY_FILE: join(tempRoot, 'missing-key'),
    LOCAL_PREVIEW_REMOTE_ROOM_PREFIX: '',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let output = '';
server.stdout.on('data', (chunk) => { output += chunk.toString(); });
server.stderr.on('data', (chunk) => { output += chunk.toString(); });

const deadline = Date.now() + 8_000;
while (!output.includes(`[local-preview] http://127.0.0.1:${port}`) && Date.now() < deadline) await new Promise((resolveWait) => setTimeout(resolveWait, 50));
assert.match(output, new RegExp(`local-preview.*${port}`), output);

const get = (path) => new Promise((resolveRequest, reject) => {
  const req = request({ hostname: '127.0.0.1', port, method: 'GET', path }, (res) => {
    let body = '';
    res.setEncoding('utf8');
    res.on('data', (chunk) => { body += chunk; });
    res.on('end', () => resolveRequest({ status: res.statusCode, body }));
  });
  req.on('error', reject);
  req.end();
});

try {
  const safe = await get('/');
  assert.equal(safe.status, 200);
  assert.equal(safe.body, 'safe');

  const traversal = await get('/%2e%2e/web-preview-evil/secret.txt');
  assert.ok([403, 404].includes(traversal.status), `expected traversal rejection, got ${traversal.status}`);
  assert.equal(traversal.body.includes('secret-must-not-leak'), false);
  console.log('LOCAL_PREVIEW_SECURITY_ACCEPTANCE PASS traversal_blocked=true');
} finally {
  server.kill();
  await rm(tempRoot, { recursive: true, force: true });
}
