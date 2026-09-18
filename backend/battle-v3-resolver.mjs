import { createHash } from 'node:crypto';
import { domainRecord, eligibleCards } from './battle-v3-catalog.mjs';

const clone = (value) => structuredClone(value);
const hash = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const isObject = (value) => value && typeof value === 'object' && !Array.isArray(value);
const SUPPORTED_DSL_TOOLS = new Set([
  'require_status', 'require_counter', 'require_value', 'require_summon', 'require_summon_group',
  'compute_action_value', 'modify_scale', 'modify_damage', 'set_action_mode', 'set_damage_policy',
  'adjust_counter', 'set_counter', 'consume_counter', 'add_status', 'add_computed_status', 'remove_status',
  'adjust_resource', 'pay_hp_cost', 'register_counter_modifier', 'adjust_action_resource', 'modify_weight',
  'selection_rule', 'set_action_order', 'emit_battle_event', 'grant_temporary_technique_tag', 'unlock_card_pool',
  'summon_unit', 'update_summon', 'destroy_summon', 'recall_summon'
]);

// A deliberately small, transport-free authority state machine. HTTP services
// persist the returned `state`; this module never knows identities or rooms.
export function createBattle(leftProfile, rightProfile, seed) {
  const state = {
    rulesetVersion: 'battle-rules-v3', seed: Number(seed) || 0, round: 1,
    revision: 1, phase: 'strategy', submissions: {}, strategies: [null, null],
    winner: '', finish_reason: '',
    actors: [actor(leftProfile), actor(rightProfile)], events: [],
  };
  return state;
}

export function submitStage(before, side, stage, data) {
  if (!isObject(before) || ![0, 1].includes(side)) return failure('INVALID_STATE');
  const state = clone(before);
  if (stage !== state.phase) return failure('INVALID_STAGE');
  if (!isObject(data)) return failure('INVALID_INPUT');
  if (state.submissions[String(side)]) return same(state.submissions[String(side)], data) ? accepted(state) : failure('STAGE_INPUT_CONFLICT');
  if (!valid(stage, data, state, side)) return failure('INVALID_INPUT');
  state.submissions[String(side)] = clone(data);
  if (!state.submissions['0'] || !state.submissions['1']) return accepted(state);
  return resolveStage(state, stage);
}

export function projectForSide(state, side) {
  const publicActors = state.actors.map((entry) => ({
    id: entry.id, hp: entry.hp, maxHp: entry.maxHp, ce: entry.ce, maxCe: entry.maxCe,
    guard: entry.guard, stability: entry.stability, domain: clone(entry.domain),
    counters: clone(entry.counters), statuses: clone(entry.statuses), summons: clone(entry.summons),
    handCount: entry.hand.length, domainCount: entry.domainHand.length,
  }));
  return {
    battleRevision: state.revision,
    phase: state.phase,
    public: { round: state.round, actors: publicActors, events: clone(state.events) },
    private: { hand: clone(state.actors[side].hand), domain: clone(state.actors[side].domainHand) },
  };
}

// Godot's BattleState is the client presentation model. This is deliberately a
// filtered canonical-shaped projection, not the Worker checkpoint: only the
// receiving actor gets unplayed hand/domain entries, while all public combat
// values remain visible to both players.
export function canonicalForSide(state, side) {
  const phase = { strategy: 'OPENING_STRATEGY', discard: 'DISCARD', initiative: 'INITIATIVE', play: 'PLAY', finished: 'FINISHED' }[state.phase] || 'OPENING_STRATEGY';
  const actors = state.actors.map((entry, index) => ({
    id: entry.id,
    profile: index === side ? clone(entry.profile) : publicProfile(entry.profile),
    hp: entry.hp, max_hp: entry.maxHp, ce: entry.ce, max_ce: entry.maxCe,
    guard: entry.guard, stability: entry.stability,
    statuses: clone(entry.statuses), counters: clone(entry.counters), counter_labels: {},
    domain_state: clone(entry.domain),
    zones: {
      deck: [], draw: [], hand: index === side ? clone(entry.hand) : [], selected: [],
      discard: clone(entry.discard), exile: [], domain: index === side ? clone(entry.domainHand) : [],
    },
  }));
  return {
    ruleset_version: 'battle-rules-v3', seed: state.seed, round: state.round,
    active_actor: Number(state.firstSide ?? 0), revision: state.revision,
    phase, finished: state.phase === 'finished', winner: String(state.winner || ''), finish_reason: String(state.finish_reason || ''),
    strategy_snapshot: state.strategies.map((id) => id ? { id } : {}),
    initiative: state.firstSide === undefined ? {} : { first_side: state.firstSide },
    pending_discard_count: phase === 'DISCARD' ? 2 : 0, pending_play: {},
    actors, events: clone(state.events), event_sequence: state.events.length,
  };
}

function publicProfile(profile) {
  const source = isObject(profile) ? profile : {};
  // UI needs an identity/name/image reference to render the opponent, never
  // their login-card action definitions, hidden counters, or custom hand data.
  const result = {};
  for (const key of ['id', 'name', 'displayName', 'nickname', 'avatar', 'avatarPath', 'portrait', 'techniqueId', 'domainId']) {
    if (source[key] !== undefined) result[key] = clone(source[key]);
  }
  return result;
}

function actor(profile) {
  const source = isObject(profile) ? profile : {};
  const derived = deriveCombatant(source);
  return {
    id: String(source.id || ''), hp: derived.hp, maxHp: derived.maxHp,
    ce: derived.ce, maxCe: derived.maxCe, ceRegen: derived.ceRegen,
    guard: derived.guard, shield: number(source.shield, 0), stability: derived.stability,
	defense: derived.defense, outgoingDamageMultiplier: derived.outgoingDamageMultiplier,
	incomingDamageMultiplier: derived.incomingDamageMultiplier, damageResistance: derived.damageResistance,
	ceCostMultiplier: derived.ceCostMultiplier, ceRegenMultiplier: derived.ceRegenMultiplier,
	baseOutgoingDamageMultiplier: derived.outgoingDamageMultiplier, baseIncomingDamageMultiplier: derived.incomingDamageMultiplier,
	baseAccuracyBonus: 0, baseEvasionBonus: 0, counterModifiers: [],
    counters: clone(source.initial_counters || source.counters || {}), statuses: {}, summons: [], domain: {},
    pendingStatuses: [], timedStatuses: [], runtimeModifiers: [], actionResources: {},
    specialResources: clone(source.specialResources || source.special_resources || {}), mahoragaProxy: null,
    dimensionDeltas: dimensionDeltas(source),
    profile: clone(source), hand: [], domainHand: [], discard: [],
  };
}

function valid(stage, data, state, side) {
  if (stage === 'strategy') return typeof data.id === 'string' && data.id.length > 0;
  if (stage === 'discard') return Array.isArray(data.ids) && data.ids.length === 2 && ownsAll(state.actors[side].hand, data.ids);
  if (stage === 'initiative') return Number.isInteger(data.investment) && [0, 10, 20, 30].includes(data.investment) && data.investment < state.actors[side].hp;
  if (stage === 'play') return Array.isArray(data.cards) && data.cards.length <= 3 && ownsAll(state.actors[side].hand, data.cards) && (typeof data.domain === 'string' || data.domain === '');
  return false;
}

function resolveStage(state, stage) {
  const inputs = state.submissions;
  if (stage === 'strategy') {
    state.strategies = [inputs['0'].id, inputs['1'].id];
	for (const side of [0, 1]) deal(state, side);
    state.phase = 'discard';
  } else if (stage === 'discard') {
    for (const side of [0, 1]) discard(state.actors[side], inputs[String(side)].ids);
    state.phase = 'initiative';
  } else if (stage === 'initiative') {
    const bids = [inputs['0'].investment, inputs['1'].investment];
    state.actors[0].hp -= bids[0]; state.actors[1].hp -= bids[1];
    state.firstSide = bids[0] >= bids[1] ? 0 : 1;
    state.phase = 'play';
  } else if (stage === 'play') {
	const order = [state.firstSide ?? 0, 1 - (state.firstSide ?? 0)];
	const actions = [];
	for (const side of order) {
		if (state.actors[side].hp <= 0) { actions.push({ side, cancelled: 'defeated' }); continue; }
		const domain = resolveDomain(state, side, inputs[String(side)].domain);
		if (!domain.ok) { actions.push({ side, cancelled: domain.error }); continue; }
		const action = resolveCards(state, side, inputs[String(side)].cards);
		if (!action.ok) { actions.push({ side, cancelled: action.error }); continue; }
		actions.push({ side, domain, ...action });
	}
	maintain(state);
	state.events = actions;
	state.phase = state.actors.some((entry) => entry.hp <= 0) ? 'finished' : 'discard';
	if (state.phase === 'finished') {
		const leftDefeated = state.actors[0].hp <= 0;
		const rightDefeated = state.actors[1].hp <= 0;
		state.winner = leftDefeated === rightDefeated ? '' : (leftDefeated ? state.actors[1].id : state.actors[0].id);
		state.finish_reason = leftDefeated && rightDefeated ? 'double_ko' : 'hp_zero';
	}
	if (state.phase !== 'finished') {
		state.round += 1;
		for (const nextSide of [0, 1]) deal(state, nextSide);
	}
  }
  state.submissions = {}; state.revision += 1;
  if (stage !== 'play') state.events = [{ kind: 'stage_resolved', stage, round: state.round }];
  const result = { ok: true, type: stage === 'play' ? 'round_result' : 'stage_result', nextStage: state.phase, state };
  return result;
}

function discard(actorState, ids) {
  const selected = actorState.hand.filter((card) => ids.includes(String(card.instance_id)));
  actorState.hand = actorState.hand.filter((card) => !ids.includes(String(card.instance_id)));
  actorState.discard.push(...selected);
}
function deal(state, side) {
	const actorState = state.actors[side]; const profile = actorState.profile || {};
	// Login-card actions are authoritative additions, not a replacement for the
	// official pool.  A sparse custom snapshot therefore keeps its special cards
	// while still receiving the normal technique/public cards required to deal.
	const custom = uniqueCards(Array.isArray(profile.cards) ? clone(profile.cards) : []);
	const official = uniqueCards(eligibleCards(profile)).filter((card) => !custom.some((entry) => cardKey(entry) === cardKey(card)));
	const pool = [...custom, ...official];
	if (pool.length < 10) throw new Error('DEAL_POOL_INSUFFICIENT_USABLE_CARDS');
	// Never let a large official pool push login-card actions out of the initial
	// hand. Custom actions are selected first; official actions fill remaining
	// slots. Each group is still deterministic for replay and test fixtures.
	const ordered = [
		...orderedCards(custom, state, side).slice(0, 10),
		...orderedCards(official, state, side).slice(0, Math.max(0, 10 - custom.length)),
	];
	actorState.hand = ordered.map(({ card }, index) => ({ ...clone(card), instance_id: `${state.round}:${side}:hand:${index}:${card.id || card.actionId}` }));
	const domainPool = pool.filter((card) => card.type === 'domain' || (card.tags || []).includes('domain_expand')).slice(0, 3);
	actorState.domainHand = domainPool.map((card, index) => ({ ...clone(card), instance_id: `${state.round}:${side}:domain:${index}:${card.id || card.actionId}` }));
}

function uniqueCards(cards) {
	const seen = new Set();
	return cards.filter((card) => {
		const key = String(card?.actionId || card?.action_id || card?.id || '');
		if (!key || seen.has(key)) return false;
		seen.add(key);
		return true;
	});
}
function cardKey(card) { return String(card?.actionId || card?.action_id || card?.id || ''); }
function orderedCards(cards, state, side) {
	return cards.map((card) => ({ card, key: hash(`${state.seed}:${state.round}:${side}:${cardKey(card)}`) })).sort((left, right) => left.key.localeCompare(right.key));
}

// The Worker owns the same atomic card contract as the Godot V3 resolver.
// Keep legacy field translation here, at the transport boundary, rather than
// sprinkling card-id exceptions through authoritative settlement.
function atomicEffects(card) {
	const raw = card?.effect?.special?.atomicEffects;
	return Array.isArray(raw) ? raw : (isObject(raw) ? [raw] : []);
}
function counterValue(entry, namespace, id) {
	const counters = entry.counters || {};
	const store = namespace ? (isObject(counters[namespace]) ? counters[namespace] : {}) : counters;
	return Number(store[id] || 0);
}
function setCounter(entry, namespace, id, value, maximum = Infinity) {
	entry.counters ||= {};
	if (namespace) entry.counters[namespace] = isObject(entry.counters[namespace]) ? entry.counters[namespace] : {};
	const store = namespace ? entry.counters[namespace] : entry.counters;
	store[id] = clamp(Number(value || 0), 0, Number.isFinite(Number(maximum)) ? Number(maximum) : Infinity);
}
function valueField(field) {
	return ({ costCe: 'costCe', ceCost: 'costCe', ceDamage: 'ceDamage', stabilityDamage: 'stabilityDamage', domainLoad: 'domainLoad', domainPressure: 'domainPressure', blockIgnoreRatio: 'blockIgnoreRatio' })[String(field)] || String(field || 'damage');
}
function whenMet(effect, actorState, targetState, values) {
	for (const condition of Array.isArray(effect.when) ? effect.when : []) {
		if (!isObject(condition)) continue;
		const receiver = condition.target === 'opponent' ? targetState : actorState;
		const source = String(condition.source || 'value');
		const actual = source === 'counter' ? counterValue(receiver, String(condition.namespace || ''), String(condition.counterId || ''))
			: source === 'status' ? (receiver.statuses?.[condition.statusId] ? 1 : 0)
			: source === 'summon.present' ? ((receiver.summons || []).some((entry) => !condition.counterId || String(entry.id) === String(condition.counterId)) ? 1 : 0)
			: source.startsWith('self.') ? readField(actorState, source.slice(5))
			: source.startsWith('target.') ? readField(targetState, source.slice(7))
			: Number(values[valueField(condition.field)] ?? receiver[condition.field] ?? 0);
		const expected = Number(condition.threshold ?? condition.value ?? 0);
		const operator = String(condition.operator || '>=');
		if (!({ '>': actual > expected, '>=': actual >= expected, '==': actual === expected, '<=': actual <= expected, '<': actual < expected })[operator]) return false;
	}
	return true;
}
function computedSource(params, actorState, targetState, values, field, suffix = 'A') {
	const fallback = suffix === 'A' ? (params.source ?? '') : 'constant';
	const source = String(params[`source${suffix}`] ?? fallback);
	const receiver = suffix === 'B' ? targetState : actorState;
	if (source === 'constant') return 1;
	if (source === 'counter') return counterValue(receiver, String(params[`source${suffix}Namespace`] ?? params.namespace ?? ''), String(params[`source${suffix}CounterId`] ?? params.counterId ?? ''));
	if (source === 'self') return readField(actorState, params[`source${suffix}Field`] ?? field);
	if (source === 'target') return readField(targetState, params[`source${suffix}Field`] ?? field);
	if (source.startsWith('self.')) return readField(actorState, source.slice(5));
	if (source.startsWith('target.')) return readField(targetState, source.slice(7));
	return Number(values[field] || 0);
}
function readField(entry, field) {
	let value = entry;
	for (const part of String(field || '').split('.')) value = value == null ? undefined : value[part];
	return Number(value || 0);
}
function prepareDslAction(card, actorState, targetState) {
	const values = {
		damage: Number(card.effect?.damage ?? card.attack ?? 0), ceDamage: Number(card.effect?.ceDamage ?? 0), stabilityDamage: Number(card.effect?.stabilityDamage ?? 0),
		healing: Number(card.effect?.healing ?? 0), block: Number(card.effect?.block ?? card.effect?.guard ?? 0), shield: Number(card.effect?.shield ?? 0),
		domainLoad: Number(card.effect?.domainLoad ?? 0), domainPressure: Number(card.effect?.domainPressure ?? 0),
	};
	const effects = atomicEffects(card);
	for (const effect of effects) {
		if (!whenMet(effect, actorState, targetState, values)) continue;
		const params = effect.params || {}; const tool = String(effect.tool || '');
		if (!SUPPORTED_DSL_TOOLS.has(tool)) return failure('UNSUPPORTED_DSL_TOOL:' + tool);
		if (tool === 'require_status' && !(effect.target === 'opponent' ? targetState : actorState).statuses?.[params.statusId]) return failure('MISSING_STATUS');
		if (tool === 'require_summon') {
			const receiver = effect.target === 'opponent' ? targetState : actorState;
			const id = String(params.summonId || params.id || '');
			const found = (receiver.summons || []).some((entry) => (!id || String(entry.id) === id) && (params.activeOnly !== true || entry.active !== false));
			const present = String(params.presence || 'present') === 'present';
			if (present !== found) return failure('MISSING_SUMMON');
		}
		if (tool === 'require_value') {
			const receiver = effect.target === 'opponent' ? targetState : actorState;
			const current = params.source === 'counter' ? counterValue(receiver, String(params.namespace || ''), String(params.counterId || '')) : readField(receiver, params.field ?? params.source);
			if (current < Number(params.threshold ?? params.minimum ?? 0)) return failure('VALUE_REQUIREMENT_FAILED');
		}
		if (tool === 'consume_counter') {
			const receiver = effect.target === 'opponent' ? targetState : actorState;
			const available = counterValue(receiver, String(params.namespace || ''), String(params.counterId || ''));
			const amount = params.amountSource === 'counter' ? Math.min(available, Number(params.maxAmount ?? available)) : Number(params.amount ?? 1);
			if (available + 1e-4 < amount) return failure('MISSING_COUNTER');
		}
	}
	// Pre-action HP costs are settled before damage, matching the Godot V3
	// working-copy order. They are intentionally not deferred to post-action.
	for (const effect of effects) {
		if (effect.tool !== 'pay_hp_cost' || !whenMet(effect, actorState, targetState, values)) continue;
		const params = effect.params || {}; const receiver = effect.target === 'opponent' ? targetState : actorState;
		const amount = Number(params.amount ?? 0) + Number(receiver.maxHp || 0) * Number(params.ratio ?? 0);
		const floor = params.nonlethal ? 1 : 0;
		if (Number(receiver.hp || 0) - amount < floor) return failure('INSUFFICIENT_HP');
		values.__hp_cost = Number(values.__hp_cost || 0) + amount;
	}
	for (const effect of effects) {
		if (!whenMet(effect, actorState, targetState, values)) continue;
		const trigger = String(effect.trigger || ''); if (!['pre-damage', 'pre_action', 'pre-action', 'calculate'].includes(trigger)) continue;
		const params = effect.params || {}; const field = valueField(params.field || 'damage');
		if (effect.tool === 'compute_action_value') {
			const a = Math.max(0, computedSource(params, actorState, targetState, values, field, 'A'));
			const b = Math.max(0, computedSource(params, actorState, targetState, values, field, 'B'));
			const exponentA = Number.isFinite(Number(params.sourceAExponent)) ? Number(params.sourceAExponent) : 1;
			const exponentB = Number.isFinite(Number(params.sourceBExponent)) ? Number(params.sourceBExponent) : 1;
			let growth = 1;
			if (params.growthSource && params.growthSource !== 'none') {
				const growthValue = computedSource({ ...params, sourceA: params.growthSource, sourceACounterId: params.growthCounterId, sourceANamespace: params.growthNamespace }, actorState, targetState, values, field, 'A');
				growth = Math.pow(Math.max(0, Number(params.growthBase ?? 1)), growthValue);
			}
			values[field] = clamp(Math.pow(a, exponentA) * Math.pow(b, exponentB) * growth * Number(params.multiplier ?? 1) + Number(params.offset ?? 0), Number(params.minimum ?? -Infinity), Number(params.maximum ?? Infinity));
			if (field === 'costCe') values.costAffectedByEfficiency = params.affectedByEfficiency !== false;
		}
		else if (effect.tool === 'modify_scale') values[field] = Number(values[field] || 0) * Number(params.scale ?? params.multiplier ?? 1);
		else if (effect.tool === 'modify_damage') {
			if (params.requiredTargetStatusId && !targetState.statuses?.[String(params.requiredTargetStatusId)]) continue;
			values.damage = Number(values.damage || 0) * Number(params.multiplier ?? 1) + Number(params.flat ?? params.amount ?? params.offset ?? 0);
			values.blockIgnoreRatio = clamp(Number(values.blockIgnoreRatio || 0) + Number(params.penetrationRatio ?? 0) + Number(params.penetrationAdd ?? 0), 0, 1);
		}
		else if (effect.tool === 'modify_scale' && String(params.stage || '').toLowerCase() === 'outgoing') values.damage = Number(values.damage || 0) * Number(params.value ?? params.scale ?? 1);
		else if (effect.tool === 'set_action_mode') {
			if (params.damage !== undefined) values.damage = Number(params.damage);
			if (params.ceDamage !== undefined) values.ceDamage = Number(params.ceDamage);
			if (params.accuracyProfile !== undefined) values.accuracyProfile = params.accuracyProfile;
			if (params.evasionAllowed !== undefined) values.evasionAllowed = Boolean(params.evasionAllowed);
			if (params.cardType !== undefined) values.cardType = params.cardType;
		}
	}
	return { ok: true, values, effects };
}
function commitDslEffects(effects, actorState, targetState, state) {
	for (const effect of effects) {
		if (!whenMet(effect, actorState, targetState, {})) continue;
		const trigger = String(effect.trigger || ''); if (!['post-damage', 'post_action', 'post-action', 'on-hit', 'commit'].includes(trigger)) continue;
		const params = effect.params || {}; const receiver = effect.target === 'opponent' ? targetState : actorState;
		if (effect.tool === 'adjust_counter') setCounter(receiver, String(params.namespace || ''), String(params.counterId || ''), counterValue(receiver, String(params.namespace || ''), String(params.counterId || '')) + Number(params.amount ?? params.delta ?? 0), params.max);
		else if (effect.tool === 'set_counter') {
			const delay = Number(params.activationDelayRounds ?? 0);
			if (delay > 0) {
				receiver.pendingCounters ||= [];
				const availableRound = Number(state.round) + delay;
				receiver.pendingCounters.push({ namespace: String(params.namespace || ''), counterId: String(params.counterId || ''), value: Number(params.value ?? 0), maximum: params.max, availableRound, expiresRound: Number(params.durationRounds ?? 0) > 0 ? availableRound + Number(params.durationRounds) : -1 });
			} else setCounter(receiver, String(params.namespace || ''), String(params.counterId || ''), Number(params.value ?? 0), params.max);
		}
		else if (effect.tool === 'consume_counter') {
			const current = counterValue(receiver, String(params.namespace || ''), String(params.counterId || ''));
			const amount = params.amountSource === 'counter' ? Math.min(current, Number(params.maxAmount ?? current)) : Number(params.amount ?? 1);
			setCounter(receiver, String(params.namespace || ''), String(params.counterId || ''), current - amount, params.max);
		} else if (effect.tool === 'add_status' || effect.tool === 'add_computed_status') {
			const statusId = String(params.statusId || params.id || '');
			const status = { ...clone(params), id: statusId, rounds: Number(params.rounds ?? 1) };
			if (effect.tool === 'add_computed_status' && params.field) {
				const field = String(params.field);
				status[field] = clamp(computedSource(params, actorState, targetState, {}, field) * Number(params.multiplier ?? 1) + Number(params.offset ?? 0), Number(params.minimum ?? -Infinity), Number(params.maximum ?? Infinity));
			}
			const delay = Number(params.activationDelayRounds ?? 0);
			if (delay > 0 || params.durationStartsNextRound === true) {
				receiver.pendingStatuses ||= [];
				const availableRound = Number(state.round) + Math.max(1, delay);
				receiver.pendingStatuses.push({ statusId, status, availableRound, expiresRound: Number(params.rounds ?? 0) > 0 ? availableRound + Number(params.rounds) : -1 });
			} else { receiver.statuses ||= {}; receiver.statuses[statusId] = status; }
		} else if (effect.tool === 'remove_status') delete receiver.statuses?.[String(params.statusId || params.id || '')];
		else if (effect.tool === 'register_counter_modifier') {
			receiver.counterModifiers ||= [];
			const modifier = { counterId: String(params.counterId || ''), namespace: String(params.namespace || ''), field: String(params.field || ''), offset: Number(params.offset ?? 0), perCounter: Number(params.perCounter ?? 0), minimum: Number(params.minimum ?? -Infinity), maximum: Number(params.maximum ?? Infinity), inactiveWhenZero: Boolean(params.inactiveWhenZero), hook: String(params.hook || '') };
			const index = receiver.counterModifiers.findIndex((entry) => entry.counterId === modifier.counterId && entry.namespace === modifier.namespace && entry.hook === modifier.hook);
			if (index >= 0) receiver.counterModifiers[index] = modifier; else receiver.counterModifiers.push(modifier);
		} else if (effect.tool === 'modify_scale') {
			receiver.runtimeModifiers ||= [];
			receiver.runtimeModifiers.push({ stage: String(params.stage || ''), value: Number(params.value ?? params.scale ?? 1), stacking: String(params.stacking || 'multiply'), rounds: Number(params.duration ?? 0) });
		} else if (effect.tool === 'adjust_resource') {
			applyResource(receiver, String(params.resource || params.field || 'ce'), Number(params.amount ?? params.delta ?? 0), params);
		} else if (effect.tool === 'pay_hp_cost') {
			const amount = Number(params.amount ?? 0) + Number(receiver.maxHp || 0) * Number(params.ratio ?? 0);
			const floor = params.nonlethal ? 1 : 0;
			if (Number(receiver.hp || 0) - amount >= floor) receiver.hp = clamp(Number(receiver.hp || 0) - amount, floor, Number(receiver.maxHp || Infinity));
		} else if (effect.tool === 'adjust_action_resource') {
			receiver.actionResources ||= {}; const field = String(params.resource || params.field || '');
			if (field) receiver.actionResources[field] = Number(receiver.actionResources[field] || 0) + Number(params.amount ?? params.delta ?? 0);
		} else if (effect.tool === 'modify_weight') {
			receiver.weightModifiers ||= []; receiver.weightModifiers.push(clone(params));
		} else if (effect.tool === 'grant_temporary_technique_tag') {
			receiver.temporaryTechniqueTags ||= {}; receiver.temporaryTechniqueTags[String(params.slotId || 'temporary')] = clone(params);
		} else if (effect.tool === 'unlock_card_pool') {
			receiver.unlockedCardPools ||= []; receiver.unlockedCardPools.push(clone(params));
		} else if (effect.tool === 'emit_battle_event') {
			state.events ||= []; state.events.push({ id: String(params.eventId || ''), label: String(params.label || '') });
		} else if (effect.tool === 'summon_unit') {
			const summonId = String(params.summonId || params.id || 'summon');
			const maxHp = Number(params.maxHp ?? params.max_hp ?? params.hp ?? 1);
			const summon = { ...clone(params), id: summonId, maxHp, hp: clamp(Number(params.hp ?? maxHp), 0, maxHp), attack: Number(params.attack ?? params.attackPower ?? 0), defense: Number(params.defense ?? params.defensePower ?? 0) };
			receiver.summons ||= []; const index = receiver.summons.findIndex((entry) => String(entry.id) === summonId);
			if (index >= 0) receiver.summons[index] = summon; else receiver.summons.push(summon);
		} else if (effect.tool === 'update_summon') updateSummon(receiver, params);
		else if (effect.tool === 'destroy_summon' || effect.tool === 'recall_summon') {
			const summonId = String(params.summonId || params.id || ''); receiver.summons = (receiver.summons || []).filter((entry) => summonId && String(entry.id) !== summonId);
		}
	}
}
function applyRuntimeModifiers(entry) {
	entry.outgoingDamageMultiplier = Number(entry.baseOutgoingDamageMultiplier ?? entry.outgoingDamageMultiplier ?? 1);
	entry.incomingDamageMultiplier = Number(entry.baseIncomingDamageMultiplier ?? entry.incomingDamageMultiplier ?? 1);
	entry.accuracyBonus = Number(entry.baseAccuracyBonus ?? 0); entry.evasionBonus = Number(entry.baseEvasionBonus ?? 0);
	for (const modifier of entry.runtimeModifiers || []) {
		const stage = String(modifier.stage || '').toLowerCase(); const value = Number(modifier.value ?? 1);
		if (stage === 'outgoing') entry.outgoingDamageMultiplier *= value;
		else if (stage === 'incominghp') entry.incomingDamageMultiplier *= value;
		else if (stage === 'evasion') entry.evasionBonus += value;
		else if (stage === 'hitrate') entry.accuracyBonus += value;
	}
	for (const status of Object.values(entry.statuses || {})) {
		if (!isObject(status)) continue;
		entry.outgoingDamageMultiplier *= Number(status.outgoingScale ?? status.outgoing_damage_multiplier ?? 1);
		entry.incomingDamageMultiplier *= Number(status.incomingHpScale ?? status.incoming_damage_multiplier ?? 1);
		entry.accuracyBonus += Number(status.hitRateModifier ?? status.accuracy_bonus ?? 0);
		entry.evasionBonus += Number(status.evasionBonus ?? status.evasion_bonus ?? 0);
	}
	for (const modifier of entry.counterModifiers || []) {
		const count = counterValue(entry, modifier.namespace, modifier.counterId);
		if (count <= 0 && modifier.inactiveWhenZero) continue;
		const value = clamp(Number(modifier.offset ?? 1) + count * Number(modifier.perCounter ?? 0), Number(modifier.minimum ?? -Infinity), Number(modifier.maximum ?? Infinity));
		if (modifier.field === 'incomingHpScale' || modifier.field === 'incoming_damage_multiplier') entry.incomingDamageMultiplier *= value;
		else if (modifier.field === 'outgoingScale' || modifier.field === 'outgoing_damage_multiplier') entry.outgoingDamageMultiplier *= value;
	}
}
function actionPriority(card) {
	return atomicEffects(card).find((effect) => effect.tool === 'set_action_order')?.params?.priority ?? 0;
}
function resolveCards(state, side, ids) {
	const actorState = state.actors[side]; const target = state.actors[1 - side];
	const selected = actorState.hand.filter((card) => ids.includes(String(card.instance_id))).sort((left, right) => Number(actionPriority(left)) - Number(actionPriority(right)));
	if (selected.length !== ids.length) return failure('CARD_NOT_IN_HAND');
	if (selected.some((card) => atomicEffects(card).some((effect) => effect.tool === 'selection_rule' && String(effect.params?.mode || '') === 'solo')) && selected.length > 1) return failure('SELECTION_RULE_SOLO');
	let spent = 0; const results = [];
	for (const card of selected) {
		applyRuntimeModifiers(actorState); applyRuntimeModifiers(target);
		const dsl = prepareDslAction(card, actorState, target);
		if (!dsl.ok) return dsl;
		const values = dsl.values;
		const scaling = card.scaling || {};
		const rawCost = Number.isFinite(Number(values.costCe)) ? Number(values.costCe) : Math.max(Number(card.cost?.ce ?? 0), Number(actorState.maxCe) * Number(card.cost?.ceRatio ?? 0), Number(card.cost?.minCe ?? 0));
		const efficiency = clamp(1 - Number(actorState.dimensionDeltas.efficiency || 0) * Number(scaling.efficiencyCostPerRank ?? 0), Number(scaling.efficiencyCostMin ?? .5), Number(scaling.efficiencyCostMax ?? 1.5));
		const cost = Math.max(0, rawCost * efficiency * Number(actorState.ceCostMultiplier ?? 1));
		if (actorState.ce + 0.0001 < spent + cost) return failure('INSUFFICIENT_CE');
		spent += cost;
		const raw = Number(values.damage ?? 0);
		const summonTarget = selectSummonTarget(target, card, values);
		const damageTarget = summonTarget || target;
		const damageMultiplier = channelMultiplier(damageWeights(scaling), actorState.dimensionDeltas, Number(scaling.sourceDamageMin ?? 0), Number(scaling.sourceDamageMax ?? 3));
		const outgoing = Number(actorState.outgoingDamageMultiplier ?? 1) * (actorState.domain?.active ? Number(actorState.domain.outgoing_damage_multiplier ?? 1) : 1);
		const incoming = summonTarget ? 1 : Number(target.incomingDamageMultiplier ?? 1) * (target.domain?.active ? Number(target.domain.incoming_damage_multiplier ?? 1) : 1);
		const resistance = summonTarget ? 0 : clamp(Number(target.damageResistance ?? 0), 0, 0.95);
		const incomingDamage = Math.max(0, raw * damageMultiplier * outgoing * incoming * (1 - resistance));
		const summonReduction = summonTarget ? clamp(Number(summonTarget.damageReductionRatio ?? 0), 0, 0.95) : 0;
		const effectiveDefense = Math.max(0, Number(damageTarget.defense ?? 0) * (1 - clamp(Number(values.blockIgnoreRatio ?? 0), 0, 1)));
		const defenseMultiplier = 100 / (100 + effectiveDefense);
		const postDefense = incomingDamage * defenseMultiplier * (1 - summonReduction);
		const guardAbsorbed = summonTarget ? 0 : Math.min(Math.max(0, Number(target.guard ?? 0)), postDefense);
		const shieldAbsorbed = summonTarget ? 0 : Math.min(Math.max(0, Number(target.shield ?? 0)), Math.max(0, postDefense - guardAbsorbed));
		const hpDamage = Math.max(0, postDefense - guardAbsorbed - shieldAbsorbed);
		if (summonTarget) {
			summonTarget.hp = clamp(Number(summonTarget.hp ?? 0) - hpDamage, 0, Number(summonTarget.maxHp ?? summonTarget.max_hp ?? 0));
			target.summons = (target.summons || []).filter((entry) => Number(entry.hp ?? 0) > 0);
		} else {
			target.guard = Math.max(0, Number(target.guard ?? 0) - guardAbsorbed);
			target.shield = Math.max(0, Number(target.shield ?? 0) - shieldAbsorbed);
			target.hp = clamp(Number(target.hp) - hpDamage, 0, Number(target.maxHp));
		}
		actorState.hp = clamp(Number(actorState.hp) - Number(values.__hp_cost ?? 0) + Math.max(0, Number(values.healing ?? 0)), 0, Number(actorState.maxHp));
		actorState.guard = Math.max(0, Number(actorState.guard) + Math.max(0, Number(values.block ?? values.guard ?? 0)));
		actorState.shield = Math.max(0, Number(actorState.shield) + Math.max(0, Number(values.shield ?? 0)));
		target.ce = clamp(Number(target.ce) - Math.max(0, Number(values.ceDamage ?? 0)), 0, Number(target.maxCe));
		target.stability = clamp(Number(target.stability) - Math.max(0, Number(values.stabilityDamage ?? 0)), 0, 100);
		commitDslEffects(dsl.effects, actorState, target, state);
		results.push({ cardId: String(card.id), hpDamage, guardAbsorbed, shieldAbsorbed, cost, damageMultiplier });
	}
	actorState.ce = clamp(Number(actorState.ce) - spent, 0, Number(actorState.maxCe));
	actorState.hand = actorState.hand.filter((card) => !ids.includes(String(card.instance_id)));
	actorState.discard.push(...selected);
	return { ok: true, cards: ids, spentCe: spent, results };
}
function selectSummonTarget(target, card, values) {
	const wanted = String(card.targetSummonId || card.effect?.targetSummonId || values.targetSummonId || '');
	const summons = Array.isArray(target.summons) ? target.summons : [];
	if (wanted) return summons.find((entry) => String(entry.id) === wanted) || null;
	return summons.filter((entry) => entry.guardRules?.interceptsOpponentAttacks).sort((a, b) => Number(b.guardRules?.priority || 0) - Number(a.guardRules?.priority || 0))[0] || null;
}
function resolveDomain(state, side, instanceId) {
	if (!instanceId) return { ok: true, activated: false };
	const actorState = state.actors[side];
	if (actorState.domain?.active) return failure('DOMAIN_ALREADY_ACTIVE');
	const card = actorState.domainHand.find((entry) => String(entry.instance_id) === String(instanceId));
	if (!card) return failure('DOMAIN_NOT_IN_HAND');
	const resolvedId = String(card.domainId || card.actionId || card.id || actorState.profile?.domainId || '');
	if (!resolvedId) return failure('DOMAIN_NOT_AVAILABLE');
	const record = domainRecord(resolvedId) || {};
	const resource = isObject(record.resource) ? record.resource : {};
	const barrierBehavior = isObject(record.barrier?.behavior) ? record.barrier.behavior : {};
	const cost = Math.max(0, actorState.maxCe * Number(resource.ceCostRatio ?? .35) * Number(actorState.ceCostMultiplier ?? 1) * Number(actorState.domainCostMultiplier ?? 1));
	if (actorState.ce + .0001 < cost) return failure('INSUFFICIENT_CE');
	actorState.ce = clamp(actorState.ce - cost, 0, actorState.maxCe);
	const loadBase = Number(resource.domainLoadBase ?? 0);
	const loadGrowth = Number(resource.domainLoadGrowth ?? 10) * Number(barrierBehavior.domainLoadModifier ?? 1);
	actorState.domain = { id: resolvedId, active: true, load: loadBase, threshold: 100, load_growth: loadGrowth, outgoing_damage_multiplier: 1.25, incoming_damage_multiplier: .8, ce_cost_multiplier: 1.1, stability_pressure: Number(resource.stabilityPressure ?? 0), sure_hit: Boolean(record.sureHit?.enabled), effects: clone(record.effects || []), actions: clone(record.actions || []), opponent_actions: clone(record.opponentActions || []) };
	actorState.domainHand = actorState.domainHand.filter((entry) => String(entry.instance_id) !== String(instanceId));
	actorState.discard.push(card);
	return { ok: true, activated: true, id: resolvedId, ceCost: cost };
}
function maintain(state) {
	for (const entry of state.actors) {
		if (entry.domain?.active) {
			entry.domain.load = Math.min(100, Number(entry.domain.load ?? 0) + Math.max(0, Number(entry.domain.load_growth ?? 0)));
			if (entry.domain.load >= 100) {
				entry.ce = Math.max(0, Number(entry.ce) - Number(entry.maxCe) * .2);
				entry.domain.active = false; entry.domain.load = 0; entry.domain.end_reason = 'domain_meltdown';
				entry.statuses.technique_burnout = { id: 'technique_burnout', rounds: 1, value: 1 };
			}
		}
		const regenBlocked = Boolean(entry.statuses?.ce_regen_blocked || entry.statuses?.ceRegenBlocked);
		const amount = regenBlocked ? 0 : Math.max(0, Number(entry.ceRegen ?? 0)) * Math.max(0, Number(entry.ceRegenMultiplier ?? 1));
		entry.ce = Math.min(Number(entry.maxCe), Number(entry.ce) + amount);
		for (const [id, status] of Object.entries(entry.statuses || {})) {
			if (!status || typeof status !== 'object' || !Object.hasOwn(status, 'rounds') || Number(status.rounds) < 0) continue;
			status.rounds = Number(status.rounds) - 1;
			if (status.rounds <= 0) delete entry.statuses[id];
		}
		entry.runtimeModifiers = (entry.runtimeModifiers || []).filter((modifier) => {
			if (Number(modifier.rounds || 0) <= 0) return true;
			modifier.rounds = Number(modifier.rounds) - 1;
			return modifier.rounds > 0;
		});
		advanceTimedEffects(entry, Number(state.round) + 1);
	}
}
function advanceTimedEffects(entry, nextRound) {
	const active = Array.isArray(entry.timedCounters) ? entry.timedCounters : [];
	const pending = [];
	for (const timer of entry.pendingCounters || []) {
		if (Number(timer.availableRound) <= nextRound) {
			setCounter(entry, timer.namespace, timer.counterId, timer.value, timer.maximum);
			if (Number(timer.expiresRound) > nextRound) active.push(timer);
		} else pending.push(timer);
	}
	entry.pendingCounters = pending;
	entry.timedCounters = active.filter((timer) => {
		if (Number(timer.expiresRound) >= 0 && Number(timer.expiresRound) <= nextRound) {
			setCounter(entry, timer.namespace, timer.counterId, 0, timer.maximum);
			return false;
		}
		return true;
	});
	const pendingStatuses = [];
	for (const timer of entry.pendingStatuses || []) {
		if (Number(timer.availableRound) <= nextRound) {
			entry.statuses ||= {};
			entry.statuses[String(timer.statusId)] = clone(timer.status);
			if (Number(timer.expiresRound) < 0 || Number(timer.expiresRound) > nextRound) {
				entry.timedStatuses ||= []; entry.timedStatuses.push(timer);
			}
		} else pendingStatuses.push(timer);
	}
	entry.pendingStatuses = pendingStatuses;
	entry.timedStatuses = (entry.timedStatuses || []).filter((timer) => {
		if (Number(timer.expiresRound) >= 0 && Number(timer.expiresRound) <= nextRound) {
			if (entry.statuses) delete entry.statuses[String(timer.statusId)];
			return false;
		}
		return true;
	});
}
function applyResource(entry, field, amount, params = {}) {
	const key = ({ domainLoad: 'domain.load', domain_pressure: 'domain.pressure' })[field] || field;
	if (key === 'domain.load') { entry.domain ||= {}; entry.domain.load = Math.max(0, Number(entry.domain.load || 0) + amount); return; }
	if (key === 'domain.pressure') { entry.domain ||= {}; entry.domain.pressure = Math.max(0, Number(entry.domain.pressure || 0) + amount); return; }
	if (field === 'stability') { const scale = Math.abs(amount) < 1 ? 100 : 1; entry.stability = clamp(Number(entry.stability || 0) + amount * scale, 0, 100); return; }
	if (field === 'hp') { entry.hp = clamp(Number(entry.hp || 0) + amount, 0, Number(entry.maxHp || Infinity)); return; }
	if (field === 'ce') { entry.ce = clamp(Number(entry.ce || 0) + amount, 0, Number(entry.maxCe || Infinity)); return; }
	if (field) entry.actionResources ||= {}, entry.actionResources[field] = Number(entry.actionResources[field] || 0) + amount;
}
function updateSummon(entry, params) {
	const id = String(params.summonId || params.id || '');
	const summon = (entry.summons || []).find((item) => String(item.id) === id);
	if (!summon) return;
	for (const key of ['name', 'attack', 'defense', 'active']) if (params[key] !== undefined) summon[key] = params[key];
	if (params.maxHp !== undefined || params.max_hp !== undefined) summon.maxHp = Number(params.maxHp ?? params.max_hp);
	if (params.hp !== undefined) summon.hp = clamp(Number(params.hp), 0, Number(summon.maxHp || Infinity));
	entry.summons = (entry.summons || []).filter((item) => Number(item.hp ?? 1) > 0);
}
function ownsAll(hand, ids) { return new Set(hand.map((card) => String(card.instance_id))).size >= ids.length && ids.every((id) => hand.some((card) => String(card.instance_id) === id)); }
function number(...values) { for (const value of values) if (Number.isFinite(Number(value))) return Number(value); return 0; }
function clamp(value, minimum, maximum) { return Math.min(Math.max(value, minimum), maximum); }
const RANK_SCORES = { 'E-': 0, E: 1, D: 2, C: 3, B: 4, A: 5, S: 6, SS: 7, SSS: 8, 'EX-': 9, EX: 10 };
function rankDelta(value) { if (value === undefined || value === null || value === '') return 0; const score = Number.isFinite(Number(value)) ? Number(value) : (RANK_SCORES[String(value).trim().toUpperCase()] ?? RANK_SCORES.S); return (score - 5) * 0.4; }
function dimensionDeltas(profile) {
	const stats = profile.stats || {}; const axes = profile.axes || {}; const raw = profile.raw || {};
	const source = (key, aliases) => { for (const alias of aliases) if (Object.hasOwn(raw, alias)) return raw[alias]; if (Object.hasOwn(stats, key)) return stats[key]; if (Object.hasOwn(axes, key)) return axes[key]; return key === 'cursed_energy' ? profile.cursedEnergyScore : undefined; };
	return { body: rankDelta(source('body', ['bodyScore', 'body'])), martial: rankDelta(source('martial', ['martialScore', 'martial'])), technique: rankDelta(source('technique', ['techniqueScore', 'technique'])), cursed_energy: rankDelta(source('cursed_energy', ['cursedEnergyScore', 'cursedEnergy'])), control: rankDelta(source('control', ['controlScore', 'control'])), efficiency: rankDelta(source('efficiency', ['efficiencyScore', 'efficiency'])), talent: rankDelta(source('talent', ['talentScore', 'talent'])) };
}
function deriveCombatant(profile) {
	const deltas = dimensionDeltas(profile);
	const fallbackHp = 260 + deltas.body * 42 + deltas.martial * 28 + deltas.talent * 12;
	const fallbackCe = 240 + deltas.cursed_energy * 110 + deltas.technique * 70 + deltas.control * 25;
	const flags = profile.flags || {}; const maxCe = flags.isZeroCe ? 0 : Math.max(0, number(profile.max_ce, profile.maxCe, profile.ce, fallbackCe));
	const maxHp = Math.max(1, number(profile.max_hp, profile.maxHp, profile.hp, fallbackHp));
	return {
		maxHp, hp: clamp(number(profile.hp, maxHp), 0, maxHp), maxCe, ce: clamp(number(profile.ce, maxCe), 0, maxCe),
		ceRegen: Math.max(0, number(profile.ce_regen, 18 + deltas.efficiency * 16 + deltas.control * 10 + deltas.talent * 6)),
		stability: clamp(number(profile.stability, 100), 0, 100), defense: Math.max(0, number(profile.defense, 20 + deltas.body * 22 + deltas.martial * 12)),
		guard: Math.max(0, number(profile.guard, 0)), outgoingDamageMultiplier: Math.max(0, number(profile.outgoing_damage_multiplier, 1)),
		incomingDamageMultiplier: Math.max(0, number(profile.incoming_damage_multiplier, 1)), damageResistance: clamp(number(profile.damage_resistance, 0), 0, .95),
		ceCostMultiplier: Math.max(0, number(profile.ce_cost_multiplier, 1)), ceRegenMultiplier: Math.max(0, number(profile.ce_regen_multiplier, 1)),
	};
}
function damageWeights(scaling) {
	return { body: Number(scaling.bodyDamagePerRank ?? 0), martial: Number(scaling.martialDamagePerRank ?? 0), technique: Number(scaling.techniqueDamagePerRank ?? 0), cursed_energy: Number(scaling.cursedEnergyDamagePerRank ?? 0), control: Number(scaling.controlDamagePerRank ?? 0), efficiency: Number(scaling.efficiencyDamagePerRank ?? 0), talent: Number(scaling.talentDamagePerRank ?? 0) };
}
function channelMultiplier(weights, deltas, minimum = 0, maximum = 3) { let result = 1; for (const [key, weight] of Object.entries(weights)) result += Number(weight || 0) * Number(deltas[key] || 0); return clamp(result, minimum, maximum); }
function accepted(state) { return { ok: true, type: 'submission_accepted', peerSubmission: 'waiting', state }; }
function failure(error) { return { ok: false, error }; }
function same(left, right) { return JSON.stringify(left) === JSON.stringify(right); }

