import { randomUUID } from 'node:crypto';
import { appendFile, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { buildAiContext } from './story-ai-context.mjs';

const SCHEMA = 'jjk-ai-dialogue-v1';
const DEFAULT_BASE_URL = 'https://api.deepseek.com';
const DEFAULT_MODEL = 'deepseek-flash';
const DEFAULT_TIMEOUT_MS = 12_000;
const MAX_TEXT = 800;
const SESSION_XP_LIMIT = 5;
const SESSION_RELATION_LIMIT = 12;
const RELATION_KEYS = new Set(['affection', 'trust', 'alertness', 'respect']);
const RELATION_LIMITS = Object.freeze({ affection: 3, trust: 3, alertness: 2, respect: 3 });

const clone = (value) => structuredClone(value);
const isObject = (value) => value && typeof value === 'object' && !Array.isArray(value);
const text = (value, fallback = '', max = 160) => String(value ?? fallback).trim().slice(0, max);
const integer = (value, fallback = 0) => Number.isFinite(Number(value)) ? Math.trunc(Number(value)) : fallback;

function projectRoot() {
  const cwd = resolve(process.env.STORY_PROJECT_ROOT || process.cwd());
  return cwd.endsWith('backend') ? resolve(cwd, '..') : cwd;
}

// Resolve the DeepSeek API key.
//
// Only three sources are accepted, in order:
//   1. an explicit `apiKey` option (tests / programmatic callers)
//   2. the DEEPSEEK_API_KEY environment variable
//   3. an explicitly configured key file via DEEPSEEK_KEY_FILE / `keyFile`
//
// Do NOT reintroduce implicit fallbacks to well-known desktop paths: a file on
// the desktop is easy to leak through screenshots, screen sharing, backups and
// cloud sync, and an implicit read makes the exposure silent. If a key file is
// ever needed, it must be opted into explicitly.
function configuredKey(options) {
  if (Object.hasOwn(options, 'apiKey')) return text(options.apiKey, '', 512);
  const fromEnv = text(process.env.DEEPSEEK_API_KEY, '', 512);
  if (fromEnv) return fromEnv;
  const keyFile = options.keyFile || process.env.DEEPSEEK_KEY_FILE || '';
  if (!keyFile) return '';
  try { return text(readFileSync(keyFile, 'utf8'), '', 512); } catch { return ''; }
}

function localText(input, context, npcId) {
  const phrase = text(input, '你的行动让现场的空气安静了一瞬。', 160);
  const slot = text(context?.slot || context?.timeSlot, '当前时段', 30);
  const prefix = npcId ? `${npcId} 观察着你的动作。` : '同行者观察着你的动作。';
  return `${prefix} ${slot}的残秽仍未散去；你选择“${phrase}”，先把呼吸和判断稳住。`;
}

function fallbackCategory(input, context, npcId, reason = '') {
  const value = text(input, '', 300).toLowerCase();
  if (reason && reason !== 'opening') return 'api_unavailable';
  if (!value) return 'greeting';
  if (/(结束|再见|先这样|离开|告辞|bye|stop)/i.test(value)) return 'player_end';
  if (/^(\?|？|不懂|不知道|啥|什么)$/i.test(value)) return 'cannot_understand';
  const relation = context?.relationships?.[npcId] || context?.relationshipState || context?.relationship || {};
  const score = ['affection', 'trust', 'respect'].reduce((sum, key) => sum + integer(relation?.[key], 0), 0) - Math.max(0, integer(relation?.alertness, 0));
  if (score >= 8) return 'friendly';
  if (score <= -3) return 'hostile';
  if (/[？?]|为什么|怎么|能否|可以|请问/.test(value)) return 'followup';
  if (/拒绝|不说|不能|不行/.test(value)) return 'refusal';
  return 'default';
}

function fallbackText(contentPackage, fallbackSetId, input, context, npcId, turnIndex = 0, reason = 'opening') {
  const entries = Array.isArray(contentPackage?.fallbackDialogues?.[fallbackSetId]?.entries)
    ? contentPackage.fallbackDialogues[fallbackSetId].entries : [];
  const category = fallbackCategory(input, context, npcId, reason);
  const categorized = entries.filter((entry) => entry?.category === category && entry?.speaker && entry.speaker !== '玩家');
  const usable = categorized.length ? categorized : entries.filter((entry) => entry?.category === 'default' && entry?.speaker && entry.speaker !== '玩家');
  if (usable.length) return text(usable[turnIndex % usable.length].text, localText(input, context, npcId), MAX_TEXT);
  return localText(input, context, npcId);
}

function localProposal(input, context, npcId) {
  const value = text(input, '', 300).toLowerCase();
  const proposal = {
    text: localText(input, context, npcId),
    resources: {},
    growth: {},
    relationshipDelta: {},
  };
  if (value.includes('休息') || value.includes('恢复') || value.includes('rest')) {
    proposal.growth = { xp: 1 };
  } else if (value.includes('观察') || value.includes('搜索') || value.includes('调查') || value.includes('observe')) {
    proposal.growth = { xp: 2 };
  } else if (value.includes('交谈') || value.includes('帮助') || value.includes('说明') || value.includes('talk')) {
    proposal.growth = { xp: 1 };
    if (npcId) proposal.relationshipDelta = { [npcId]: { trust: 1, respect: 1 } };
  } else {
    proposal.growth = { xp: 1 };
  }
  return proposal;
}

function parseStructuredJson(content) {
  if (isObject(content)) return clone(content);
  let source = String(content ?? '').trim();
  source = source.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  try { return JSON.parse(source); } catch { /* Find an object wrapped in prose. */ }
  const start = source.indexOf('{');
  const end = source.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('deepseek_json_invalid');
  try { return JSON.parse(source.slice(start, end + 1)); } catch { throw new Error('deepseek_json_invalid'); }
}

function sanitizeProposal(raw, npcId) {
  if (!isObject(raw)) throw new Error('proposal_not_object');
  const result = { appliedEffects: [], rejectedEffects: [], memoryUpdates: { tags: [], softFlags: {} } };
  const recognized = new Set(['text', 'dialogue', 'narrative', 'resources', 'resourceDelta', 'growth', 'growthDelta', 'relationshipDelta', 'relationship_delta', 'emotion', 'temporaryEmotion', 'temporary_emotion', 'memoryTags', 'memory_tags', 'softFlags', 'soft_flags']);
  for (const key of Object.keys(raw)) if (!recognized.has(key)) result.rejectedEffects.push({ field: key, reason: 'effect_not_allowed' });
  const narrative = text(raw.text || raw.dialogue || raw.narrative, '', MAX_TEXT);
  if (narrative) result.text = narrative;
  const resources = isObject(raw.resources || raw.resourceDelta) ? (raw.resources || raw.resourceDelta) : {};
  for (const key of Object.keys(resources)) result.rejectedEffects.push({ field: `resources.${key}`, reason: 'resource_effects_disabled' });
  const growth = isObject(raw.growth || raw.growthDelta) ? (raw.growth || raw.growthDelta) : {};
  const cleanGrowth = {};
  for (const key of Object.keys(growth)) {
    if (key === 'xp') {
      const value = Math.max(0, Math.min(2, integer(growth[key])));
      cleanGrowth.xp = value;
      result.appliedEffects.push({ field: 'growth.xp', value });
    } else result.rejectedEffects.push({ field: `growth.${key}`, reason: 'growth_key_disabled' });
  }
  if (Object.keys(cleanGrowth).length) result.growth = cleanGrowth;
  const relation = isObject(raw.relationshipDelta || raw.relationship_delta) ? (raw.relationshipDelta || raw.relationship_delta) : {};
  if (npcId && isObject(relation[npcId])) {
    const cleanRelation = {};
    for (const key of Object.keys(relation[npcId])) if (RELATION_KEYS.has(key)) {
      const limit = RELATION_LIMITS[key];
      const value = Math.max(-limit, Math.min(limit, integer(relation[npcId][key])));
      cleanRelation[key] = value;
      result.appliedEffects.push({ field: `relationshipDelta.${npcId}.${key}`, value });
    } else result.rejectedEffects.push({ field: `relationshipDelta.${npcId}.${key}`, reason: 'relationship_key_disabled' });
    if (Object.keys(cleanRelation).length) result.relationshipDelta = { [npcId]: cleanRelation };
  } else for (const key of Object.keys(relation)) result.rejectedEffects.push({ field: `relationshipDelta.${key}`, reason: 'only_current_npc_allowed' });
  const emotion = text(raw.emotion || raw.temporaryEmotion || raw.temporary_emotion, '', 80);
  if (emotion) { result.emotion = emotion; result.appliedEffects.push({ field: 'emotion', value: emotion }); }
  const rawTags = Array.isArray(raw.memoryTags || raw.memory_tags) ? (raw.memoryTags || raw.memory_tags) : [];
  const tags = [];
  for (const value of rawTags) {
    const tag = text(value, '', 40);
    if (tag && !tags.includes(tag) && tags.length < 5) tags.push(tag);
    else if (tag) result.rejectedEffects.push({ field: 'memoryTags', value: tag, reason: 'memory_tag_limit' });
  }
  const softFlags = isObject(raw.softFlags || raw.soft_flags) ? (raw.softFlags || raw.soft_flags) : {};
  for (const key of Object.keys(softFlags)) {
    if (!/^[a-zA-Z0-9_:-]{1,40}$/.test(key) || typeof softFlags[key] !== 'boolean') {
      result.rejectedEffects.push({ field: `softFlags.${key}`, reason: 'soft_flag_invalid' });
    } else if (Object.keys(result.memoryUpdates.softFlags).length < 5) {
      result.memoryUpdates.softFlags[key] = softFlags[key];
      result.appliedEffects.push({ field: `softFlags.${key}`, value: softFlags[key] });
    } else result.rejectedEffects.push({ field: `softFlags.${key}`, reason: 'soft_flag_limit' });
  }
  result.memoryUpdates.tags = tags;
  if (tags.length) result.appliedEffects.push({ field: 'memoryTags', value: tags });
  if (!result.memoryUpdates.tags.length && !Object.keys(result.memoryUpdates.softFlags).length) delete result.memoryUpdates;
  if (!result.text) throw new Error('proposal_text_required');
  return result;
}

function fallbackResult(input, context, npcId, reason, contentPackage, fallbackSetId, turnIndex = 0) {
  const raw = localProposal(input, context, npcId);
  raw.text = fallbackText(contentPackage, fallbackSetId, input, context, npcId, turnIndex, reason);
  const proposal = sanitizeProposal(raw, npcId);
  return { source: 'local', fallback: true, fallbackReason: text(reason, 'deepseek_unavailable', 80), proposal };
}

function applyAuthoritativeEffects(session, proposal) {
  const applied = [];
  const rejected = [...(proposal.rejectedEffects || [])];
  const effects = session.effects;
  const policy = session.policy || {};
  const perTurn = policy.perTurn || {};
  const perSession = policy.perSession || {};
  const defaultAllowed = ['growth.xp', 'emotion', 'memoryTags', 'softFlags', ...[...RELATION_KEYS].map((key) => `relationship.${key}`)];
  const allowed = new Set(Array.isArray(policy.allowed) ? policy.allowed : defaultAllowed);
  const xp = Math.max(0, Math.min(Math.max(0, integer(perTurn.growthXp, 2)), integer(proposal.growth?.xp, 0)));
  const sessionXpLimit = Math.max(0, integer(perSession.growthXp, SESSION_XP_LIMIT));
  if (xp > 0 && allowed.has('growth.xp')) {
    const next = Math.min(sessionXpLimit, effects.growthXp + xp);
    if (next !== effects.growthXp) applied.push({ field: 'growth.xp', value: next - effects.growthXp });
    if (next < effects.growthXp + xp) rejected.push({ field: 'growth.xp', reason: 'session_growth_limit' });
    effects.growthXp = next;
  }
  const relation = proposal.relationshipDelta?.[session.npcId] || {};
  const current = effects.relationships[session.npcId] || {};
  const nextRelation = { ...current };
  const relationTurnLimit = Math.max(0, integer(perTurn.relationship, RELATION_LIMITS.affection));
  const relationSessionLimit = Math.max(0, integer(perSession.relationship, SESSION_RELATION_LIMIT));
  for (const [key, delta] of Object.entries(relation)) {
    if (!allowed.has(`relationship.${key}`)) { rejected.push({ field: `relationshipDelta.${session.npcId}.${key}`, reason: 'effect_not_allowed' }); continue; }
    const old = integer(nextRelation[key], 0);
    const boundedDelta = Math.max(-relationTurnLimit, Math.min(relationTurnLimit, integer(delta)));
    const next = Math.max(-relationSessionLimit, Math.min(relationSessionLimit, old + boundedDelta));
    if (next !== old) applied.push({ field: `relationshipDelta.${session.npcId}.${key}`, value: next - old });
    if (next !== old + integer(delta)) rejected.push({ field: `relationshipDelta.${session.npcId}.${key}`, reason: 'policy_limit' });
    nextRelation[key] = next;
  }
  if (Object.keys(nextRelation).length) effects.relationships[session.npcId] = nextRelation;
  if (proposal.emotion && allowed.has('emotion')) { effects.emotion = proposal.emotion; applied.push({ field: 'emotion', value: proposal.emotion }); }
  const memory = proposal.memoryUpdates || {};
  const memoryTagLimit = Math.max(0, integer(perSession.memoryTags, 5));
  const softFlagLimit = Math.max(0, integer(perSession.softFlags, 5));
  for (const tag of memory.tags || []) if (allowed.has('memoryTags') && !effects.memoryTags.includes(tag) && effects.memoryTags.length < memoryTagLimit) { effects.memoryTags.push(tag); applied.push({ field: 'memoryTags', value: tag }); }
  for (const [key, value] of Object.entries(memory.softFlags || {})) if (allowed.has('softFlags') && (Object.hasOwn(effects.softFlags, key) || Object.keys(effects.softFlags).length < softFlagLimit)) { effects.softFlags[key] = value; applied.push({ field: `softFlags.${key}`, value }); }
  return { appliedEffects: applied, rejectedEffects: rejected, state: clone(effects) };
}

function endpointFor(baseUrl) {
  const base = text(baseUrl, DEFAULT_BASE_URL, 300).replace(/\/+$/, '');
  return base.endsWith('/chat/completions') ? base : `${base}/chat/completions`;
}

function createTimeoutSignal(timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return { signal: controller.signal, clear: () => clearTimeout(timer) };
}

export function createAiDialogueService(options = {}) {
  const apiKey = configuredKey(options);
  const baseUrl = text(options.baseUrl ?? process.env.DEEPSEEK_BASE_URL, DEFAULT_BASE_URL, 300);
  const model = text(options.model ?? process.env.DEEPSEEK_MODEL, DEFAULT_MODEL, 120) || DEFAULT_MODEL;
  const timeoutMs = Math.max(500, integer(options.timeoutMs ?? process.env.DEEPSEEK_TIMEOUT_MS, DEFAULT_TIMEOUT_MS));
  const root = projectRoot();
  const dataDir = options.dataDir || process.env.AI_DIALOGUE_DATA_DIR || join(root, 'backend', '.runtime-ai');
  const packagePath = options.packagePath || join(root, 'data', 'story', 'story-package.json');
  const statePath = join(dataDir, 'dialogue-sessions.json');
  const ledgerPath = join(dataDir, 'dialogue-events.jsonl');
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const locks = new Map();
  let state = { schema: SCHEMA, sessions: {} };
  let loaded = false;
  let loadPromise;
  let contentPackage = options.contentPackage || null;
  let modelHealth = { modelAvailable: false, fallbackMode: !apiKey, rateLimited: false, lastHealthCheckAt: null };

  async function load() {
    if (loaded) return;
    if (!loadPromise) loadPromise = readFile(statePath, 'utf8').then((raw) => {
      const parsed = JSON.parse(raw);
      if (isObject(parsed) && isObject(parsed.sessions)) state = parsed;
    }).catch((error) => { if (error.code !== 'ENOENT') throw error; }).then(async () => {
      if (!contentPackage) { try { contentPackage = JSON.parse(await readFile(packagePath, 'utf8')); } catch { contentPackage = {}; } }
    }).finally(() => { loaded = true; });
    await loadPromise;
  }

  async function persist() {
    await mkdir(dataDir, { recursive: true });
    const tempPath = `${statePath}.${randomUUID()}.tmp`;
    await writeFile(tempPath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
    await rename(tempPath, statePath);
  }

  async function ledger(event) {
    await mkdir(dataDir, { recursive: true });
    await appendFile(ledgerPath, `${JSON.stringify(event)}\n`, 'utf8');
  }

  async function withLock(sessionId, operation) {
    const previous = locks.get(sessionId) || Promise.resolve();
    let release;
    const current = new Promise((resolve) => { release = resolve; });
    locks.set(sessionId, current);
    await previous;
    try { return await operation(); } finally { release(); if (locks.get(sessionId) === current) locks.delete(sessionId); }
  }

  function response(status, body) { return { status, body: clone(body) }; }

  async function probeModel() {
    if (!apiKey || typeof fetchImpl !== 'function') {
      modelHealth = { modelAvailable: false, fallbackMode: true, rateLimited: false, lastHealthCheckAt: new Date().toISOString() };
      return modelHealth;
    }
    const timer = createTimeoutSignal(Math.min(timeoutMs, 5_000));
    try {
      const root = baseUrl.replace(/\/+$/, '').replace(/\/chat\/completions$/i, '');
      const result = await fetchImpl(`${root}/models`, { method: 'GET', signal: timer.signal, headers: { authorization: `Bearer ${apiKey}` } });
      const payload = result.ok ? await result.json() : {};
      const available = result.ok && Array.isArray(payload?.data) && payload.data.some((entry) => entry?.id === model);
      modelHealth = { modelAvailable: available, fallbackMode: !available, rateLimited: Number(result.status) === 429, lastHealthCheckAt: new Date().toISOString() };
    } catch {
      modelHealth = { modelAvailable: false, fallbackMode: true, rateLimited: false, lastHealthCheckAt: new Date().toISOString() };
    } finally { timer.clear(); }
    return modelHealth;
  }

  function validateBinding(body = {}) {
    const nodeId = text(body.nodeId, '', 120);
    const npcId = text(body.npcId, '', 100);
    if (!nodeId || !npcId) return { error: 'ai_binding_required' };
    const node = contentPackage?.nodes?.[nodeId];
    if (!node || node.type !== 'ai_dialogue') return { error: 'ai_node_invalid' };
    if (String(node.speakerId || '') !== npcId) return { error: 'ai_speaker_mismatch' };
    if (!node.fallbackSetId || !contentPackage?.fallbackDialogues?.[node.fallbackSetId]) return { error: 'ai_fallback_missing' };
    if (!node.effectPolicyId || !contentPackage?.effectPolicies?.[node.effectPolicyId]) return { error: 'ai_policy_missing' };
    for (const route of Object.values(node.completionRoutes || {})) if (route && !contentPackage.nodes[route]) return { error: 'ai_route_invalid' };
    return { node, nodeId, npcId, policy: clone(contentPackage.effectPolicies[node.effectPolicyId]) };
  }

  async function callDeepSeek(session, input, context) {
    if (!apiKey || typeof fetchImpl !== 'function') throw new Error('deepseek_not_configured');
    const timer = createTimeoutSignal(timeoutMs);
    try {
      const result = await fetchImpl(endpointFor(baseUrl), {
        method: 'POST',
        signal: timer.signal,
        headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          model,
          temperature: 0.7,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: '你是剧情对白助手。只输出 JSON：{"text":string,"growth":{"xp":0..2},"relationshipDelta":object,"emotion":string,"memoryTags":string[],"softFlags":object}。文本不超过800字；每回合只能建议当前 NPC 的小幅 affection/trust/alertness/respect 变化、临时 emotion、记忆 tags/soft flags 和 0..2 XP。不得改资源 hp/ce/money、核心成长、物品、战斗胜负或节点跳转。' },
            { role: 'user', content: JSON.stringify(buildAiContext({ packageData: contentPackage, session, input, context })) },
          ],
        }),
      });
      if (!result || result.ok === false || Number(result.status || 200) >= 400) throw new Error(`deepseek_http_${result?.status || 500}`);
      const payload = await result.json();
      const content = payload?.choices?.[0]?.message?.content;
      return sanitizeProposal(parseStructuredJson(content), session.npcId);
    } finally { timer.clear(); }
  }

  async function openSession(body = {}) {
    await load();
    const binding = validateBinding(body);
    if (binding.error) return response(422, { ok: false, error: binding.error });
    const sessionId = text(body.sessionId, randomUUID(), 100);
    return withLock(sessionId, async () => {
      if (state.sessions[sessionId]) return response(200, { ok: true, ...state.sessions[sessionId], resumed: true });
      const now = new Date().toISOString();
      const session = {
        schema: SCHEMA, sessionId, saveId: text(body.saveId, '', 100), nodeId: binding.nodeId, npcId: binding.npcId, fallbackSetId: binding.node.fallbackSetId, effectPolicyId: binding.node.effectPolicyId, maxTurns: Math.max(1, Math.min(8, integer(binding.node.maxTurns, 1))), policy: binding.policy, context: isObject(body.context) ? clone(body.context) : {},
        startedAt: now, updatedAt: now, status: 'active', saveRevision: 1, history: [], events: [],
        effects: { growthXp: 0, relationships: {}, emotion: 'neutral', memoryTags: [], softFlags: {} },
      };
      const opening = sanitizeProposal({ text: fallbackText(contentPackage, session.fallbackSetId, '', session.context, session.npcId, 0) }, session.npcId);
      const authoritative = { appliedEffects: [], rejectedEffects: [], state: clone(session.effects) };
      const event = { id: randomUUID(), type: 'session_started', at: now, source: 'local', text: opening.text, appliedEffects: [], rejectedEffects: [] };
      session.events.push(event);
      state.sessions[sessionId] = session;
      await persist(); await ledger({ ...event, sessionId });
      return response(200, { ok: true, sessionId, npcId: session.npcId, status: session.status, sessionState: 'active', source: 'local', text: opening.text, message: opening.text, proposal: opening, appliedEffects: authoritative.appliedEffects, rejectedEffects: authoritative.rejectedEffects, memoryUpdates: opening.memoryUpdates || { tags: [], softFlags: {} }, state: authoritative.state, saveRevision: session.saveRevision, event });
    });
  }

  async function turn(body = {}) {
    await load();
    const sessionId = text(body.sessionId, '', 100);
    if (!sessionId) return response(400, { ok: false, error: 'session_id_required' });
    return withLock(sessionId, async () => {
      const session = state.sessions[sessionId];
      if (!session) return response(404, { ok: false, error: 'dialogue_session_not_found' });
      session.effects ||= { growthXp: 0, relationships: {}, emotion: 'neutral', memoryTags: [], softFlags: {} };
      const expected = integer(body.saveRevision ?? body.expectedSaveRevision, -1);
      if (expected !== session.saveRevision) return response(409, { ok: false, error: 'save_revision_conflict', saveRevision: session.saveRevision });
      if (session.status !== 'active') return response(409, { ok: false, error: 'dialogue_session_closed', saveRevision: session.saveRevision });
      if (session.history.length >= Math.max(1, integer(session.maxTurns, 1))) {
        session.status = 'ended';
        return response(409, { ok: false, error: 'dialogue_session_closed', saveRevision: session.saveRevision, sessionState: 'complete' });
      }
      const input = text(body.input ?? body.playerInput ?? body.message, '', 600);
      if (!input) return response(422, { ok: false, error: 'dialogue_input_required', saveRevision: session.saveRevision });
      const context = { ...session.context, ...(isObject(body.context) ? clone(body.context) : {}) };
      let result;
      try { result = { source: 'deepseek', fallback: false, proposal: await callDeepSeek(session, input, context) }; }
      catch (error) { result = fallbackResult(input, context, session.npcId, error?.message, contentPackage, session.fallbackSetId, session.history.length); }
      const now = new Date().toISOString();
      const authoritative = applyAuthoritativeEffects(session, result.proposal);
      const event = { id: randomUUID(), type: 'dialogue_turn', at: now, source: result.source, input, text: result.proposal.text, proposal: clone(result.proposal), appliedEffects: authoritative.appliedEffects, rejectedEffects: authoritative.rejectedEffects };
      session.history.push({ input, ...clone(result.proposal), source: result.source, at: now });
      const complete = session.history.length >= Math.max(1, integer(session.maxTurns, 1));
      session.events.push(event); session.saveRevision += 1; session.updatedAt = now;
      if (complete) session.status = 'ended';
      await persist(); await ledger({ ...event, sessionId });
      return response(200, { ok: true, sessionId, source: result.source, fallback: result.fallback, fallbackReason: result.fallbackReason, sessionState: complete ? 'complete' : 'active', text: result.proposal.text, message: result.proposal.text, emotion: result.proposal.emotion, proposal: result.proposal, appliedEffects: authoritative.appliedEffects, rejectedEffects: authoritative.rejectedEffects, memoryUpdates: result.proposal.memoryUpdates || { tags: [], softFlags: {} }, state: authoritative.state, saveRevision: session.saveRevision, event });
    });
  }

  async function end(body = {}) {
    await load();
    const sessionId = text(body.sessionId, '', 100);
    if (!sessionId) return response(400, { ok: false, error: 'session_id_required' });
    return withLock(sessionId, async () => {
      const session = state.sessions[sessionId];
      if (!session) return response(404, { ok: false, error: 'dialogue_session_not_found' });
      const expected = integer(body.saveRevision ?? body.expectedSaveRevision, -1);
      if (expected !== session.saveRevision) return response(409, { ok: false, error: 'save_revision_conflict', saveRevision: session.saveRevision });
      if (session.status !== 'active') return response(200, { ok: true, sessionId, status: session.status, saveRevision: session.saveRevision, events: session.events });
      const now = new Date().toISOString();
      const event = { id: randomUUID(), type: 'session_ended', at: now, source: 'local', text: '这段对话已保存为一次经历。' };
      session.events.push(event); session.status = 'ended'; session.saveRevision += 1; session.updatedAt = now;
      await persist(); await ledger({ ...event, sessionId });
      return response(200, { ok: true, sessionId, status: session.status, sessionState: 'complete', saveRevision: session.saveRevision, events: session.events, state: clone(session.effects), event });
    });
  }

  async function handle(request) {
    const method = String(request?.method || 'GET').toUpperCase();
    const path = String(request?.path || '').split('?')[0];
    if (method === 'GET' && path === '/api/ai/status') {
      const health = await probeModel();
      return response(200, {
        ok: true,
        schema: SCHEMA,
        provider: 'deepseek',
        configured: Boolean(apiKey),
        enabled: Boolean(apiKey),
        model,
        modelAvailable: health.modelAvailable,
        fallbackMode: health.fallbackMode,
        rateLimited: health.rateLimited,
        lastHealthCheckAt: health.lastHealthCheckAt,
        capabilities: { structuredJson: true, fallback: true, dialogueLedger: true, controlledProposals: true },
      });
    }
    if (method === 'POST' && path === '/api/ai/dialogue/session') return openSession(request.body);
    if (method === 'POST' && path === '/api/ai/dialogue/turn') return turn(request.body);
    if (method === 'POST' && path === '/api/ai/dialogue/end') return end(request.body);
    return response(404, { ok: false, error: 'route_not_found' });
  }

  return { handle, load, paths: { dataDir, statePath, ledgerPath } };
}

export const aiDialogueConstants = Object.freeze({ SCHEMA, DEFAULT_BASE_URL, DEFAULT_MODEL });
