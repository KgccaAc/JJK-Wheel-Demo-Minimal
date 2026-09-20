import assert from 'node:assert/strict';
import { createBattle, submitStage } from '../../backend/battle-v3-resolver.mjs';

const opponentCard = {
  id: 'acceptance-opponent-card',
  actionId: 'acceptance_opponent_card',
  name: '联机对方术式',
  type: 'technique',
  cost: { ce: 0 },
  effect: { damage: 0 },
};
const playerCard = {
  id: 'acceptance-player-card',
  actionId: 'acceptance_player_card',
  name: '本地测试牌',
  type: 'basic',
  cost: { ce: 0 },
  effect: { damage: 0 },
};
const profile = (id, card) => ({
  id,
  name: id,
  hp: 100,
  maxHp: 100,
  ce: 100,
  maxCe: 100,
  cards: [card],
});

let state = createBattle(profile('player', playerCard), profile('opponent', opponentCard), 'acceptance-seed');
state = submitStage(state, 0, 'strategy', { id: 'default' }).state;
state = submitStage(state, 1, 'strategy', { id: 'default' }).state;
const playerHand = state.actors[0].hand;
const opponentHand = state.actors[1].hand;
const playerPlayed = playerHand.find((card) => card.id === playerCard.id);
const opponentPlayed = opponentHand.find((card) => card.id === opponentCard.id);
assert.ok(playerPlayed?.instance_id, 'player test card was not dealt');
assert.ok(opponentPlayed?.instance_id, 'opponent test card was not dealt');

state = submitStage(state, 0, 'discard', { ids: playerHand.filter((card) => card.instance_id !== playerPlayed.instance_id).slice(0, 2).map((card) => card.instance_id) }).state;
state = submitStage(state, 1, 'discard', { ids: opponentHand.filter((card) => card.instance_id !== opponentPlayed.instance_id).slice(0, 2).map((card) => card.instance_id) }).state;
state = submitStage(state, 0, 'initiative', { investment: 0 }).state;
state = submitStage(state, 1, 'initiative', { investment: 0 }).state;
state = submitStage(state, 0, 'play', { cards: [playerPlayed.instance_id], domain: '' }).state;
const result = submitStage(state, 1, 'play', { cards: [opponentPlayed.instance_id], domain: '' });
assert.equal(result.ok, true, JSON.stringify(result));
const opponentAction = result.state.events.find((event) => event.side === 1);
assert.equal(opponentAction.results[0].cardName, '联机对方术式');
assert.equal(opponentAction.results[0].cardType, 'technique');

console.log('OPPONENT_CARD_NAME_BACKEND_ACCEPTANCE PASS cardName=%s cardType=%s', opponentAction.results[0].cardName, opponentAction.results[0].cardType);
