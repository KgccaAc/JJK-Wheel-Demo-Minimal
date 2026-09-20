import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createStoryBattleService } from '../../backend/story-battle-server.mjs';

const dataDir = await mkdtemp(join(tmpdir(), 'jjk-story-battle-'));
const cards = (owner, damage = 18) => Array.from({ length: 10 }, (_, index) => ({
  id: `${owner}-card-${index}`, actionId: `${owner}_card_${index}`, name: `${owner}牌${index + 1}`,
  type: 'basic', tags: [], playableInHandBeta: true, contexts: ['normal'], cost: { ce: 0 }, effect: { damage: owner === 'enemy' ? (index === 9 ? 50 : 0) : damage, special: { atomicEffects: [] } },
}));
const profile = (id, damage) => ({ id, name: id, hp: 80, maxHp: 80, ce: 100, maxCe: 100, cards: cards(id, damage) });
const contentPackage = { encounters: { encounter_test: { id: 'encounter_test' } } };

try {
  let service = createStoryBattleService({ dataDir, contentPackage });
  const opened = await service.handle({ method: 'POST', path: '/api/battles/start', body: {
    saveId: 'save-1', encounterId: 'encounter_test', playerProfile: profile('player', 40), enemyProfile: profile('enemy', 1), seed: 7,
  } });
  assert.equal(opened.status, 200, JSON.stringify(opened.body));
  assert.equal(opened.body.state.phase, 'OPENING_STRATEGY');
  const battleId = opened.body.battleId;
  let revision = opened.body.battleRevision;

  const act = async (stage, data) => {
    const result = await service.handle({ method: 'POST', path: `/api/battles/${battleId}/resolve`, body: { expectedRevision: revision, stage, data } });
    assert.equal(result.status, 200, JSON.stringify(result.body));
    revision = result.body.battleRevision;
    return result.body;
  };
  let result = await act('strategy', { id: 'SteadyButton' });
  assert.equal(result.state.phase, 'DISCARD');
  assert.equal(result.state.actors[0].zones.hand.length, 10);
  result = await act('discard', { ids: result.state.actors[0].zones.hand.slice(0, 2).map((card) => card.instance_id) });
  assert.equal(result.state.phase, 'INITIATIVE');
  result = await act('initiative', { investment: 0 });
  assert.equal(result.state.phase, 'PLAY');
  result = await act('play', { cards: [result.state.actors[0].zones.hand[0].instance_id], domain: '' });
  assert.ok(['DISCARD', 'FINISHED'].includes(result.state.phase));
  assert.ok(result.state.events.some((event) => event.side === 0), 'real V3 round event must be returned');
  assert.ok(result.state.events.find((event) => event.side === 1)?.results?.some((item) => item.cardName === 'enemy牌10'), 'AI must choose a useful affordable action');

  service = createStoryBattleService({ dataDir, contentPackage });
  const resumed = await service.handle({ method: 'GET', path: `/api/battles/${battleId}`, body: {} });
  assert.equal(resumed.status, 200);
  assert.equal(resumed.body.battleRevision, revision);
  assert.equal(resumed.body.state.phase, result.state.phase);

  const stale = await service.handle({ method: 'POST', path: `/api/battles/${battleId}/resolve`, body: { expectedRevision: 1, stage: 'discard', data: { ids: [] } } });
  assert.equal(stale.status, 409);
  assert.equal(stale.body.error, 'battle_revision_conflict');
  console.log(`STORY_BATTLE_ACCEPTANCE PASS battle=${battleId} phase=${result.state.phase} revision=${revision}`);
} finally { await rm(dataDir, { recursive: true, force: true }); }
