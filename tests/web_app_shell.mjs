import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { join } from 'node:path';
import { chromium } from 'playwright';

const cwd = resolve(process.cwd());
const root = cwd.endsWith('backend') ? resolve(cwd, '..') : cwd;
const port = 8091;
const origin = `http://127.0.0.1:${port}`;
const dataDir = await mkdtemp(join(tmpdir(), 'jjk-web-shell-'));
const server = spawn(process.execPath, ['backend/local-preview-server.mjs'], {
  cwd: root,
  env: { ...process.env, LOCAL_PREVIEW_PORT: String(port), LOCAL_PREVIEW_REMOTE_ROOM_PREFIX: '', STORY_RUNTIME_DATA_DIR: dataDir, STORY_BATTLE_DATA_DIR: join(dataDir, 'battles'), AI_DIALOGUE_DATA_DIR: join(dataDir, 'ai'), DEEPSEEK_API_KEY: '', DEEPSEEK_KEY_FILE: join(dataDir, 'missing-key') },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let output = '';
server.stdout.on('data', (chunk) => { output += chunk.toString(); });
server.stderr.on('data', (chunk) => { output += chunk.toString(); });
const deadline = Date.now() + 8_000;
while (!output.includes(`[local-preview] http://127.0.0.1:${port}`) && Date.now() < deadline) await new Promise((resolveWait) => setTimeout(resolveWait, 50));
assert.match(output, new RegExp(`local-preview.*${port}`), output);
const testSaveId = `web-shell-${process.pid}`;
await fetch(`${origin}/api/saves/${testSaveId}/events`, {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ expectedRevision: 0, source: 'web_shell_test', events: [{ type: 'test_seed' }], snapshot: {} }),
});

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
try {
  const response = await page.goto(`${origin}/?save=${testSaveId}`, { waitUntil: 'networkidle' });
  assert.equal(response.status(), 200);
  await assert.doesNotReject(() => page.locator('h1').first().waitFor({ state: 'visible' }));
  assert.match(await page.title(), /咒术轮盘/);
  await page.locator('a[href="#/story"]').first().click();
  await page.getByRole('heading', { name: '签名会后的断片' }).waitFor();
  assert.equal(await page.locator('[data-choice]').count(), 2);
  await page.locator('[data-choice]').first().click();
  await page.getByRole('heading', { name: '初来乍到' }).waitFor();
  await page.getByRole('button', { name: '晚上' }).click();
  await page.locator('[data-choice]').first().click();
  await page.getByRole('heading', { name: '仙台异常调查' }).waitFor();
  await page.locator('[data-continue]').click();
  await page.getByRole('heading', { name: '残秽与黑影' }).waitFor();
  await page.getByRole('button', { name: /先与初级术师确认风险/ }).click();
  await page.getByRole('heading', { name: '河岸前的临时协商' }).waitFor();
  await page.locator('#ai-input').fill('先确认普通人的撤离路线。');
  await page.getByRole('button', { name: '发送互动' }).click();
  await page.locator('.ai-box .log-entry').first().waitFor();
  assert.match(await page.locator('.ai-box').innerText(), /本地回退/);
  await page.getByRole('button', { name: '结束对话' }).click();
  await page.getByRole('heading', { name: '河岸的低级咒灵' }).waitFor();
  assert.ok(await page.locator('.story-stage').isVisible());
  await page.getByRole('button', { name: '进入真实战斗' }).click();
  await page.getByRole('heading', { name: '战斗准备' }).waitFor();
  await page.getByRole('button', { name: '稳健策略' }).click();
  await page.getByRole('heading', { name: '选择弃牌' }).waitFor();
  const battleCards = page.locator('[data-battle-card]');
  assert.equal(await battleCards.count(), 10);
  await battleCards.nth(0).click();
  await battleCards.nth(1).click();
  await page.getByRole('button', { name: '确认弃牌' }).click();
  await page.getByRole('heading', { name: '先手投入' }).waitFor();
  for (let round = 0; round < 12; round += 1) {
    await page.getByRole('button', { name: '投入 0 HP' }).click();
    await page.getByRole('heading', { name: '选择出牌' }).waitFor();
    const attacks = page.locator('[data-battle-card][data-damage]:not([data-damage="0"])');
    const attackCount = Math.min(3, await attacks.count());
    assert.ok(attackCount > 0, 'real hand must expose at least one damaging action');
    for (let index = 0; index < attackCount; index += 1) await attacks.nth(index).click();
    await page.getByRole('button', { name: '确认出牌' }).click();
    await page.waitForFunction(() => ['选择弃牌', '战斗结算'].includes(document.querySelector('.battle-box h2')?.textContent || ''));
    if (await page.getByRole('heading', { name: '战斗结算' }).count()) break;
    await page.getByRole('heading', { name: '选择弃牌' }).waitFor();
    const nextCards = page.locator('[data-battle-card]');
    await nextCards.nth(0).click(); await nextCards.nth(1).click();
    await page.getByRole('button', { name: '确认弃牌' }).click();
    await page.getByRole('heading', { name: '先手投入' }).waitFor();
  }
  await page.getByRole('heading', { name: '战斗结算' }).waitFor();
  await page.getByRole('button', { name: '返回剧情并结算' }).click();
  await page.getByRole('heading', { name: '第一章完成' }).waitFor();
  await page.locator('a[href="#/wheel"]').click();
  await page.getByRole('heading', { name: '穿越后的初始身份' }).waitFor();
  await page.getByRole('button', { name: '旋转并锁定结果' }).click();
  await page.getByRole('button', { name: '确认结果' }).click();
  assert.ok(await page.locator('.wheel-panel').isVisible());
  await page.locator('a[href="#/battle"]').first().click();
  await page.getByRole('heading', { name: '基础战斗' }).waitFor();
  await page.getByRole('button', { name: '进入真实战斗' }).click();
  await page.getByRole('heading', { name: '战斗准备' }).waitFor();
  assert.equal(errors.length, 0, errors.join(' | '));
  console.log('WEB_APP_SHELL_ACCEPTANCE PASS root=200 story_choice=true module_route=true console_errors=0');
} finally {
  await browser.close();
  server.kill();
  await rm(dataDir, { recursive: true, force: true });
}
