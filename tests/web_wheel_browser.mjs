import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';

const root = resolve(process.cwd().endsWith('backend') ? '..' : '.');
const port = 8094; const dataDir = await mkdtemp(join(tmpdir(), 'jjk-wheel-browser-'));
const server = spawn(process.execPath, ['backend/local-preview-server.mjs'], { cwd: root, env: { ...process.env, LOCAL_PREVIEW_PORT: String(port), STORY_RUNTIME_DATA_DIR: dataDir, STORY_BATTLE_DATA_DIR: join(dataDir, 'battle'), AI_DIALOGUE_DATA_DIR: join(dataDir, 'ai'), DEEPSEEK_API_KEY: '', DEEPSEEK_KEY_FILE: join(dataDir, 'missing') }, stdio: ['ignore', 'pipe', 'pipe'] });
let output = ''; server.stdout.on('data', (chunk) => { output += chunk.toString(); }); server.stderr.on('data', (chunk) => { output += chunk.toString(); });
const deadline = Date.now() + 8_000; while (!output.includes(`[local-preview] http://127.0.0.1:${port}`) && Date.now() < deadline) await new Promise((resolveWait) => setTimeout(resolveWait, 50));
assert.match(output, new RegExp(`local-preview.*${port}`), output);
const browser = await chromium.launch({ headless: true }); const page = await browser.newPage({ viewport: { width: 1280, height: 800 } }); const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
try {
  await page.goto(`http://127.0.0.1:${port}/?save=wheel-browser-${process.pid}#/wheel`, { waitUntil: 'networkidle' });
  for (let step = 0; step < 100; step += 1) {
    if (await page.getByRole('heading', { name: '角色生成完成' }).count()) break;
    const grade = page.locator('[data-wheel-grade]'); if (await grade.count()) { await grade.click(); continue; }
    const pending = page.locator('[data-wheel-accept]'); if (await pending.count()) { await pending.click(); continue; }
    const options = page.locator('[data-wheel-option]'); if (await options.count()) { await options.first().click(); continue; }
    const roll = page.locator('[data-wheel-roll]'); assert.equal(await roll.count(), 1, `wheel stalled at step ${step}`); await roll.click();
  }
  await page.getByRole('heading', { name: '角色生成完成' }).waitFor();
  assert.equal(errors.length, 0, errors.join(' | '));
  console.log('WEB_WHEEL_BROWSER PASS complete=true console_errors=0');
} finally { await browser.close(); server.kill(); await rm(dataDir, { recursive: true, force: true }); }
