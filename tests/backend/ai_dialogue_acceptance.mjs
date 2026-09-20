import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createAiDialogueService } from '../../backend/ai-dialogue-server.mjs';

const tempDir = process.env.AI_ACCEPTANCE_DATA_DIR || join(tmpdir(), `jjk-ai-acceptance-${process.pid}-${Date.now()}`);

async function request(service, method, path, body) {
  const result = await service.handle({ method, path, body });
  assert.ok(result && typeof result.status === 'number', `${method} ${path} must return an HTTP-like result`);
  return result;
}

async function run() {
  const binding = { nodeId: 'chapter1_ai_contact', npcId: 'junior_sorcerer' };
  const fallback = createAiDialogueService({
    apiKey: '',
    dataDir: tempDir,
    fetchImpl: async () => { throw new Error('fetch should not run without a key'); },
  });
  const status = await request(fallback, 'GET', '/api/ai/status');
  assert.equal(status.status, 200);
  assert.equal(status.body.configured, false);
  assert.equal(status.body.provider, 'deepseek');

  let modelProbeCalls = 0;
  const healthy = createAiDialogueService({
    apiKey: 'test-key', dataDir: `${tempDir}-health`,
    fetchImpl: async (url) => {
      modelProbeCalls += 1;
      assert.match(String(url), /\/models$/);
      return new Response(JSON.stringify({ object: 'list', data: [{ id: 'deepseek-flash', object: 'model', owned_by: 'deepseek' }] }), { status: 200 });
    },
  });
  const healthyStatus = await request(healthy, 'GET', '/api/ai/status');
  assert.equal(healthyStatus.body.modelAvailable, true);
  assert.equal(healthyStatus.body.fallbackMode, false);
  assert.match(healthyStatus.body.lastHealthCheckAt, /^\d{4}-/);
  assert.equal(modelProbeCalls, 1);

  const opened = await request(fallback, 'POST', '/api/ai/dialogue/session', {
    sessionId: 'acceptance-session',
    ...binding,
    context: { slot: 'morning', npcId: 'junior_sorcerer' },
  });
  assert.equal(opened.status, 200);
  assert.equal(opened.body.ok, true);
  assert.equal(opened.body.source, 'local');
  assert.equal(opened.body.saveRevision, 1);

  const turn = await request(fallback, 'POST', '/api/ai/dialogue/turn', {
    sessionId: 'acceptance-session',
    saveRevision: 1,
    input: '我想先观察残秽，再向术师说明。',
    context: { slot: 'morning', npcId: 'junior_sorcerer' },
  });
  assert.equal(turn.status, 200);
  assert.equal(turn.body.source, 'local');
  assert.match(turn.body.text, /接口暂时不可用/, 'network fallback must select the API-unavailable authored category');
  assert.equal(turn.body.saveRevision, 2);

  const stale = await request(fallback, 'POST', '/api/ai/dialogue/turn', {
    sessionId: 'acceptance-session',
    saveRevision: 1,
    input: '旧请求',
  });
  assert.equal(stale.status, 409);
  assert.equal(stale.body.error, 'save_revision_conflict');

  const malformed = createAiDialogueService({
    apiKey: 'test-key',
    dataDir: `${tempDir}-malformed`,
    fetchImpl: async () => new Response(JSON.stringify({
      choices: [{ message: { content: '```json {"text":"bad","resources":{"hp":99},"growth":{"xp":99,"cheat":99},"relationshipDelta":{"unknown":{"affection":99},"junior_sorcerer":{"affection":99}},"emotion":"alert","memoryTags":["residue"],"softFlags":{"noticed_residue":true},"inventoryDelta":{"amulet":1},"nextNode":"cheat"} ```' } }],
    }), { status: 200, headers: { 'content-type': 'application/json' } }),
  });
  await request(malformed, 'POST', '/api/ai/dialogue/session', { sessionId: 'malformed', ...binding });
  const parsed = await request(malformed, 'POST', '/api/ai/dialogue/turn', {
    sessionId: 'malformed', saveRevision: 1, input: '测试', context: { npcId: 'junior_sorcerer' },
  });
  assert.equal(parsed.status, 200);
  assert.equal(parsed.body.source, 'deepseek');
  assert.equal(parsed.body.proposal.growth?.cheat, undefined);
  assert.equal(parsed.body.proposal.relationshipDelta?.unknown, undefined);
  assert.equal(parsed.body.proposal.resources, undefined);
  assert.equal(parsed.body.proposal.growth?.xp, 2);
  assert.equal(parsed.body.proposal.relationshipDelta.junior_sorcerer.affection, 3);
  assert.equal(parsed.body.memoryUpdates.tags[0], 'residue');
  assert.equal(parsed.body.state.growthXp, 2);
  assert.equal(parsed.body.state.relationships.junior_sorcerer.affection, 3);
  assert.equal(parsed.body.state.memoryTags[0], 'residue');
  assert.ok(parsed.body.rejectedEffects.some((entry) => entry.field === 'resources.hp'));
  assert.ok(parsed.body.rejectedEffects.some((entry) => entry.field === 'inventoryDelta'));
  assert.ok(parsed.body.rejectedEffects.some((entry) => entry.field === 'nextNode'));

  const key = process.env.DEEPSEEK_API_KEY || '';
  const live = createAiDialogueService({ apiKey: key, dataDir: `${tempDir}-live` });
  await request(live, 'POST', '/api/ai/dialogue/session', { sessionId: 'live', ...binding });
  const liveTurn = await request(live, 'POST', '/api/ai/dialogue/turn', { sessionId: 'live', saveRevision: 1, input: '请用一句话回应。' });
  assert.equal(liveTurn.status, 200);
  assert.ok(['deepseek', 'local'].includes(liveTurn.body.source));
  if (key) assert.equal(liveTurn.body.ok, true);

  console.log('AI_DIALOGUE_ACCEPTANCE PASS fallback=true malformed_json_sanitized=true stale_revision=true live_key=%s', Boolean(key));
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
