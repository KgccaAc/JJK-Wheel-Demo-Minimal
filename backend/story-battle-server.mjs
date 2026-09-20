import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { buildProfile } from './battle-v3-catalog.mjs';
import { canonicalForSide, createBattle, submitStage } from './battle-v3-resolver.mjs';

const clone = (value) => structuredClone(value);
const object = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const text = (value, fallback = '', max = 120) => String(value ?? fallback).trim().slice(0, max);

function aiInput(state, stage) {
  const actor = state.actors[1];
  if (stage === 'strategy') return { id: 'SteadyButton' };
  if (stage === 'discard') return { ids: [...actor.hand].sort((left, right) => cardUtility(left) - cardUtility(right)).slice(0, 2).map((card) => card.instance_id) };
  if (stage === 'initiative') return { investment: 0 };
  if (stage === 'play') {
    let budget = Number(actor.ce || 0);
    const chosen = [];
    for (const card of [...actor.hand].sort((left, right) => cardUtility(right) - cardUtility(left))) {
      const cost = Math.max(0, Number(card.cost?.ce || card.ceCost || 0));
      if (cost <= budget && chosen.length < 3) { chosen.push(card.instance_id); budget -= cost; }
    }
    return { cards: chosen, domain: '' };
  }
  return {};
}

function cardUtility(card) {
  return Number(card.effect?.damage || card.attack || 0) * 2 + Number(card.effect?.block || card.effect?.guard || 0) + Number(card.effect?.healing || 0) - Number(card.cost?.ce || card.ceCost || 0) * 0.05;
}

function view(record) {
  const state = canonicalForSide(record.state, 0);
  const winner = record.state.phase === 'finished'
    ? record.state.winner === record.state.actors[0].id ? 'player' : record.state.winner === record.state.actors[1].id ? 'enemy' : 'draw'
    : '';
  return { ok: true, battleId: record.battleId, encounterId: record.encounterId, saveId: record.saveId, battleRevision: record.state.revision, state, outcome: winner, finished: record.state.phase === 'finished' };
}

export function createStoryBattleService(options = {}) {
  const dataDir = options.dataDir || process.env.STORY_BATTLE_DATA_DIR || join(process.cwd(), 'backend', '.runtime-battles');
  const statePath = join(dataDir, 'story-battles.json');
  const packagePath = options.packagePath || join(process.cwd(), 'data', 'story', 'story-package.json');
  let contentPackage = options.contentPackage || null;
  let records = {};
  let loaded = false;
  let queue = Promise.resolve();

  async function load() {
    if (loaded) return;
    if (!contentPackage) { try { contentPackage = JSON.parse(await readFile(packagePath, 'utf8')); } catch { contentPackage = {}; } }
    try { records = JSON.parse(await readFile(statePath, 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    records = object(records);
    loaded = true;
  }
  async function persist() {
    await mkdir(dataDir, { recursive: true });
    const temp = `${statePath}.${randomUUID()}.tmp`;
    await writeFile(temp, `${JSON.stringify(records, null, 2)}\n`, 'utf8');
    await rename(temp, statePath);
  }
  async function locked(operation) {
    const previous = queue;
    let release;
    queue = new Promise((resolve) => { release = resolve; });
    await previous;
    try { return await operation(); } finally { release(); }
  }
  const response = (status, body) => ({ status, body: clone(body) });

  async function start(body = {}) {
    await load();
    const encounterId = text(body.encounterId);
    const encounter = contentPackage?.encounters?.[encounterId];
    if (!encounterId || !encounter) return response(422, { ok: false, error: 'battle_encounter_invalid' });
    const playerProfile = Object.keys(object(body.playerProfile)).length ? clone(body.playerProfile) : buildProfile(text(body.characterId, 'yuji_itadori_shibuya'));
    const enemyProfile = Object.keys(object(body.enemyProfile)).length ? clone(body.enemyProfile) : buildProfile(text(body.enemyCharacterId || encounter.enemyCharacterId, 'nanami_kento_shibuya'));
    if (!playerProfile?.id || !enemyProfile?.id) return response(422, { ok: false, error: 'battle_profile_invalid' });
    return locked(async () => {
      const battleId = text(body.battleId, randomUUID());
      if (records[battleId]) return response(200, view(records[battleId]));
      const state = createBattle(playerProfile, enemyProfile, body.seed);
      const enemyHpScale = Math.max(0.1, Math.min(10, Number(encounter.enemyHpScale ?? 1)));
      state.actors[1].maxHp *= enemyHpScale; state.actors[1].hp = state.actors[1].maxHp;
      const record = { battleId, saveId: text(body.saveId, 'web-story-local'), encounterId, createdAt: new Date().toISOString(), state };
      records[battleId] = record;
      await persist();
      return response(200, view(record));
    });
  }

  async function resolveTurn(battleId, body = {}) {
    await load();
    return locked(async () => {
      const record = records[battleId];
      if (!record) return response(404, { ok: false, error: 'battle_not_found' });
      if (Number(body.expectedRevision) !== Number(record.state.revision)) return response(409, { ok: false, error: 'battle_revision_conflict', battleRevision: record.state.revision });
      if (record.state.phase === 'finished') return response(200, view(record));
      const stage = text(body.stage, '', 30);
      if (stage !== record.state.phase) return response(409, { ok: false, error: 'battle_stage_conflict', phase: record.state.phase, battleRevision: record.state.revision });
      const player = submitStage(record.state, 0, stage, object(body.data));
      if (!player.ok) return response(422, { ok: false, error: player.error, phase: record.state.phase, battleRevision: record.state.revision });
      const opponent = submitStage(player.state, 1, stage, aiInput(player.state, stage));
      if (!opponent.ok) return response(500, { ok: false, error: `battle_ai_${opponent.error}` });
      record.state = opponent.state;
      record.updatedAt = new Date().toISOString();
      await persist();
      return response(200, view(record));
    });
  }

  async function handle(request = {}) {
    await load();
    const method = String(request.method || 'GET').toUpperCase();
    const path = String(request.path || '').split('?')[0];
    if (method === 'POST' && path === '/api/battles/start') return start(request.body);
    const resolveMatch = path.match(/^\/api\/battles\/([^/]+)\/resolve$/);
    if (method === 'POST' && resolveMatch) return resolveTurn(decodeURIComponent(resolveMatch[1]), request.body);
    const getMatch = path.match(/^\/api\/battles\/([^/]+)$/);
    if (method === 'GET' && getMatch) {
      const record = records[decodeURIComponent(getMatch[1])];
      return record ? response(200, view(record)) : response(404, { ok: false, error: 'battle_not_found' });
    }
    return response(404, { ok: false, error: 'route_not_found' });
  }
  return { handle, load, paths: { dataDir, statePath } };
}
