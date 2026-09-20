import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createStoryBattleService } from '../backend/story-battle-server.mjs';
import { BattleClient } from '../web-runtime/battle-client.mjs';

const dataDir = await mkdtemp(join(tmpdir(), 'jjk-web-battle-'));
const profile = (id) => ({ id, hp: 100, maxHp: 100, ce: 100, maxCe: 100, cards: Array.from({ length: 10 }, (_, index) => ({ id: `${id}-${index}`, actionId: `${id}_${index}`, name: `牌${index}`, type: 'basic', cost: { ce: 0 }, effect: { damage: 1, special: { atomicEffects: [] } } })) });
const service = createStoryBattleService({ dataDir, contentPackage: { encounters: { encounter_test: { id: 'encounter_test' } } } });
const fetchImpl = async (url, options = {}) => {
  const path = new URL(url, 'http://battle.local').pathname;
  const result = await service.handle({ method: options.method || 'GET', path, body: options.body ? JSON.parse(options.body) : {} });
  return new Response(JSON.stringify(result.body), { status: result.status, headers: { 'content-type': 'application/json' } });
};
try {
  const client = new BattleClient({ fetchImpl });
  const opened = await client.start({ saveId: 'save', encounterId: 'encounter_test', playerProfile: profile('player'), enemyProfile: profile('enemy') });
  assert.equal(opened.state.phase, 'OPENING_STRATEGY');
  await client.submit('strategy', { id: 'SteadyButton' });
  assert.equal(client.state.phase, 'DISCARD');
  const snapshot = client.snapshot();
  const resumed = new BattleClient({ fetchImpl, snapshot });
  await resumed.resume();
  assert.equal(resumed.battleId, opened.battleId);
  assert.equal(resumed.state.phase, 'DISCARD');
  console.log('WEB_BATTLE_CLIENT PASS start=true resume=true');
} finally { await rm(dataDir, { recursive: true, force: true }); }
