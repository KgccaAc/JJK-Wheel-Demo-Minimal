class_name BattleFlowSession
extends RefCounted

## 唯一的离线流程入口：命令校验→冻结双方输入→按先手结算→发布快照。
## 页面不写资源；所有预演都使用副本，失败不得留下扣费或牌区变化。
signal state_committed(state: Variant)
signal events_produced(events: Array)
signal battle_loaded(state: Dictionary)
signal hand_updated(normal_hand: Array, domain_hand: Array)
signal resources_changed(actor_index: int, actor: Dictionary)
signal battle_log_added(entry: String)
signal turn_resolved(result: Dictionary)
signal battle_finished(winner: String, reason: String)
signal battle_error(message: String)

const RULESET_VERSION: StringName = &"godot-battle-rules-v1"
const NORMAL_HAND_SIZE: int = 10
const RETAINED_HAND_SIZE: int = 8
const DISCARD_COUNT: int = 2
const DOMAIN_SLOT_LIMIT: int = 3
const INITIATIVE_BIDS: Array[int] = [0, 10, 20, 30]
## 策略只描述明确的规则修正，UI 按钮名是稳定 ID，不在 Presenter 中解释数值。
const STRATEGY_PROFILES: Dictionary = {
	"default": {"id":"default", "label":"默认", "authorize_technique":true, "initiative_bonus":0, "incoming_damage_multiplier":1.0, "outgoing_damage_multiplier":1.0, "technique_cost_multiplier":1.0, "domain_cost_multiplier":1.0, "ce_regen_bonus":0.0, "modifiers":[], "tags":[]},
	"basic_only": {"id":"basic_only", "label":"基础压制", "authorize_technique":false, "initiative_bonus":0, "incoming_damage_multiplier":0.92, "outgoing_damage_multiplier":1.0, "technique_cost_multiplier":1.0, "domain_cost_multiplier":1.0, "ce_regen_bonus":0.0, "modifiers":[], "tags":["basic_only"]},
	"SteadyButton": {"id":"SteadyButton", "label":"稳扎稳打", "authorize_technique":true, "initiative_bonus":0, "incoming_damage_multiplier":0.90, "outgoing_damage_multiplier":1.0, "technique_cost_multiplier":1.0, "domain_cost_multiplier":1.0, "ce_regen_bonus":4.0, "modifiers":["incoming_damage_multiplier"], "tags":["steady"]},
	"AggressiveButton": {"id":"AggressiveButton", "label":"抢攻压制", "authorize_technique":true, "initiative_bonus":10, "incoming_damage_multiplier":1.08, "outgoing_damage_multiplier":1.10, "technique_cost_multiplier":1.0, "domain_cost_multiplier":1.0, "ce_regen_bonus":0.0, "modifiers":["initiative_bonus","outgoing_damage_multiplier"], "tags":["aggressive"]},
	"TechniqueButton": {"id":"TechniqueButton", "label":"术式主导", "authorize_technique":true, "initiative_bonus":0, "incoming_damage_multiplier":1.0, "outgoing_damage_multiplier":1.15, "technique_cost_multiplier":0.85, "domain_cost_multiplier":1.0, "ce_regen_bonus":0.0, "modifiers":["technique_cost_multiplier","outgoing_damage_multiplier"], "tags":["technique_focus"]},
	"DomainButton": {"id":"DomainButton", "label":"抢领域", "authorize_technique":true, "initiative_bonus":0, "incoming_damage_multiplier":1.0, "outgoing_damage_multiplier":1.0, "technique_cost_multiplier":1.0, "domain_cost_multiplier":0.80, "ce_regen_bonus":0.0, "modifiers":["domain_cost_multiplier"], "tags":["domain_focus"]},
	"CounterButton": {"id":"CounterButton", "label":"反制拆招", "authorize_technique":true, "initiative_bonus":0, "incoming_damage_multiplier":0.82, "outgoing_damage_multiplier":0.95, "technique_cost_multiplier":1.0, "domain_cost_multiplier":1.0, "ce_regen_bonus":0.0, "modifiers":["incoming_damage_multiplier"], "tags":["counter"]},
	"ResourceButton": {"id":"ResourceButton", "label":"拖入消耗", "authorize_technique":true, "initiative_bonus":0, "incoming_damage_multiplier":0.96, "outgoing_damage_multiplier":1.0, "technique_cost_multiplier":1.0, "domain_cost_multiplier":1.0, "ce_regen_bonus":12.0, "modifiers":["ce_regen_bonus"], "tags":["resource"]},
	"RiskButton": {"id":"RiskButton", "label":"赌命收割", "authorize_technique":true, "initiative_bonus":8, "incoming_damage_multiplier":1.18, "outgoing_damage_multiplier":1.28, "technique_cost_multiplier":0.95, "domain_cost_multiplier":1.10, "ce_regen_bonus":0.0, "modifiers":["initiative_bonus","outgoing_damage_multiplier","incoming_damage_multiplier"], "tags":["risk"]}
}
const StateScript: Script = preload("res://battle/core/BattleState.gd")
const EligibilityScript: Script = preload("res://battle/data/BattleEligibility.gd")
const ResourcesScript: Script = preload("res://battle/data/CharacterResources.gd")
const ActionResolverScript: Script = preload("res://battle/core/CoreActionResolver.gd")
const DomainRuntimeScript: Script = preload("res://battle/core/DomainRuntime.gd")
const ResolutionPipelineScript: Script = preload("res://battle/core/BattleResolutionPipeline.gd")
const AvailabilityScript: Script = preload("res://battle/data/CardAvailabilityService.gd")
const DataRepositoryScript: Script = preload("res://battle/data/BattleDataRepository.gd")
const CandidateBuilderScript: Script = preload("res://battle/data/CardCandidateBuilder.gd")
const LoginCardProjectorScript: Script = preload("res://account/LoginCardCharacterProjector.gd")
const RoundResolverV3Script: Script = preload("res://battle/v3/RoundResolverV3.gd")
const ActionIntentV3Script: Script = preload("res://battle/v3/ActionIntentV3.gd")
const ActionResolverV3Script: Script = preload("res://battle/v3/ActionResolverV3.gd")
const DomainRuntimeV3Script: Script = preload("res://battle/v3/DomainRuntimeV3.gd")
const BattleRulesV3Script: Script = preload("res://battle/v3/BattleRulesV3.gd")

var state: RefCounted = null
var _normal_pools: Array[Array] = [[], []]
var _technique_pools: Array[Array] = [[], []]
var _domain_pools: Array[Array] = [[], []]
var _strategies: Array[Dictionary] = [{}, {}]
var _discarded_sides: Array[int] = []
var _initiative_submissions: Dictionary = {}
var _last_round_package: Dictionary = {}
var _last_cpu_actions: Array[Dictionary] = []
var _last_round_actions: Array = [[], []]
var _pending_discard_ids: Array[String] = []
var _resolution_pipeline: RefCounted = ResolutionPipelineScript.new()

func start_fixed_offline(player_id: String, opponent_id: String, battle_seed: int, auto_setup: bool = true) -> Dictionary:
	var eligibility: RefCounted = EligibilityScript.new()
	var candidate_builder: RefCounted = CandidateBuilderScript.new()
	var profiles: Array[Dictionary] = []
	var splits: Array[Dictionary] = []
	var domains: Array[Array] = []
	for character_id: String in [player_id, opponent_id]:
		var profile: Dictionary = eligibility.build_profile(character_id)
		if profile.is_empty(): return _failure("character_not_found")
		if profile.has("snapshot_valid") and not bool(profile.get("snapshot_valid", false)):
			return {"ok":false, "error":"login_card_snapshot_invalid", "character_id":character_id, "errors":profile.get("snapshot_errors", [])}
		profiles.append(ResourcesScript.new().apply(profile))
		splits.append(_split_pool(eligibility.eligible_cards(profile, "normal")))
		var domain_cards: Array[Dictionary] = []
		for card: Dictionary in eligibility.eligible_cards(profile, "domain"):
			if candidate_builder.is_domain_expansion(card): domain_cards.append(card)
		if _resolve_domain_id(profile).is_empty(): domain_cards.clear()
		domains.append(domain_cards)
	var result: Dictionary = start_battle_with_pools(profiles, splits[0].basic, splits[1].basic, splits[0].technique, splits[1].technique, domains[0], domains[1], battle_seed)
	if not result.ok: return result
	# 单机从这里开始统一采用 V3。策略/弃牌/先手仍是既有的 UI 流程，
	# 但发牌可用性、出牌、领域和回合维护不再回落到 V1 结算器。
	state.ruleset_version = &"battle-rules-v3"
	battle_loaded.emit(get_state_snapshot())
	if auto_setup:
		choose_strategy(0, &"default", state.revision)
		choose_strategy(1, &"default", state.revision)
		confirm_strategies(state.revision)
		return deal_round(state.revision)
	return result

## Story battles use the exact generated wheel snapshot.  This keeps the same
## projector -> eligibility -> tag filtering -> card/deck dealing chain as
## saved roster battles; story mode must never replace a generated character
## with a cosmetic fixed proxy.
func start_story_offline(player_snapshot: Dictionary, opponent_id: String, battle_seed: int, auto_setup: bool = true) -> Dictionary:
	if player_snapshot.is_empty(): return _failure("story_character_snapshot_missing")
	var eligibility: RefCounted = EligibilityScript.new()
	var candidate_builder: RefCounted = CandidateBuilderScript.new()
	var player_profile: Dictionary = LoginCardProjectorScript.project(player_snapshot)
	if player_profile.is_empty() or not bool(player_profile.get("snapshot_valid", false)):
		return {"ok":false, "error":"story_character_snapshot_invalid", "errors":player_profile.get("snapshot_errors", [])}
	var opponent_profile: Dictionary = eligibility.build_profile(opponent_id)
	if opponent_profile.is_empty(): return _failure("character_not_found")
	var profiles: Array[Dictionary] = []
	var splits: Array[Dictionary] = []
	var domains: Array[Array] = []
	for profile: Dictionary in [player_profile, opponent_profile]:
		profiles.append(ResourcesScript.new().apply(profile))
		splits.append(_split_pool(eligibility.eligible_cards(profile, "normal")))
		var domain_cards: Array[Dictionary] = []
		for card: Dictionary in eligibility.eligible_cards(profile, "domain"):
			if candidate_builder.is_domain_expansion(card): domain_cards.append(card)
		if _resolve_domain_id(profile).is_empty(): domain_cards.clear()
		domains.append(domain_cards)
	var result := start_battle_with_pools(profiles, splits[0].basic, splits[1].basic, splits[0].technique, splits[1].technique, domains[0], domains[1], battle_seed)
	if not bool(result.get("ok", false)): return result
	state.ruleset_version = &"battle-rules-v3"
	battle_loaded.emit(get_state_snapshot())
	if auto_setup:
		choose_strategy(0, &"default", state.revision)
		choose_strategy(1, &"default", state.revision)
		confirm_strategies(state.revision)
		return deal_round(state.revision)
	return result

## Starts a room battle from the exact snapshots exchanged by both players.
## This path intentionally does not consult the local character repository:
## custom-card data may exist only on the remote client.
func start_online_from_room_players(players: Array, battle_seed: int) -> Dictionary:
	if players.size() != 2: return _failure("room_players_required")
	var eligibility: RefCounted = EligibilityScript.new()
	var candidate_builder: RefCounted = CandidateBuilderScript.new()
	var profiles: Array[Dictionary] = []
	var splits: Array[Dictionary] = []
	var domains: Array[Array] = []
	for raw_player: Variant in players:
		if not raw_player is Dictionary: return _failure("room_player_invalid")
		var player: Dictionary = raw_player as Dictionary
		var snapshot: Dictionary = player.get("character_snapshot", {}) as Dictionary
		if snapshot.is_empty(): return _failure("room_character_snapshot_missing")
		var profile: Dictionary = LoginCardProjectorScript.project(snapshot)
		var expected_id: String = str(player.get("character_id", "")).strip_edges()
		if profile.is_empty() or str(profile.get("id", "")).strip_edges() != expected_id:
			return _failure("room_character_snapshot_mismatch")
		if not bool(profile.get("snapshot_valid", false)):
			return {"ok":false, "error":"login_card_snapshot_invalid", "character_id":expected_id, "errors":profile.get("snapshot_errors", [])}
		profiles.append(ResourcesScript.new().apply(profile))
		splits.append(_split_pool(eligibility.eligible_cards(profile, "normal")))
		var domain_cards: Array[Dictionary] = []
		for card: Dictionary in eligibility.eligible_cards(profile, "domain"):
			if candidate_builder.is_domain_expansion(card): domain_cards.append(card)
		if _resolve_domain_id(profile).is_empty(): domain_cards.clear()
		domains.append(domain_cards)
	var result: Dictionary = start_battle_with_pools(profiles, splits[0].basic, splits[1].basic, splits[0].technique, splits[1].technique, domains[0], domains[1], battle_seed)
	if result.ok: battle_loaded.emit(get_state_snapshot())
	return result

## 联机权威状态在 bootstrap 返回前没有理由下载双方完整登录卡快照。
## 此占位会话只满足 Fight 的 UI 生命周期；下一步必定由 Worker 的过滤
## canonical 投影覆盖它，绝不用于发牌或本地结算。
func start_online_placeholder(players: Array, battle_seed: int) -> Dictionary:
	if players.size() != 2: return _failure("room_players_required")
	var profiles: Array[Dictionary] = []
	for raw_player: Variant in players:
		if not raw_player is Dictionary: return _failure("room_player_invalid")
		var player: Dictionary = raw_player as Dictionary
		var character_id: String = str(player.get("character_id", "")).strip_edges()
		if character_id.is_empty(): return _failure("room_character_id_missing")
		profiles.append({"id":character_id, "name":str(player.get("character_name", character_id)), "hp":1.0, "max_hp":1.0, "ce":0.0, "max_ce":0.0})
	var result: Dictionary = start_battle_with_pools(profiles, [], [], [], [], [], [], battle_seed)
	if bool(result.get("ok", false)):
		state.ruleset_version = &"battle-rules-v3"
		battle_loaded.emit(get_state_snapshot())
	return result

func start_battle(profiles: Array[Dictionary], left_pool: Array[Dictionary], right_pool: Array[Dictionary], left_domains: Array[Dictionary], right_domains: Array[Dictionary], battle_seed: int) -> Dictionary:
	var left: Dictionary = _split_pool(left_pool)
	var right: Dictionary = _split_pool(right_pool)
	return start_battle_with_pools(profiles, left.basic, right.basic, left.technique, right.technique, left_domains, right_domains, battle_seed)

func start_battle_with_pools(profiles: Array[Dictionary], left_normal: Array[Dictionary], right_normal: Array[Dictionary], left_technique: Array[Dictionary], right_technique: Array[Dictionary], left_domains: Array[Dictionary], right_domains: Array[Dictionary], battle_seed: int) -> Dictionary:
	if profiles.size() != 2: return _failure("profiles_required")
	state = StateScript.new()
	state.initialize(String(RULESET_VERSION), battle_seed, profiles[0], profiles[1])
	_normal_pools = [left_normal.duplicate(true), right_normal.duplicate(true)]
	_technique_pools = [left_technique.duplicate(true), right_technique.duplicate(true)]
	_domain_pools = [left_domains.duplicate(true), right_domains.duplicate(true)]
	_strategies = [{}, {}]
	_discarded_sides.clear()
	_initiative_submissions.clear()
	_pending_discard_ids.clear()
	_last_round_package.clear()
	_last_cpu_actions.clear()
	_last_round_actions = [[], []]
	_emit_event("battle_started", {"seed":battle_seed})
	return _success()

## 显式创建 V3 规则战斗；旧 start_battle() 保持 v1 兼容，避免页面迁移时
## 同一状态同时被两套结算器接管。
func start_battle_v3(profiles: Array[Dictionary], left_pool: Array[Dictionary], right_pool: Array[Dictionary], left_domains: Array[Dictionary], right_domains: Array[Dictionary], battle_seed: int) -> Dictionary:
	var result: Dictionary = start_battle(profiles, left_pool, right_pool, left_domains, right_domains, battle_seed)
	if bool(result.get("ok", false)) and state != null:
		state.ruleset_version = &"battle-rules-v3"
	return result

func restore_online_round_checkpoint(snapshot: Dictionary) -> Dictionary:
	if state == null or snapshot.is_empty(): return _failure("round_checkpoint_missing")
	# canonical_snapshot stores rules/state data, while these submission guards
	# are session-local workflow state. Clear them before replaying both revealed
	# inputs, otherwise the local preview's initiative is submitted twice.
	state.restore_canonical_snapshot(snapshot)
	_strategies = (state.strategy_snapshot as Array).duplicate(true) if state.strategy_snapshot is Array and (state.strategy_snapshot as Array).size() == 2 else [{}, {}]
	_discarded_sides.clear()
	_initiative_submissions.clear()
	_pending_discard_ids.clear()
	_last_cpu_actions.clear()
	return _success()

func choose_strategy(side: int, strategy_id: StringName, revision: int) -> Dictionary:
	var gate: Dictionary = _validate_command(&"OPENING_STRATEGY", revision, side)
	if not gate.ok: return gate
	if strategy_id.is_empty(): return _failure("strategy_required")
	var profile: Dictionary = STRATEGY_PROFILES.get(String(strategy_id), {}) as Dictionary
	if profile.is_empty(): return _failure("unknown_strategy")
	_strategies[side] = profile.duplicate(true)
	_strategies[side]["version"] = "strategy-v2"
	state.strategy_snapshot = _strategies.duplicate(true)
	_emit_event("strategy_selected", {"actor_index":side, "strategy_id":String(strategy_id)})
	return _success()

func confirm_strategies(revision: int) -> Dictionary:
	var gate: Dictionary = _validate_command(&"OPENING_STRATEGY", revision, 0)
	if not gate.ok: return gate
	for strategy: Dictionary in _strategies:
		if strategy.is_empty(): return _failure("strategies_incomplete")
	if String(state.ruleset_version) == "battle-rules-v3": _apply_v3_strategy_attributes()
	state.phase = &"DEAL"
	_emit_event("strategy_confirmed", {"strategies":state.strategy_snapshot})
	return _success()

func deal_round(revision: int) -> Dictionary:
	if state != null and state.phase == &"OPENING_STRATEGY": return _failure("strategies_not_confirmed")
	var gate: Dictionary = _validate_command(&"DEAL", revision, 0)
	if not gate.ok: return gate
	var hands: Array[Array] = []
	var domain_hands: Array[Array] = []
	var category_distributions: Array[Dictionary] = []
	# 牌池是定义集合而非有限卡堆；抽取独立实例，避免复制定义补池或第二轮耗尽。
	# 先计算双方发牌，任何一方无候选时均不修改原状态。
	for side: int in 2:
		var pool: Array = _normal_pools[side].duplicate()
		if _strategies[side].get("authorize_technique", true): pool.append_array(_technique_pools[side])
		# 运行时授权不能在开局固化：解锁/复制均在结算后才改变下一轮候选池。
		pool.append_array(_runtime_explicit_unlock_cards(side))
		if _strategies[side].get("authorize_technique", true): pool.append_array(_runtime_temporary_technique_cards(side))
		# Deal eligibility is not the same as immediate playability.  Keep cards
		# which are legal for this character in the hand even when current CE is
		# insufficient; submit/resolve will apply the strict play-time gate.
		pool = _deal_eligible_action_pool(_unique_action_pool(pool), side)
		var basic_pool: Array = []
		var technique_pool: Array = []
		for raw_card: Variant in pool:
			if not raw_card is Dictionary: continue
			if _is_technique_card(raw_card as Dictionary): technique_pool.append(raw_card)
			else: basic_pool.append(raw_card)
		if basic_pool.size() + technique_pool.size() < NORMAL_HAND_SIZE: return _failure("deal_pool_insufficient_usable_cards")
		var rng: RandomNumberGenerator = RandomNumberGenerator.new()
		rng.seed = hash("%s:%s:%s:hand-normal-mixture" % [state.seed, state.round, side])
		var distribution: Dictionary = _normal_hand_distribution(basic_pool.size(), technique_pool.size(), rng)
		category_distributions.append(distribution.duplicate(true))
		var guaranteed_basic: Array[Dictionary] = []
		var guaranteed_technique: Array[Dictionary] = []
		for card: Dictionary in basic_pool:
			if bool(card.get("guaranteedPerTurn", false)): guaranteed_basic.append(card)
		for card: Dictionary in technique_pool:
			if bool(card.get("guaranteedPerTurn", false)): guaranteed_technique.append(card)
		basic_pool = basic_pool.filter(func(card: Dictionary) -> bool: return not bool(card.get("guaranteedPerTurn", false)))
		technique_pool = technique_pool.filter(func(card: Dictionary) -> bool: return not bool(card.get("guaranteedPerTurn", false)))
		_shuffle_pool(basic_pool, rng)
		_shuffle_pool(technique_pool, rng)
		var hand: Array[Dictionary] = []
		var guaranteed_basic_count := mini(guaranteed_basic.size(), int(distribution.basic_count))
		var guaranteed_technique_count := mini(guaranteed_technique.size(), int(distribution.technique_count))
		for index: int in guaranteed_basic_count: hand.append(guaranteed_basic[index])
		for index: int in guaranteed_technique_count: hand.append(guaranteed_technique[index])
		for index: int in int(distribution.basic_count) - guaranteed_basic_count: hand.append(basic_pool[index] as Dictionary)
		for index: int in int(distribution.technique_count) - guaranteed_technique_count: hand.append(technique_pool[index] as Dictionary)
		_shuffle_pool(hand, rng)
		for slot: int in hand.size(): hand[slot] = _instance_card(hand[slot] as Dictionary, side, &"hand", slot)
		hands.append(hand)
		var domain_hand: Array[Dictionary] = []
		for slot: int in mini(DOMAIN_SLOT_LIMIT, _domain_pools[side].size()):
			domain_hand.append(_instance_card(_domain_pools[side][slot], side, &"domain", slot))
		domain_hands.append(domain_hand)
	for side: int in 2:
		var zones: Dictionary = state.actors[side].zones
		zones.discard.append_array(zones.hand)
		zones.discard.append_array(zones.domain)
		state.set_zone_cards(side, "hand", hands[side])
		state.set_zone_cards(side, "domain", domain_hands[side])
	_discarded_sides.clear()
	_pending_discard_ids.clear()
	_initiative_submissions.clear()
	state.pending_discard_count = DISCARD_COUNT
	state.phase = &"DISCARD"
	_emit_event("cards_dealt", {"hand_size":NORMAL_HAND_SIZE, "domain_capacity":DOMAIN_SLOT_LIMIT, "category_distribution":category_distributions})
	_publish_state()
	return _success()

func discard_cards(side: int, ids: Array, revision: int) -> Dictionary:
	var gate: Dictionary = _validate_command(&"DISCARD", revision, side)
	if not gate.ok: return gate
	if _discarded_sides.has(side): return _failure("already_discarded")
	if ids.size() != DISCARD_COUNT: return _failure("discard_count_required")
	var hand: Array = state.actors[side].zones.hand
	var selected: Dictionary = _find_cards(hand, ids)
	if not selected.ok: return selected
	state.actors[side].zones.discard.append_array(selected.cards)
	state.set_zone_cards(side, "hand", hand.filter(func(card: Dictionary) -> bool: return not ids.has(card.instance_id)))
	_discarded_sides.append(side)
	if side == 0: state.pending_discard_count = 0
	if _discarded_sides.size() == 2: state.phase = &"INITIATIVE"
	_emit_event("cards_discarded", {"actor_index":side, "instance_ids":ids.duplicate()})
	_publish_state()
	return _success()

func submit_initiative(side: int, commitment: int, revision: int) -> Dictionary:
	var gate: Dictionary = _validate_command(&"INITIATIVE", revision, side)
	if not gate.ok: return gate
	if _initiative_submissions.has(side): return _failure("initiative_already_submitted")
	if not INITIATIVE_BIDS.has(commitment): return _failure("invalid_initiative_bid")
	var actor: Dictionary = state.actors[side]
	# 源项目明确规定“投入体势不返还”。保留至少 1 体势，避免先手争夺
	# 本身把角色置为阵亡状态。
	if commitment < 0 or commitment >= int(floor(float(actor.get("hp", 0.0)))):
		return _failure("initiative_investment_exceeds_hp")
	actor["hp"] = maxf(1.0, float(actor.get("hp", 0.0)) - float(commitment))
	state.actors[side] = actor
	_initiative_submissions[side] = commitment
	if _initiative_submissions.size() == 2:
		var left: int = _initiative_submissions[0]
		var right: int = _initiative_submissions[1]
		var left_effective: int = left + int((_strategies[0] as Dictionary).get("initiative_bonus", 0))
		var right_effective: int = right + int((_strategies[1] as Dictionary).get("initiative_bonus", 0))
		var winner: int = 0 if left_effective >= right_effective else 1
		if left_effective == right_effective and left_effective > 0: winner = absi(hash("%s:%s:initiative" % [state.seed, state.round])) % 2
		state.active_actor = winner
		state.initiative = {"left":left, "right":right, "left_effective":left_effective, "right_effective":right_effective, "winner_index":winner}
		# 先后手是本回合的可见状态：状态栏直接读取 actor.statuses，
		# 回合维护会按 rounds 自动移除，无需由 UI 保存额外的瞬时状态。
		for initiative_side: int in 2:
			var initiative_actor: Dictionary = state.actors[initiative_side]
			var statuses: Dictionary = initiative_actor.get("statuses", {}) as Dictionary
			statuses.erase("initiative_first")
			statuses.erase("initiative_second")
			var is_first: bool = initiative_side == winner
			var status_id: String = "initiative_first" if is_first else "initiative_second"
			statuses[status_id] = {
				"id": status_id,
				"label": "先手" if is_first else "后手",
				"value": 1,
				"rounds": 1
			}
			initiative_actor["statuses"] = statuses
			state.actors[initiative_side] = initiative_actor
		state.phase = &"PLAY"
	_emit_event("initiative_submitted", {"actor_index":side, "commitment":commitment})
	_publish_state()
	return _success()

func skip_initiative(side: int, revision: int) -> Dictionary:
	return submit_initiative(side, 0, revision)

## 提交只冻结输入；两方全部提交才允许结算。空输入明确表示本轮待机。
func submit_play(side: int, ids: Array, domain_ids: Array, revision: int) -> Dictionary:
	var gate: Dictionary = _validate_command(&"PLAY", revision, side)
	if not gate.ok: return gate
	if state.pending_play.has(str(side)): return _failure("play_already_submitted")
	var input: Dictionary = {"actor_index":side, "card_instance_ids":ids.duplicate(), "domain_instance_ids":domain_ids.duplicate()}
	var check: Dictionary = validate_play(input)
	if not check.ok: return check
	state.pending_play[str(side)] = input
	if state.pending_play.size() == 2: state.phase = &"RESOLVE"
	_emit_event("play_submitted", input)
	return _success()

func validate_play(input: Dictionary) -> Dictionary:
	if state == null: return _failure("battle_not_started")
	if String(state.ruleset_version) == "battle-rules-v3": return _validate_v3_play(input)
	var preview: RefCounted = StateScript.new()
	preview.restore_canonical_snapshot(state.canonical_snapshot())
	return _execute_input(preview, input)

## V3 预演与正式回合使用 ActionResolverV3；预演只写副本，避免 UI 查询扣费。
func _validate_v3_play(input: Dictionary) -> Dictionary:
	var side: int = int(input.get("actor_index", -1))
	if side not in [0, 1]: return _failure("invalid_actor")
	var ids: Array = input.get("card_instance_ids", []) as Array
	var domain_ids: Array = input.get("domain_instance_ids", []) as Array
	var actor: Dictionary = state.actors[side] as Dictionary
	var limit: int = 4 if (actor.get("profile", {}) as Dictionary).get("traits", []).has("extra_card_slot") else 3
	if ids.size() > limit: return _failure("play_limit_exceeded")
	if domain_ids.size() > 1: return _failure("domain_play_limit_exceeded")
	var selected: Dictionary = _find_cards((actor.get("zones", {}) as Dictionary).get("hand", []) as Array, ids)
	if not bool(selected.get("ok", false)): return selected
	var selected_domains: Dictionary = _find_cards((actor.get("zones", {}) as Dictionary).get("domain", []) as Array, domain_ids)
	if not bool(selected_domains.get("ok", false)): return selected_domains
	var preview: RefCounted = StateScript.new()
	preview.restore_canonical_snapshot(state.canonical_snapshot())
	if not domain_ids.is_empty():
		var domain_result: Dictionary = DomainRuntimeV3Script.new().activate(preview, side)
		if not bool(domain_result.get("ok", false)): return domain_result
	var intent: RefCounted = ActionIntentV3Script.from_dictionary({"actor_index":side, "card_instance_ids":ids, "domain_instance_ids":domain_ids})
	return ActionResolverV3Script.new().preview_action(preview, intent)

## 实际结算与预演共用相同执行路径；调用方负责副本或失败恢复。
func _execute_input(target_state: RefCounted, input: Dictionary) -> Dictionary:
	var side: int = int(input.get("actor_index", -1))
	if side not in [0, 1]: return _failure("invalid_actor")
	var actor: Dictionary = target_state.actors[side]
	var ids: Array = input.get("card_instance_ids", [])
	var domain_ids: Array = input.get("domain_instance_ids", [])
	var limit: int = 4 if (actor.profile.get("traits", []) as Array).has("extra_card_slot") else 3
	if ids.size() > limit: return _failure("play_limit_exceeded")
	if domain_ids.size() > 1: return _failure("domain_play_limit_exceeded")
	var selected: Dictionary = _find_cards(actor.zones.hand, ids)
	if not selected.ok: return selected
	var selected_domains: Dictionary = _find_cards(actor.zones.domain, domain_ids)
	if not selected_domains.ok: return selected_domains
	var cards: Array = selected.cards
	var total_ce: float = 0.0
	var previous: Array = []
	var cost_traces: Array = []
	var availability: RefCounted = AvailabilityScript.new()
	for card: Dictionary in cards:
		var available: RefCounted = availability.evaluate(card, target_state.canonical_snapshot(), side, previous, true)
		if not available.playable: return _failure(str(available.reason))
		var cost_result: Dictionary = _resolve_card_cost(target_state, side, card)
		if not bool(cost_result.get("ok", false)): return cost_result
		total_ce += float(cost_result.get("cost", 0.0))
		cost_traces.append_array(cost_result.get("trace", []) as Array)
		previous.append(card)
	total_ce = ceilf(total_ce)
	if float(actor.ce) < total_ce: return _failure("insufficient_ce")
	actor.ce -= total_ce
	actor.zones.hand = (actor.zones.hand as Array).filter(func(card: Dictionary) -> bool: return not ids.has(card.instance_id))
	actor.zones.selected = cards.duplicate(true)
	var result: Dictionary = {"ok":true, "instance_ids":[], "trace":[]}
	if not cards.is_empty():
		result = ActionResolverScript.new().resolve_selected(target_state, side)
		if not result.ok: return result
		result["trace"] = (result.get("trace", []) as Array) + cost_traces
	if not domain_ids.is_empty():
		var domain_result: Dictionary = DomainRuntimeScript.new().activate(target_state, side)
		if not domain_result.ok: return domain_result
		actor = target_state.actors[side]
		actor.zones.domain = (actor.zones.domain as Array).filter(func(card: Dictionary) -> bool: return not domain_ids.has(card.instance_id))
		actor.zones.discard.append_array(selected_domains.cards)
		result.instance_ids.append_array(domain_ids)
	return result

func resolve_round(revision: int) -> Dictionary:
	if state != null and String(state.ruleset_version) == "battle-rules-v3": return _resolve_v3_pending_round(revision)
	var gate: Dictionary = _validate_command(&"RESOLVE", revision, 0)
	if not gate.ok: return gate
	var before: Dictionary = state.canonical_snapshot()
	var event_start: int = state.event_sequence
	var inputs: Dictionary = state.pending_play.duplicate(true)
	var round_number: int = state.round
	var validated: Array = []
	var trace: Array = []
	_last_cpu_actions.clear()
	for side: int in [int(state.active_actor), 1 - int(state.active_actor)]:
		if float(state.actors[side].hp) <= 0.0:
			state.append_event("action_cancelled", {"actor_index":side, "reason":"defeated"})
			continue
		var input: Dictionary = inputs[str(side)]
		var side_before: Dictionary = state.canonical_snapshot()
		var cpu_cards: Array = _find_cards(state.actors[side].zones.hand, input.card_instance_ids).get("cards", [])
		_last_round_actions[side] = cpu_cards.duplicate(true)
		var result: Dictionary = _execute_input(state, input)
		if not result.ok:
			# 先手改变资源/状态后，后手可能已不满足条件；记录取消，不假装出牌成功。
			state.restore_canonical_snapshot(side_before)
			state.append_event("action_cancelled", {"actor_index":side, "reason":result.get("error", "rejected")})
		else:
			validated.append_array(result.get("instance_ids", []))
			trace.append_array(result.get("trace", []))
			if side == 1: _last_cpu_actions.assign(cpu_cards)
	state.pending_play = {}
	_end_round_maintenance()
	_update_winner()
	if not state.finished:
		state.round += 1
		state.phase = &"DEAL"
	state.append_event("round_resolved", {"round":round_number})
	var after: Dictionary = state.canonical_snapshot()
	_last_round_package = {
		"ruleset_version":String(RULESET_VERSION), "seed":state.seed, "round":round_number,
		"strategy_snapshot":state.strategy_snapshot.duplicate(true), "initiative":state.initiative.duplicate(true),
		"before_state_hash":before.state_hash, "round_history_before":_round_history_actor_summary(before.get("actors", []) as Array), "inputs":inputs, "validated_actions":validated,
		"modifier_trace":trace, "events":_events_since(event_start),
		"after_state":after, "after_state_hash":after.state_hash,
		"winner":String(get_winner()), "finish_reason":state.finish_reason
	}
	_publish_state()
	var response: Dictionary = _success()
	response["round_package"] = get_round_package()
	turn_resolved.emit(response)
	if state.finished: battle_finished.emit(state.winner, state.finish_reason)
	return response

## 既有单机交互在双方提交后调用此入口；这里没有 V1 重放或回滚分支。
func _resolve_v3_pending_round(revision: int) -> Dictionary:
	var gate: Dictionary = _validate_command(&"RESOLVE", revision, 0)
	if not bool(gate.get("ok", false)): return gate
	if state.pending_play.size() != 2: return _failure("round_inputs_required")
	var before: Dictionary = state.canonical_snapshot()
	var event_start: int = state.event_sequence
	var inputs: Dictionary = state.pending_play.duplicate(true)
	var round_number: int = state.round
	var intents: Array[ActionIntentV3] = []
	for side: int in 2:
		if not inputs.has(str(side)): return _failure("round_inputs_required")
		intents.append(ActionIntentV3Script.from_dictionary(inputs[str(side)] as Dictionary))
		_last_round_actions[side] = _find_cards((state.actors[side].get("zones", {}) as Dictionary).get("hand", []) as Array, (inputs[str(side)] as Dictionary).get("card_instance_ids", []) as Array).get("cards", []).duplicate(true)
	_last_cpu_actions.assign(_last_round_actions[1])
	# pending_play 是工作流暂态，不属于本轮结果；必须在 checkpoint 后、解析前清除。
	state.pending_play = {}
	var resolution_order: Array[int] = [int(state.active_actor), 1 - int(state.active_actor)]
	var result: Dictionary = RoundResolverV3Script.new().resolve_round(state, intents, resolution_order)
	if not bool(result.get("ok", false)): return result
	var after: Dictionary = state.canonical_snapshot()
	_last_round_package = {
		"ruleset_version":"battle-rules-v3", "seed":state.seed, "round":round_number,
		"strategy_snapshot":state.strategy_snapshot.duplicate(true), "initiative":state.initiative.duplicate(true),
		"before_state_hash":str(before.get("state_hash", "")), "round_history_before":_round_history_actor_summary(before.get("actors", []) as Array), "inputs":inputs,
		"actions":result.get("actions", []).duplicate(true), "events":_events_since(event_start),
		"after_state":after, "after_state_hash":str(after.get("state_hash", "")),
		"winner":String(get_winner()), "finish_reason":state.finish_reason
	}
	_publish_state()
	var response: Dictionary = _success()
	response["round_package"] = get_round_package()
	turn_resolved.emit(response)
	if state.finished: battle_finished.emit(state.winner, state.finish_reason)
	return response

## 将开局七维派生值与策略压到战斗对象属性；解析时只读取这些属性。
func _apply_v3_strategy_attributes() -> void:
	var rules: RefCounted = BattleRulesV3Script.new()
	for side: int in 2:
		var actor: Dictionary = state.actors[side] as Dictionary
		var derived: Dictionary = rules.derive_combatant_stats(actor.get("profile", {}) as Dictionary)
		for key: String in ["defense", "guard", "outgoing_damage_multiplier", "incoming_damage_multiplier", "damage_resistance", "accuracy_bonus", "evasion_bonus", "ce_cost_multiplier", "ce_regen_multiplier", "ce_regen", "dimension_deltas", "stability"]:
			actor[key] = derived.get(key, actor.get(key))
		var strategy: Dictionary = _strategies[side] as Dictionary
		actor["outgoing_damage_multiplier"] = float(actor.get("outgoing_damage_multiplier", 1.0)) * float(strategy.get("outgoing_damage_multiplier", 1.0))
		actor["incoming_damage_multiplier"] = float(actor.get("incoming_damage_multiplier", 1.0)) * float(strategy.get("incoming_damage_multiplier", 1.0))
		actor["technique_cost_multiplier"] = float(strategy.get("technique_cost_multiplier", 1.0))
		actor["domain_cost_multiplier"] = float(strategy.get("domain_cost_multiplier", 1.0))
		actor["ce_regen"] = maxf(0.0, float(actor.get("ce_regen", 0.0)) + float(strategy.get("ce_regen_bonus", 0.0)))
		state.actors[side] = actor

## V3 联机/回放入口。默认旧流程保持不变，切换由上层在确认双方
## ruleset_version 后显式调用，避免两套结算器在同一回合同时写状态。
func resolve_v3_round(inputs: Array[Dictionary], order: Array[int] = [0, 1]) -> Dictionary:
	if state == null: return _failure("battle_not_started")
	if inputs.size() != 2: return _failure("round_inputs_required")
	var intents: Array[ActionIntentV3] = []
	for input: Dictionary in inputs:
		intents.append(ActionIntentV3Script.from_dictionary(input))
	var result: Dictionary = RoundResolverV3Script.new().resolve_round(state, intents, order)
	if bool(result.get("ok", false)):
		_publish_state()
		turn_resolved.emit(result)
	return result

## 回合纪要只需要展示资源与状态；不把手牌等私有战斗输入复制一份进 UI 专用字段。
func _round_history_actor_summary(actors: Array) -> Array[Dictionary]:
	var summaries: Array[Dictionary] = []
	for raw_actor: Variant in actors:
		var actor: Dictionary = raw_actor as Dictionary if raw_actor is Dictionary else {}
		summaries.append({"hp":float(actor.get("hp", 0.0)), "ce":float(actor.get("ce", 0.0)), "guard":float(actor.get("guard", 0.0)), "statuses":(actor.get("statuses", {}) as Dictionary).duplicate(true)})
	return summaries

func _events_since(first_sequence: int) -> Array[Dictionary]:
	var result: Array[Dictionary] = []
	for event: Dictionary in state.events:
		if int(event.get("sequence", -1)) >= first_sequence:
			result.append(event.duplicate(true))
	return result

func event_history_size_for_acceptance() -> int:
	return state.events.size() if state != null else 0

func _end_round_maintenance() -> void:
	var domains: RefCounted = DomainRuntimeScript.new()
	for side: int in 2:
		var actor: Dictionary = state.actors[side]
		if is_domain_active(side): domains.maintain(state, side)
		var statuses: Dictionary = actor.statuses
		var base_regen: float = float(actor.get("ce_regen", actor.profile.get("ce_regen", 0.0))) + float((_strategies[side] as Dictionary).get("ce_regen_bonus", 0.0))
		var regen_scale: float = _ce_regen_scale(statuses)
		var regen: float = base_regen * regen_scale
		actor.ce = minf(float(actor.max_ce), float(actor.ce) + regen)
		for key: Variant in statuses.keys():
			if not statuses[key] is Dictionary: continue
			var status: Dictionary = statuses[key]
			if not status.has("rounds") or int(status.rounds) < 0: continue
			status.rounds = int(status.rounds) - 1
			if int(status.rounds) <= 0: statuses.erase(key)
		_advance_runtime_authorizations(actor)
		state.append_event("round_maintenance", {"actor_index":side, "ce_regen":regen, "ce_regen_base":base_regen, "ce_regen_scale":regen_scale})

## 镜像 duel-resource.js：回流断裂优先归零；受扰、增强和显式倍率在同一
## 回合维护边界结算，随后状态回合数才递减。
func _ce_regen_scale(statuses: Dictionary) -> float:
	if statuses.has("ceRegenBlocked"): return 0.0
	var penalty: float = 0.0
	var bonus: float = 0.0
	var override: float = 1.0
	for raw_status: Variant in statuses.values():
		if not raw_status is Dictionary: continue
		var status: Dictionary = raw_status as Dictionary
		if int(status.get("rounds", 1)) == 0: continue
		var status_id: String = str(status.get("id", ""))
		var value: float = float(status.get("value", 0.0))
		if status_id == "ceRegenInterference": penalty = maxf(penalty, value)
		elif status_id == "ceRegenBoost": bonus = maxf(bonus, value)
		if status.has("regenScale"): override = maxf(override, maxf(0.0, float(status.get("regenScale", 1.0))))
	return clampf(1.0 - penalty + bonus, 0.25, 2.8) * override

## 解锁与复制只在其生效回合结束时扣除持续时间；0 代表永久解锁。
func _advance_runtime_authorizations(actor: Dictionary) -> void:
	var tags: Dictionary = actor.get("temporary_technique_tags", {}) as Dictionary
	for slot: Variant in tags.keys():
		if not tags[slot] is Dictionary: continue
		var grant: Dictionary = tags[slot] as Dictionary
		if int(grant.get("activeFromRound", 0)) > state.round: continue
		if int(grant.get("remainingRounds", 0)) <= 0: continue
		grant["remainingRounds"] = int(grant.remainingRounds) - 1
		if int(grant.remainingRounds) <= 0: tags.erase(slot)
	actor["temporary_technique_tags"] = tags
	var pools: Array = actor.get("unlocked_card_pools", []) as Array
	var retained: Array = []
	for raw_pool: Variant in pools:
		if not raw_pool is Dictionary: continue
		var pool: Dictionary = raw_pool as Dictionary
		if int(pool.get("activeFromRound", 0)) <= state.round and pool.has("remainingRounds") and int(pool.get("remainingRounds", -1)) > 0:
			pool["remainingRounds"] = int(pool.remainingRounds) - 1
		if pool.has("remainingRounds") and int(pool.get("remainingRounds", -1)) == 0: continue
		retained.append(pool)
	actor["unlocked_card_pools"] = retained

func discard_player_card(card: Dictionary) -> Dictionary:
	if state == null or state.phase != &"DISCARD": return _failure("invalid_phase")
	var id: String = str(card.get("instance_id", ""))
	if _pending_discard_ids.has(id): return _failure("duplicate_instance_id")
	if not _find_cards(state.actors[0].zones.hand, [id]).ok: return _failure("card_not_in_hand")
	_pending_discard_ids.append(id)
	# 弃牌框须反映逐张拖入的真实进度；最终提交前，这个值就是还需拖入的张数。
	state.pending_discard_count = maxi(0, DISCARD_COUNT - _pending_discard_ids.size())
	_emit_event("discard_selection_updated", {"actor_index":0, "remaining":state.pending_discard_count})
	_publish_state()
	if _pending_discard_ids.size() < DISCARD_COUNT: return {"ok":true, "waiting":true, "remaining":state.pending_discard_count}
	var result: Dictionary = discard_cards(0, _pending_discard_ids, state.revision)
	_pending_discard_ids.clear()
	if result.ok and not _discarded_sides.has(1):
		var cpu_hand: Array = state.actors[1].zones.hand.duplicate()
		cpu_hand.sort_custom(func(a: Dictionary, b: Dictionary) -> bool: return _card_score(a) < _card_score(b))
		result = discard_cards(1, [cpu_hand[0].instance_id, cpu_hand[1].instance_id], state.revision)
	return result

func resolve_selected_cards(cards: Array) -> Dictionary:
	if state == null: return _failure("battle_not_started")
	var ids: Array = []
	var domains: Array = []
	for card: Dictionary in cards:
		var zone := str(card.get("zone", "")).to_lower()
		var category := str(card.get("category", card.get("type", ""))).to_lower()
		if zone == "domain" or category in ["domain", "domain_card", "领域", "领域牌"]: domains.append(card.get("instance_id", ""))
		else: ids.append(card.get("instance_id", ""))
	var submitted: Dictionary = submit_play(0, ids, domains, state.revision)
	if not submitted.ok: return submitted
	var cpu: Dictionary = choose_cpu_play()
	var cpu_result: Dictionary = submit_play(1, cpu.card_instance_ids, cpu.domain_instance_ids, state.revision)
	if not cpu_result.ok: return cpu_result
	return resolve_round(state.revision)

func choose_cpu_play() -> Dictionary:
	var chosen: Array = []
	var hand: Array = state.actors[1].zones.hand.duplicate()
	hand.sort_custom(func(a: Dictionary, b: Dictionary) -> bool: return _card_score(a) > _card_score(b))
	for card: Dictionary in hand:
		var candidate: Array = chosen.duplicate()
		candidate.append(card.instance_id)
		if validate_play({"actor_index":1, "card_instance_ids":candidate, "domain_instance_ids":[]}).ok: chosen = candidate
		if chosen.size() == 3: break
	var domain_ids: Array[String] = []
	var domain_hand: Array = state.actors[1].zones.domain
	if not bool(state.actors[1].domain_state.get("active", false)):
		for raw_card: Variant in domain_hand:
			if not raw_card is Dictionary: continue
			var domain_card: Dictionary = raw_card as Dictionary
			var candidate_domains: Array[String] = [str(domain_card.get("instance_id", ""))]
			var candidate: Dictionary = {"actor_index":1, "card_instance_ids":chosen.duplicate(), "domain_instance_ids":candidate_domains}
			if validate_play(candidate).ok:
				domain_ids = candidate_domains
				break
	return {"card_instance_ids":chosen, "domain_instance_ids":domain_ids}

func submit_card(side: int, card: Dictionary) -> Dictionary:
	if side == 0: return resolve_selected_cards([card])
	return submit_play(side, [card.get("instance_id", "")], [], state.revision)

func _card_score(card: Dictionary) -> float:
	var effect: Dictionary = card.get("effect", {})
	return float(effect.get("damage", 0.0)) + float(effect.get("healing", 0.0)) * 0.6 + float(effect.get("block", 0.0)) * 0.5 - float((card.get("cost", {}) as Dictionary).get("ce", 0.0)) * 0.15

func get_phase() -> StringName:
	return StringName(state.phase) if state != null else &"NONE"

func is_domain_active(side: int) -> bool:
	return state != null and side in [0, 1] and bool(state.actors[side].domain_state.get("active", false))

func get_winner() -> StringName:
	return StringName(state.winner) if state != null and state.finished else &"none"

func get_round_package() -> Dictionary:
	return _last_round_package.duplicate(true)

func get_state_snapshot() -> Dictionary:
	if state == null: return {}
	var snapshot: Dictionary = state.canonical_snapshot()
	snapshot["normal_hand"] = state.actors[0].zones.hand.duplicate(true)
	snapshot["domain_hand"] = state.actors[0].zones.domain.duplicate(true)
	snapshot["cpu_hand"] = state.actors[1].zones.hand.duplicate(true)
	snapshot["overflow_discard_required"] = state.pending_discard_count > 0
	snapshot["last_cpu_actions"] = _last_cpu_actions.duplicate(true)
	snapshot["last_round_actions"] = _last_round_actions.duplicate(true)
	snapshot["battle_log"] = state.events.duplicate(true)
	return snapshot

func save_round_package(path: String = "") -> Dictionary:
	if _last_round_package.is_empty(): return _failure("round_package_missing")
	if path.is_empty(): path = "user://battle_history/%s-round-%03d.json" % [state.seed, int(_last_round_package.round)]
	var error: Error = DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(path.get_base_dir()))
	if error != OK: return _failure("package_directory_failed")
	var file: FileAccess = FileAccess.open(path, FileAccess.WRITE)
	if file == null: return _failure("package_open_failed")
	if not file.store_string(JSON.stringify(_last_round_package)): return _failure("package_write_failed")
	return {"ok":true, "path":path}

func _update_winner() -> void:
	var left: bool = float(state.actors[0].hp) <= 0.0
	var right: bool = float(state.actors[1].hp) <= 0.0
	if not left and not right: return
	state.finished = true
	state.phase = &"FINISHED"
	state.winner = "draw" if left and right else "right" if left else "left"
	state.finish_reason = "hp_zero"

func _validate_command(phase: StringName, revision: int, side: int) -> Dictionary:
	if state == null: return _failure("battle_not_started")
	if state.finished: return _failure("battle_finished")
	if state.phase != phase: return _failure("invalid_phase")
	if side not in [0, 1]: return _failure("invalid_actor")
	if state.revision != revision: return _failure("stale_revision")
	return {"ok":true}

func _find_cards(hand: Array, ids: Array) -> Dictionary:
	var cards: Array = []
	var seen: Array = []
	for id: Variant in ids:
		if seen.has(id): return _failure("duplicate_instance_id")
		seen.append(id)
		var found: bool = false
		for card: Dictionary in hand:
			if str(card.get("instance_id", "")) == str(id):
				cards.append(card.duplicate(true))
				found = true
				break
		if not found: return _failure("card_not_in_hand")
	return {"ok":true, "cards":cards}

## 牌池可能由多个资格来源合并，同一 action 只能留下一个定义，避免发牌后出现同名同效果卡。
func _unique_action_pool(pool: Array) -> Array:
	var unique: Array = []
	var seen: Dictionary = {}
	for raw_card: Variant in pool:
		if not raw_card is Dictionary: continue
		var card: Dictionary = raw_card as Dictionary
		# UI 展示和卡牌规则都以卡牌 id 为准；同一 id 的 action 别名不能占用两个手牌位。
		var key: String = str(card.get("id", card.get("action_id", card.get("actionId", ""))))
		if key.is_empty() or seen.has(key): continue
		seen[key] = true
		unique.append(card.duplicate(true))
	return unique

## 以可用基础牌/术式牌的实际占比作为均值，用二项分布的正态近似采样。
## seed、round 和 side 共同决定 RNG，因此离线回放与未来联机同步都能复现同一配比。
func _normal_hand_distribution(basic_available: int, technique_available: int, rng: RandomNumberGenerator) -> Dictionary:
	var total_available: int = basic_available + technique_available
	var probability: float = float(technique_available) / float(total_available) if total_available > 0 else 0.0
	var mean: float = float(NORMAL_HAND_SIZE) * probability
	var deviation: float = sqrt(float(NORMAL_HAND_SIZE) * probability * (1.0 - probability))
	var sampled_technique: int = roundi(rng.randfn(mean, deviation)) if deviation > 0.0 else roundi(mean)
	var minimum_technique: int = maxi(0, NORMAL_HAND_SIZE - basic_available)
	var maximum_technique: int = mini(NORMAL_HAND_SIZE, technique_available)
	var technique_count: int = clampi(sampled_technique, minimum_technique, maximum_technique)
	return {"model":"normal", "basic_count":NORMAL_HAND_SIZE - technique_count, "technique_count":technique_count, "mean_technique":mean, "standard_deviation":deviation}

func _shuffle_pool(pool: Array, rng: RandomNumberGenerator) -> void:
	for index: int in range(pool.size() - 1, 0, -1):
		var swap_index: int = rng.randi_range(0, index)
		var swapped: Variant = pool[index]
		pool[index] = pool[swap_index]
		pool[swap_index] = swapped

## Filters only cards which are not legal deal candidates (unsupported tools,
## missing counters/summons/statuses, etc.).  Resource affordability belongs to
## CardAvailabilityService.evaluate() at play time, not to dealing.
func _deal_eligible_action_pool(pool: Array, side: int) -> Array:
	var eligible: Array = []
	var availability: RefCounted = AvailabilityScript.new()
	var snapshot: Dictionary = state.canonical_snapshot()
	for raw_card: Variant in pool:
		if not raw_card is Dictionary: continue
		var result: Variant = availability.evaluate_for_deal(raw_card as Dictionary, snapshot, side)
		if bool(result.playable) and bool(result.visible): eligible.append((raw_card as Dictionary).duplicate(true))
	return eligible

## 仅 explicit 解锁池允许越过角色初始归属；卡 ID 来自项目内权威 cards.json。
func _runtime_explicit_unlock_cards(side: int) -> Array[Dictionary]:
	var result: Array[Dictionary] = []
	if side not in [0, 1]: return result
	var actor: Dictionary = state.actors[side] as Dictionary
	var unlocked: Array = actor.get("unlocked_card_pools", []) as Array
	if unlocked.is_empty(): return result
	var by_id: Dictionary = {}
	for raw_card: Variant in DataRepositoryScript.new().cards():
		if raw_card is Dictionary: by_id[str((raw_card as Dictionary).get("id", ""))] = raw_card as Dictionary
	for raw_unlock: Variant in unlocked:
		if not raw_unlock is Dictionary: continue
		var unlock: Dictionary = raw_unlock as Dictionary
		if str(unlock.get("pool", "")) != "explicit": continue
		if not _runtime_authorization_active(unlock): continue
		for raw_id: Variant in unlock.get("cardIds", []) as Array:
			var card_id: String = str(raw_id)
			if by_id.has(card_id): result.append((by_id[card_id] as Dictionary).duplicate(true))
	return result

## 临时术式不伪造卡牌；将已解析的术式家族作为一次性候选资格，再复用既有筛选器。
func _runtime_temporary_technique_cards(side: int) -> Array[Dictionary]:
	var result: Array[Dictionary] = []
	if side not in [0, 1]: return result
	var actor: Dictionary = state.actors[side] as Dictionary
	var tags: Dictionary = actor.get("temporary_technique_tags", {}) as Dictionary
	var families: Array[String] = []
	for raw_tag: Variant in tags.values():
		if not raw_tag is Dictionary: continue
		var tag: Dictionary = raw_tag as Dictionary
		if not _runtime_authorization_active(tag): continue
		var family: String = str(tag.get("resolvedTechniqueFamily", "")).strip_edges()
		if not family.is_empty() and not families.has(family): families.append(family)
	if families.is_empty(): return result
	var profile: Dictionary = (actor.get("profile", {}) as Dictionary).duplicate(true)
	var profile_families: Array = profile.get("techniqueFamilies", []) as Array
	for family: String in families:
		if not profile_families.has(family): profile_families.append(family)
	profile["techniqueFamilies"] = profile_families
	var tag_set: Dictionary = profile.get("tag_set", {}) as Dictionary
	for family: String in families: tag_set[family] = true
	profile["tag_set"] = tag_set
	for card: Dictionary in CandidateBuilderScript.new().eligible(profile, "normal"):
		if _matches_temporary_technique_family(card, families): result.append(card)
	return result

func _matches_temporary_technique_family(card: Dictionary, families: Array[String]) -> bool:
	if families.has(str(card.get("sourceTechniqueFamily", ""))): return true
	for key: String in ["matchTags", "tags"]:
		for raw_tag: Variant in card.get(key, []) as Array:
			if families.has(str(raw_tag)): return true
	return false

func _runtime_authorization_active(authorization: Dictionary) -> bool:
	var active_from_round: int = int(authorization.get("activeFromRound", authorization.get("active_from_round", 0)))
	if active_from_round > state.round: return false
	if not authorization.has("remainingRounds") and not authorization.has("remaining_rounds"): return true
	var remaining: int = int(authorization.get("remainingRounds", authorization.get("remaining_rounds", -1)))
	return remaining != 0

func _instance_card(raw: Dictionary, side: int, zone: StringName, slot: int) -> Dictionary:
	var card: Dictionary = raw.duplicate(true)
	card["instance_id"] = "%s:%s:%s:%s:%s" % [state.seed, state.round, side, zone, slot]
	card["zone"] = String(zone)
	card["action_id"] = str(card.get("action_id", card.get("actionId", card.get("id", ""))))
	var cost: Dictionary = card.get("cost", {})
	cost.erase("ap")
	card["cost"] = cost
	card.erase("ap")
	card.erase("apCost")
	if zone == &"domain": card["type"] = "domain"
	return card

func _resolve_card_cost(target_state: RefCounted, side: int, card: Dictionary) -> Dictionary:
	var actor: Dictionary = target_state.actors[side] as Dictionary
	var target: Dictionary = target_state.actors[1 - side] as Dictionary
	var resolved: Dictionary = _resolution_pipeline.resolve_cost(card, actor, target, target_state, side)
	if not bool(resolved.get("ok", false)):
		return resolved
	var final_cost := float(resolved.get("ce_cost", 0.0))
	# BattleResolutionPipeline is the single cost authority for both preview and
	# commit.  It reads the strategy snapshot for compatibility sessions and the
	# materialized actor attributes for V3 sessions; never apply a second local
	# multiplier here.
	return {"ok":true, "cost":final_cost, "trace":resolved.get("trace", [])}

## 发牌分类只决定候选池，不参与任何费用计算；费用唯一由 BattleResolutionPipeline 计算。
func _is_technique_card(card: Dictionary) -> bool:
	var type: String = str(card.get("type", "")).to_lower()
	if type in ["technique", "spell", "术式"]:
		return true
	var tags: Array = card.get("tags", []) as Array
	return tags.has("technique") or tags.has("术式") or not str(card.get("sourceTechniqueFamily", "")).is_empty()

func _resolve_domain_id(profile: Dictionary) -> String:
	var explicit_id: String = str(profile.get("domainId", ""))
	if not explicit_id.is_empty(): return explicit_id
	if not bool((profile.get("flags", {}) as Dictionary).get("hasDomainAccess", false)): return ""
	var character_id: String = str(profile.get("id", ""))
	var repository: RefCounted = DataRepositoryScript.new()
	for raw_domain: Variant in repository.domains():
		if raw_domain is Dictionary and str((raw_domain as Dictionary).get("ownerId", "")) == character_id:
			return str((raw_domain as Dictionary).get("id", ""))
	return ""

func _split_pool(cards: Array[Dictionary]) -> Dictionary:
	var basic: Array[Dictionary] = []
	var technique: Array[Dictionary] = []
	for card: Dictionary in cards:
		var tags: Array = card.get("tags", [])
		var type: String = str(card.get("type", ""))
		if type == "domain" or tags.has("domain_expand"): continue
		if type in ["technique", "spell", "术式"] or tags.has("technique") or tags.has("术式") or not str(card.get("sourceTechniqueFamily", "")).is_empty(): technique.append(card)
		else: basic.append(card)
	return {"basic":basic, "technique":technique}

func _emit_event(event_type: String, payload: Dictionary) -> void:
	state.append_event(event_type, payload)
	state_committed.emit(state)
	events_produced.emit([state.events.back()])

func _publish_state() -> void:
	for side: int in 2: resources_changed.emit(side, state.actors[side].duplicate(true))
	var snapshot: Dictionary = get_state_snapshot()
	hand_updated.emit(snapshot.normal_hand, snapshot.domain_hand)
	state_committed.emit(state)

## Applies a server-authoritative canonical projection and republishes the
## normal session signals so the presenter rebuilds hands and controls.
func apply_authority_snapshot(snapshot: Dictionary) -> void:
	if state == null or snapshot.is_empty(): return
	state.restore_canonical_snapshot(snapshot)
	_publish_state()

func _success() -> Dictionary:
	return {"ok":true, "phase":String(state.phase), "revision":state.revision, "state":state}

func _failure(reason: String) -> Dictionary:
	return {"ok":false, "error":reason}

