import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createAiDialogueService } from '../../backend/ai-dialogue-server.mjs';

const packageData = {
  nodes: {
    current_node: { id: 'current_node', type: 'ai_dialogue', title: '当前节点', tags: ['river'], speakerId: 'npc_alpha', fallbackSetId: 'npc_alpha_fallback', effectPolicyId: 'dialogue_only', maxTurns: 8, completionRoutes: { normal: 'future_node' } },
    future_node: { id: 'future_node', type: 'dialogue', title: '未来隐藏节点', hiddenSecret: 'DO_NOT_SEND_FUTURE_NODE' },
  },
  characters: {
    npc_alpha: {
      id: 'npc_alpha', displayName: '当前NPC', identity: '守桥人',
      personality: ['谨慎', '重视承诺'], speechStyle: '短句、克制', forbiddenBehaviors: ['泄露未来'],
    },
  },
  fallbackDialogues: { npc_alpha_fallback: { id: 'npc_alpha_fallback', npcId: 'npc_alpha', entries: [{ speaker: '当前NPC', text: '回退文本', category: 'default' }] } },
  effectPolicies: { dialogue_only: { allowed: ['relationship.affection', 'relationship.trust', 'relationship.alertness', 'relationship.respect', 'growth.xp'], perTurn: { growthXp: 2 }, perSession: { growthXp: 5, relationship: 12, memoryTags: 5, softFlags: 5 } } },
  worldEntries: {
    future_lore: { id: 'future_lore', content: 'DO_NOT_SEND_FULL_WORLD_PACKAGE', keywords: ['never-match'] },
  },
  sentinel: 'DO_NOT_SEND_FULL_STORY_PACKAGE',
};

const tempDir = await mkdtemp(join(tmpdir(), 'jjk-ai-context-'));
let capturedRequest;
let fetchCalls = 0;
const service = createAiDialogueService({
  apiKey: 'test-key',
  dataDir: tempDir,
  contentPackage: packageData,
  fetchImpl: async (_url, options) => {
    fetchCalls += 1;
    capturedRequest = JSON.parse(options.body);
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ text: '收到。', growth: { xp: 1 } }) } }] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  },
});

try {
  const opened = await service.handle({
    method: 'POST', path: '/api/ai/dialogue/session', body: {
      sessionId: 'context-acceptance', nodeId: 'current_node', npcId: 'npc_alpha',
      context: { nodeId: 'current_node', npcId: 'npc_alpha', chapterId: 'chapter-1' },
    },
  });
  assert.equal(opened.status, 200);

  // Seed more than the six-turn context window; only the latest six may be sent.
  let revision = opened.body.saveRevision;
  for (let index = 0; index < 8; index += 1) {
    const turn = await service.handle({
      method: 'POST', path: '/api/ai/dialogue/turn', body: {
        sessionId: 'context-acceptance', saveRevision: revision,
        input: `历史输入 ${index}`, context: { nodeId: 'future_node', npcId: 'other_npc' },
      },
    });
    assert.equal(turn.status, 200);
    revision = turn.body.saveRevision;
  }

  const body = capturedRequest;
  assert.equal(fetchCalls, 8);
  assert.equal(body.model, 'deepseek-flash');
  const userMessage = body.messages.find((message) => message.role === 'user');
  assert.ok(userMessage, 'DeepSeek request must include a user context message');
  const context = JSON.parse(userMessage.content);

  assert.deepEqual(context.node, { id: 'current_node', type: 'ai_dialogue', title: '当前节点', tags: ['river'], maxTurns: 8 });
  assert.equal(context.npc.id, 'npc_alpha');
  assert.equal(context.npc.displayName, '当前NPC');
  assert.equal(context.npc.identity, '守桥人');
  assert.deepEqual(context.npc.personality, ['谨慎', '重视承诺']);
  assert.equal(context.relationshipState.affection, undefined);
  assert.equal(context.relationshipState.trust, undefined);
  assert.deepEqual(context.memory.tags, []);
  assert.equal(context.recentTurns.length, 6);
  assert.deepEqual(context.recentTurns.map((turn) => turn.input), [
    '历史输入 1', '历史输入 2', '历史输入 3', '历史输入 4', '历史输入 5', '历史输入 6',
  ]);

  // Relationship data must be drawn from the authoritative session state, not guessed from input.
  let relationshipCalls = 0;
  let relationshipContextCapture;
  const relationshipService = createAiDialogueService({
    apiKey: 'test-key', dataDir: `${tempDir}-relationship`, contentPackage: packageData,
    fetchImpl: async (_url, options) => {
      relationshipCalls += 1;
      const request = JSON.parse(options.body);
      const requestContext = JSON.parse(request.messages.find((message) => message.role === 'user').content);
      if (relationshipCalls === 2) relationshipContextCapture = requestContext;
      const proposal = relationshipCalls === 1
        ? { text: '关系发生变化。', relationshipDelta: { npc_alpha: { affection: 2, trust: 1 } } }
        : { text: '关系已读取。' };
      return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(proposal) } }] }), { status: 200 });
    },
  });
  const relationshipOpen = await relationshipService.handle({
    method: 'POST', path: '/api/ai/dialogue/session', body: {
      sessionId: 'relationship-context', nodeId: 'current_node', npcId: 'npc_alpha',
    },
  });
  assert.equal(relationshipOpen.status, 200);
  const relationTurn = await relationshipService.handle({
    method: 'POST', path: '/api/ai/dialogue/turn', body: {
      sessionId: 'relationship-context', saveRevision: relationshipOpen.body.saveRevision,
      input: '建立信任', context: { nodeId: 'current_node', npcId: 'npc_alpha' },
    },
  });
  assert.equal(relationTurn.status, 200);
  const relationReadTurn = await relationshipService.handle({
    method: 'POST', path: '/api/ai/dialogue/turn', body: {
      sessionId: 'relationship-context', saveRevision: relationTurn.body.saveRevision,
      input: '继续交谈', context: { nodeId: 'current_node', npcId: 'npc_alpha' },
    },
  });
  assert.equal(relationReadTurn.status, 200);
  assert.equal(relationshipCalls, 2);
  assert.deepEqual(relationshipContextCapture.relationshipState, { affection: 2, trust: 1 });

  const serialized = JSON.stringify(body);
  assert.equal(serialized.includes('future_node'), false);
  assert.equal(serialized.includes('DO_NOT_SEND_FUTURE_NODE'), false);
  assert.equal(serialized.includes('DO_NOT_SEND_FULL_STORY_PACKAGE'), false);
  assert.equal(serialized.includes('DO_NOT_SEND_FULL_WORLD_PACKAGE'), false);

  // The server-owned session binding must win over client context overrides.
  const limitService = createAiDialogueService({ apiKey: '', dataDir: `${tempDir}-limits`, contentPackage: {
    ...packageData,
    nodes: { current_node: { ...packageData.nodes.current_node, maxTurns: 1 }, future_node: packageData.nodes.future_node },
  } });
  const limitOpen = await limitService.handle({ method: 'POST', path: '/api/ai/dialogue/session', body: { sessionId: 'limit', nodeId: 'current_node', npcId: 'npc_alpha' } });
  assert.equal(limitOpen.status, 200);
  const limitTurn = await limitService.handle({ method: 'POST', path: '/api/ai/dialogue/turn', body: { sessionId: 'limit', saveRevision: 1, input: '第一次', context: { nodeId: 'future_node', npcId: 'other_npc' } } });
  assert.equal(limitTurn.status, 200);
  assert.equal(limitTurn.body.sessionState, 'complete');
  const blockedTurn = await limitService.handle({ method: 'POST', path: '/api/ai/dialogue/turn', body: { sessionId: 'limit', saveRevision: limitTurn.body.saveRevision, input: '第二次' } });
  assert.equal(blockedTurn.status, 409);
  assert.equal(blockedTurn.body.error, 'dialogue_session_closed');

  console.log('AI_CONTEXT_ACCEPTANCE PASS node_npc_bounded=true recent_turns=6 future_nodes_excluded=true full_package_excluded=true');
} finally {
  await rm(tempDir, { recursive: true, force: true });
  await rm(`${tempDir}-relationship`, { recursive: true, force: true });
  await rm(`${tempDir}-limits`, { recursive: true, force: true });
}
