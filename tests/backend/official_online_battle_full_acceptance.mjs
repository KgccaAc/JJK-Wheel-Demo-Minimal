import assert from 'node:assert/strict';

const endpoint = process.env.ONLINE_BATTLE_ENDPOINT || 'https://119.91.224.223/preview-room-api/api/rooms';
const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

function profile(id, side) {
  return {
    id, displayName: id,
    stats: { body: 'B', martial: 'B', cursed_energy: 'B', control: 'B', efficiency: 'B', talent: 'B' },
    cards: Array.from({ length: 10 }, (_, index) => ({
      id: `${id}-finisher-${index}`, name: '终结牌', type: 'action', tags: [],
      effect: { damage: 100000, target: 'opponent' }, cost: { ce: 0 },
      side,
    })),
  };
}

async function request(identityId, operation, payload) {
  const requestId = `official-full-${identityId}-${operation}-${crypto.randomUUID()}`;
  const response = await fetch(endpoint, {
    method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://119.91.224.223' },
    body: JSON.stringify({ protocolVersion: 'online-battle-v3', requestId, traceId: requestId, identity: { identityId, guest: true }, operation, payload }),
  });
  const body = await response.json();
  return { status: response.status, body };
}

function assertOk(result, label) {
  assert.equal(result.status, 200, `${label}: ${JSON.stringify(result.body)}`);
  assert.equal(result.body.ok, true, `${label}: ${JSON.stringify(result.body)}`);
  return result.body;
}

function visibleHand(body, side) {
  const visible = body.data?.visible_state || {};
  const actor = visible.actors?.[side] || {};
  const hand = actor.zones?.hand || [];
  assert.ok(hand.length >= 3, `side ${side} did not receive a usable hand: ${JSON.stringify(visible)}`);
  return hand.map((card) => String(card.instance_id)).filter(Boolean);
}

const hostId = `official-host-${suffix}`;
const guestId = `official-guest-${suffix}`;
const hostProfile = profile(`official-host-character-${suffix}`, 0);
const guestProfile = profile(`official-guest-character-${suffix}`, 1);

const created = assertOk(await request(hostId, 'create_room', { mode: 'private_1v1', spectatorPolicy: 'disabled', characterId: hostProfile.id, characterSnapshot: hostProfile }), 'create_room');
const roomId = created.data.room.roomId;
assert.ok(roomId);
assertOk(await request(guestId, 'join_room', { roomId, characterId: guestProfile.id, characterSnapshot: guestProfile }), 'join_room');
assertOk(await request(hostId, 'lock_character', { roomId, locked: true, characterId: hostProfile.id, characterSnapshot: hostProfile }), 'host lock');
const ready = assertOk(await request(guestId, 'lock_character', { roomId, locked: true, characterId: guestProfile.id, characterSnapshot: guestProfile }), 'guest lock');
assert.equal(ready.data.room.state, 'READY');

const hostBootstrap = assertOk(await request(hostId, 'get_battle_bootstrap', { roomId }), 'host bootstrap');
const guestBootstrap = assertOk(await request(guestId, 'get_battle_bootstrap', { roomId }), 'guest bootstrap');
let hostRevision = hostBootstrap.data.battleRevision;
let guestRevision = guestBootstrap.data.battleRevision;
const hostStrategy = assertOk(await request(hostId, 'submit_stage_input', { roomId, battleRevision: hostRevision, stage: 'strategy', data: { id: 'SteadyButton' } }), 'host strategy');
const guestStrategy = assertOk(await request(guestId, 'submit_stage_input', { roomId, battleRevision: guestRevision, stage: 'strategy', data: { id: 'SteadyButton' } }), 'guest strategy');
const hostAfterStrategy = assertOk(await request(hostId, 'get_battle_bootstrap', { roomId }), 'host strategy resync');
assert.equal(hostAfterStrategy.data.visible_state.phase, 'DISCARD');
assert.equal(guestStrategy.data.visible_state.phase, 'DISCARD');
hostRevision = hostAfterStrategy.data.battleRevision;
guestRevision = guestStrategy.data.battleRevision;

const hostHand = visibleHand(hostAfterStrategy, 0);
const guestHand = visibleHand(guestStrategy, 1);
const hostDiscard = assertOk(await request(hostId, 'submit_stage_input', { roomId, battleRevision: hostRevision, stage: 'discard', data: { ids: hostHand.slice(0, 2) } }), 'host discard');
const guestDiscard = assertOk(await request(guestId, 'submit_stage_input', { roomId, battleRevision: guestRevision, stage: 'discard', data: { ids: guestHand.slice(0, 2) } }), 'guest discard');
const hostAfterDiscard = assertOk(await request(hostId, 'get_battle_bootstrap', { roomId }), 'host discard resync');
assert.equal(hostAfterDiscard.data.visible_state.phase, 'INITIATIVE');
assert.equal(guestDiscard.data.visible_state.phase, 'INITIATIVE');
hostRevision = hostAfterDiscard.data.battleRevision;
guestRevision = guestDiscard.data.battleRevision;

const hostInitiative = assertOk(await request(hostId, 'submit_stage_input', { roomId, battleRevision: hostRevision, stage: 'initiative', data: { investment: 0 } }), 'host initiative');
const guestInitiative = assertOk(await request(guestId, 'submit_stage_input', { roomId, battleRevision: guestRevision, stage: 'initiative', data: { investment: 0 } }), 'guest initiative');
const hostAfterInitiative = assertOk(await request(hostId, 'get_battle_bootstrap', { roomId }), 'host initiative resync');
assert.equal(hostAfterInitiative.data.visible_state.phase, 'PLAY');
assert.equal(guestInitiative.data.visible_state.phase, 'PLAY');
hostRevision = hostAfterInitiative.data.battleRevision;
guestRevision = guestInitiative.data.battleRevision;

const hostPlayHand = visibleHand(hostAfterInitiative, 0);
const guestPlayHand = visibleHand(guestInitiative, 1);
assertOk(await request(hostId, 'submit_stage_input', { roomId, battleRevision: hostRevision, stage: 'play', data: { cards: [hostPlayHand[0]], domain: '' } }), 'host play');
const finished = assertOk(await request(guestId, 'submit_stage_input', { roomId, battleRevision: guestRevision, stage: 'play', data: { cards: [guestPlayHand[0]], domain: '' } }), 'guest play');
assert.equal(finished.data.visible_state.phase, 'FINISHED', JSON.stringify(finished.body));
assert.equal(finished.data.visible_state.finished, true, JSON.stringify(finished.body));
assert.notEqual(finished.data.visible_state.winner, '', JSON.stringify(finished.body));
console.log(`OFFICIAL_ONLINE_BATTLE_FULL_ACCEPTANCE PASS room=${roomId} winner=${finished.data.visible_state.winner}`);
