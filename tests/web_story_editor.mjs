import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';

const root = resolve(process.cwd().endsWith('backend') ? '..' : '.');
const port = 8093;
const dataDir = await mkdtemp(join(tmpdir(), 'jjk-story-editor-'));
const server = spawn(process.execPath, ['backend/local-preview-server.mjs'], {
  cwd: root,
  env: { ...process.env, LOCAL_PREVIEW_PORT: String(port), STORY_RUNTIME_DATA_DIR: dataDir, STORY_BATTLE_DATA_DIR: join(dataDir, 'battle'), AI_DIALOGUE_DATA_DIR: join(dataDir, 'ai'), DEEPSEEK_API_KEY: '', DEEPSEEK_KEY_FILE: join(dataDir, 'missing') },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let output = '';
server.stdout.on('data', (chunk) => { output += chunk.toString(); });
server.stderr.on('data', (chunk) => { output += chunk.toString(); });
const deadline = Date.now() + 8_000;
while (!output.includes(`[local-preview] http://127.0.0.1:${port}`) && Date.now() < deadline) await new Promise((resolveWait) => setTimeout(resolveWait, 50));
assert.match(output, new RegExp(`local-preview.*${port}`), output);

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
try {
  await page.goto(`http://127.0.0.1:${port}/story-editor/`, { waitUntil: 'networkidle' });
  await page.locator('[data-id="chapter1_clue"]').click();
  const original = await page.locator('#node-rpg-lines').inputValue();
  assert.match(original, /虎杖|签名会|咒灵|残秽/, 'legacy rpg lines must be editable, not rendered as an empty dialogue');
  await page.locator('#node-rpg-lines').fill('玩家：编辑器验收台词');
  await page.getByRole('button', { name: '保存节点草稿' }).click();
  assert.match(await page.locator('#preview').innerText(), /编辑器验收台词/);
  await page.getByRole('button', { name: '撤销' }).click();
  assert.equal(await page.locator('#node-rpg-lines').inputValue(), original);
  assert.match(await page.locator('#references').innerText(), /引用此节点|无上游引用/);
  await page.getByRole('button', { name: '服务端校验' }).click();
  await page.locator('#diagnostics').getByText(/服务端校验/).waitFor();
  assert.equal(errors.length, 0, errors.join(' | '));
  console.log('WEB_STORY_EDITOR PASS rpg_lines=true undo=true refs=true server_validation=true');
} finally {
  await browser.close();
  server.kill();
  await rm(dataDir, { recursive: true, force: true });
}
