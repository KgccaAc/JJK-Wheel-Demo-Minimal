import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';

const root = resolve(process.cwd().endsWith('backend') ? '..' : '.');
const roomPort = 8895; const webPort = 8096; const dataDir = await mkdtemp(join(tmpdir(), 'jjk-online-browser-'));
const room = spawn(process.execPath, ['backend/preview-room-server.mjs'], { cwd: root, env: { ...process.env, PREVIEW_ROOM_PORT: String(roomPort), PREVIEW_ROOM_ALLOWED_ORIGIN: `http://127.0.0.1:${webPort}`, PREVIEW_ROOM_DATA_DIR: join(dataDir, 'room') }, stdio: ['ignore', 'pipe', 'pipe'] });
const web = spawn(process.execPath, ['backend/local-preview-server.mjs'], { cwd: root, env: { ...process.env, LOCAL_PREVIEW_PORT: String(webPort), PREVIEW_ROOM_PORT: String(roomPort), STORY_RUNTIME_DATA_DIR: join(dataDir, 'story'), STORY_BATTLE_DATA_DIR: join(dataDir, 'battle'), AI_DIALOGUE_DATA_DIR: join(dataDir, 'ai'), DEEPSEEK_API_KEY: '', DEEPSEEK_KEY_FILE: join(dataDir, 'missing') }, stdio: ['ignore', 'pipe', 'pipe'] });
let output = ''; web.stdout.on('data', (chunk) => { output += chunk.toString(); }); web.stderr.on('data', (chunk) => { output += chunk.toString(); });
const deadline = Date.now() + 8_000; while (!output.includes(`[local-preview] http://127.0.0.1:${webPort}`) && Date.now() < deadline) await new Promise((resolveWait) => setTimeout(resolveWait, 50));
assert.match(output, new RegExp(`local-preview.*${webPort}`), output);
const browser = await chromium.launch({ headless: true }); const page = await browser.newPage({ viewport: { width: 1280, height: 800 } }); const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
try {
  await page.goto(`http://127.0.0.1:${webPort}/?save=online-browser-${process.pid}`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.querySelector('#content-version')?.textContent !== '加载中…');
  await page.locator('a[href="#/story"]').first().click();
  await page.getByRole('heading', { name: '签名会后的断片' }).waitFor();
  await page.locator('a[href="#/online"]').first().click();
  await page.waitForTimeout(500);
  await page.getByRole('heading', { name: '联机大厅' }).waitFor();
  await page.getByRole('button', { name: '创建预览房间' }).click();
  await page.waitForTimeout(500);
  assert.match(await page.locator('#online-health').innerText(), /预览房间服务在线/);
  await page.locator('#online-room .log-entry').waitFor();
  assert.match(await page.locator('#online-room').innerText(), /房间：prv-/);
  await page.getByRole('button', { name: '锁定当前角色' }).click();
  assert.match(await page.locator('#online-room').innerText(), /修订：/);
  assert.equal(errors.length, 0, errors.join(' | '));
  console.log('WEB_ONLINE_BROWSER PASS create=true lock=true console_errors=0');
} finally {
  await browser.close();
  const waits = [];
  if (!web.killed) { waits.push(new Promise((resolveExit) => web.once('exit', resolveExit))); web.kill(); }
  if (!room.killed) { waits.push(new Promise((resolveExit) => room.once('exit', resolveExit))); room.kill(); }
  await Promise.all(waits);
  await rm(dataDir, { recursive: true, force: true });
}
