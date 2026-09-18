class_name CardAvailabilityService
extends RefCounted

const RESULT_SCRIPT: Script = preload("res://battle/data/CardAvailabilityResult.gd")
const ATOMIC_EFFECT_INTERPRETER_SCRIPT: Script = preload("res://battle/runtime/AtomicEffectInterpreter.gd")
const CORE_ACTION_RESOLVER_SCRIPT: Script = preload("res://battle/core/CoreActionResolver.gd")
const COST_RESOLVER_SCRIPT: Script = preload("res://battle/core/ActionCostResolver.gd")
const V3_INTENT_SCRIPT: Script = preload("res://battle/v3/ActionIntentV3.gd")
const V3_RESOLVER_SCRIPT: Script = preload("res://battle/v3/ActionResolverV3.gd")
const STATE_SCRIPT: Script = preload("res://battle/core/BattleState.gd")

## V3 只读可用性入口。传入 BattleState 对象时，预览、费用和动态值都来自
## 同一个 ActionResolverV3 结果；旧 evaluate() 仅保留给尚未迁移的联机兼容会话。
func evaluate_v3(card: Dictionary, battle_state: BattleState, actor_index: int, selected_cards: Array = []) -> Dictionary:
	if battle_state == null or actor_index not in [0, 1]: return {"ok":false, "playable":false, "visible":true, "reason":"invalid_state"}
	var actor: Dictionary = battle_state.actors[actor_index] as Dictionary
	if _is_technique_card(card) and _technique_burnout_active(actor):
		return {"ok":false, "playable":false, "visible":true, "reason":"technique_burnout"}
	var summon_block: String = _summon_capacity_reason(card, actor)
	if not summon_block.is_empty():
		return {"ok":false, "playable":false, "visible":true, "reason":summon_block}
	var ids: Array[String] = []
	for selected: Variant in selected_cards:
		if selected is Dictionary:
			var selected_data: Dictionary = selected as Dictionary
			var selected_id: String = str(selected_data.get("instance_id", selected_data.get("id", "")))
			if not selected_id.is_empty() and not ids.has(selected_id): ids.append(selected_id)
	var card_id: String = str(card.get("instance_id", card.get("id", "")))
	if card_id.is_empty(): return {"ok":false, "playable":false, "visible":true, "reason":"card_instance_id_missing"}
	if not ids.has(card_id): ids.append(card_id)
	var zone := str(card.get("zone", "")).to_lower()
	var category := str(card.get("category", card.get("type", ""))).to_lower()
	var is_domain := zone == "domain" or category in ["domain", "domain_card", "领域", "领域牌"]
	var intent_data := {"actor_index":actor_index, "card_instance_ids":ids}
	if is_domain:
		intent_data["card_instance_ids"] = []
		intent_data["domain_instance_ids"] = [card_id]
	var intent: ActionIntentV3 = V3_INTENT_SCRIPT.from_dictionary(intent_data)
	var result: Dictionary = V3_RESOLVER_SCRIPT.new().preview_action(battle_state, intent)
	if not bool(result.get("ok", false)): return {"ok":false, "playable":false, "visible":true, "reason":str(result.get("error", "rejected")), "resolution":result}
	var actions: Array = result.get("actions", []) as Array
	var candidate_action_index: int = ids.find(card_id)
	var action: Dictionary = actions[candidate_action_index] as Dictionary if candidate_action_index >= 0 and candidate_action_index < actions.size() else actions[actions.size() - 1] as Dictionary if not actions.is_empty() else {}
	var values: Dictionary = action.get("values", {}) as Dictionary
	var mitigation: Dictionary = action.get("mitigation", {}) as Dictionary
	var cost: Dictionary = action.get("cost", {}) as Dictionary
	return {
		"ok":true,
		"playable":true,
		"visible":true,
		"reason":"",
		"ce_cost":float(cost.get("resolved_ce", 0.0)),
		"resolved_values":values.duplicate(true),
		"mitigation":mitigation.duplicate(true),
		"outcome":(action.get("outcome", {}) as Dictionary).duplicate(true),
		"actions":actions.duplicate(true),
		"resolution":result
	}

## Evaluates whether a card may be selected for the current action.
##
## This is the strict, play-time check.  In particular it includes the
## current CE balance (and the CE of cards already selected this action).
func evaluate(card: Dictionary, battle_state: Dictionary, actor_index: int, selected_cards: Array, preview_selected: bool = true) -> Variant:
	if str(battle_state.get("ruleset_version", "")) == "battle-rules-v3":
		return evaluate_v3(card, _restore_v3_state(battle_state), actor_index, selected_cards)
	return _evaluate(card, battle_state, actor_index, selected_cards, preview_selected, true)

## Evaluates whether a card is eligible to enter a dealt hand.
##
## Dealing and playing are intentionally different gates.  A card which is
## legal for the character but cannot currently be paid for must still be
## dealt; it is shown disabled and is rejected by evaluate() when the player
## actually submits it.  This matches the source game's hand semantics and
## prevents zero-CE characters from losing most of their hand before play.
func evaluate_for_deal(card: Dictionary, battle_state: Dictionary, actor_index: int) -> Variant:
	if str(battle_state.get("ruleset_version", "")) == "battle-rules-v3":
		# 发牌时卡牌尚未拥有正式 instance_id，也不在 hand。用临时实例进入
		# 副本手牌执行相同的 require/calculate 预览；CE 可支付性仍只在出牌时检查。
		var preview_state: BattleState = _restore_v3_state(battle_state)
		var candidate: Dictionary = card.duplicate(true)
		candidate["instance_id"] = "__deal_preview__:%s" % str(card.get("id", card.get("action_id", "candidate")))
		var actor: Dictionary = preview_state.actors[actor_index] as Dictionary
		var zones: Dictionary = actor.get("zones", {}) as Dictionary
		var hand: Array = zones.get("hand", []) as Array
		hand.append(candidate)
		zones["hand"] = hand
		actor["zones"] = zones
		preview_state.actors[actor_index] = actor
		var result: Dictionary = evaluate_v3(candidate, preview_state, actor_index, [])
		if str(result.get("reason", "")) == "insufficient_ce":
			result["ok"] = true
			result["playable"] = true
			result["reason"] = ""
		result["visible"] = bool(result.get("ok", false))
		return result
	return _evaluate(card, battle_state, actor_index, [], false, false)

func _restore_v3_state(snapshot: Dictionary) -> BattleState:
	var state: BattleState = STATE_SCRIPT.new()
	state.restore_canonical_snapshot(snapshot)
	return state

func _evaluate(card: Dictionary, battle_state: Dictionary, actor_index: int, selected_cards: Array, preview_selected: bool, check_resource_cost: bool) -> Variant:
	var result: Variant = RESULT_SCRIPT.new()
	var inspected_state: Dictionary = _preview_selected_state(battle_state, actor_index, selected_cards, card) if preview_selected else battle_state
	var actor: Dictionary = _actor(inspected_state, actor_index)
	var opponent: Dictionary = _actor(inspected_state, 1 - actor_index)
	var unsupported_tool: String = CORE_ACTION_RESOLVER_SCRIPT.first_unsupported_atomic_tool(card)
	if not unsupported_tool.is_empty(): return _blocked(result, "当前版本暂不支持：" + unsupported_tool, {"hideWhenUnavailable": true})
	var value_preview: Dictionary = CORE_ACTION_RESOLVER_SCRIPT.new().preview_action_values(card, actor, opponent, inspected_state)
	if bool(value_preview.get("ok", false)):
		result.resolved_values = (value_preview.get("values", {}) as Dictionary).duplicate(true)
	result.ce_cost = _resolved_ce_cost(card, actor, opponent, inspected_state, actor_index, value_preview)
	# 选牌区的卡还没有扣费。可用性必须将“已有选牌 + 当前牌”一起
	# 计算，否则 UI 会在结算时才暴露 CE 不足。
	if check_resource_cost:
		var selected_cost: float = _selected_ce_cost(battle_state, actor_index, selected_cards, card)
		var starting_actor: Dictionary = _actor(battle_state, actor_index)
		if float(starting_actor.get("ce", actor.get("ce", 0.0))) + 0.0001 < selected_cost + result.ce_cost:
			return _blocked(result, "咒力不足")
	# 单独使用牌已经在待选区时，任何其他候选都必须先被锁定；不能等到
	# 候选自身拥有 selection_rule 才检查，否则普通牌会绕过全力防御/避其锋芒。
	var existing_solo_reason: String = _existing_solo_reason(card, selected_cards)
	if not existing_solo_reason.is_empty(): return _blocked(result, existing_solo_reason, {"uiReason":"限制使用"})
	for effect: Dictionary in _preflight_effects(card):
		var params: Dictionary = effect.get("params", {}) as Dictionary
		var tool: String = str(effect.get("tool", ""))
		if tool == "require_status" and not (actor.get("statuses", {}) as Dictionary).has(str(params.get("statusId", ""))): return _blocked(result, str(params.get("reason", "需要状态")))
		if tool == "require_summon" and not _summon_requirement_met(params, actor, opponent): return _blocked(result, str(params.get("reason", "需要召唤物")), params)
		if tool == "require_value" and not _value_requirement_met(params, actor, inspected_state): return _blocked(result, str(params.get("reason", "数值条件不足")), params)
		if tool == "consume_counter" and not _counter_requirement_met(params, actor): return _blocked(result, str(params.get("reason", "计数器不足")), params)
		if tool == "selection_rule":
			result.selection_mode = str(params.get("mode", ""))
			result.conflict_group = str(params.get("groupId", ""))
			var selection_reason: String = _selection_reason(card, selected_cards, result.selection_mode, result.conflict_group, str(params.get("reason", "选择冲突")))
			if not selection_reason.is_empty(): return _blocked(result, selection_reason, {"uiReason":"限制使用"})
	return result

func evaluate_hand(cards: Array[Dictionary], battle_state: Dictionary, actor_index: int, selected_cards: Array[Dictionary]) -> Dictionary:
	var results: Dictionary = {}
	for card: Dictionary in cards: results[str(card.get("id", ""))] = evaluate(card, battle_state, actor_index, selected_cards)
	return results

func _preview_selected_state(battle_state: Dictionary, actor_index: int, selected_cards: Array, candidate: Dictionary = {}) -> Dictionary:
	if selected_cards.is_empty(): return battle_state
	var preview: Dictionary = battle_state.duplicate(true)
	var actors: Array = preview.get("actors", []) as Array
	if actor_index < 0 or actor_index >= actors.size(): return preview
	var source: Dictionary = actors[actor_index] as Dictionary
	var target: Dictionary = actors[1 - actor_index] as Dictionary if actors.size() > 1 else {}
	var interpreter: AtomicEffectInterpreter = ATOMIC_EFFECT_INTERPRETER_SCRIPT.new() as AtomicEffectInterpreter
	var candidate_instance: String = str(candidate.get("instance_id", ""))
	for selected_card: Dictionary in selected_cards:
		# 刷新已拖入／待选区的牌时，候选自身不能再次消耗资源；只预演其余
		# 已选牌对当前候选造成的状态与计数器影响。
		if not candidate_instance.is_empty() and candidate_instance == str(selected_card.get("instance_id", "")):
			continue
		for raw_effect: Variant in _all_atomic_effects(selected_card):
			if not raw_effect is Dictionary: continue
			var effect: Dictionary = raw_effect as Dictionary
			if not _changes_availability_state(str(effect.get("tool", ""))): continue
			interpreter.execute_atomic_effect(effect, preview, source, target)
	return preview

func _selected_ce_cost(battle_state: Dictionary, actor_index: int, selected_cards: Array, candidate: Dictionary) -> float:
	var total: float = 0.0
	var candidate_instance: String = str(candidate.get("instance_id", ""))
	var actor: Dictionary = _actor(battle_state, actor_index)
	var opponent: Dictionary = _actor(battle_state, 1 - actor_index)
	for selected: Variant in selected_cards:
		if not selected is Dictionary: continue
		var selected_card: Dictionary = selected as Dictionary
		# 刷新已选卡自己时，它已经包含在 selected_cards，不能重复加一次。
		if not candidate_instance.is_empty() and candidate_instance == str(selected_card.get("instance_id", "")): continue
		total += _resolved_ce_cost(selected_card, actor, opponent, battle_state, actor_index)
	return total

func _resolved_ce_cost(card: Dictionary, actor: Dictionary, opponent: Dictionary, battle_state: Dictionary, actor_index: int, provided_preview: Dictionary = {}) -> float:
	var cost: Dictionary = card.get("cost", {}) as Dictionary
	var base: float = COST_RESOLVER_SCRIPT.new().resolve_ce_cost(cost, float(actor.get("max_ce", actor.get("ce", 0.0))))
	var preview: Dictionary = provided_preview if not provided_preview.is_empty() else CORE_ACTION_RESOLVER_SCRIPT.new().preview_action_values(card, actor, opponent, battle_state)
	if bool(preview.get("ok", false)):
		base = maxf(base, float((preview.get("values", {}) as Dictionary).get("ce_cost", 0.0)))
	var strategies: Array = battle_state.get("strategy_snapshot", []) as Array
	if actor_index >= 0 and actor_index < strategies.size() and strategies[actor_index] is Dictionary and _is_technique_card(card):
		base *= float((strategies[actor_index] as Dictionary).get("technique_cost_multiplier", 1.0))
	var domain_state: Dictionary = actor.get("domain_state", {}) as Dictionary
	if bool(domain_state.get("active", false)):
		base *= float((domain_state.get("effect_profile", {}) as Dictionary).get("ce_cost_multiplier", 1.0))
	return maxf(0.0, base)

func _is_technique_card(card: Dictionary) -> bool:
	var type: String = str(card.get("type", "")).to_lower()
	var tags: Array = card.get("tags", []) as Array
	return type in ["technique", "spell", "术式"] or tags.has("technique") or tags.has("术式") or not str(card.get("sourceTechniqueFamily", "")).is_empty()

func _technique_burnout_active(actor: Dictionary) -> bool:
	var statuses: Dictionary = actor.get("statuses", {}) as Dictionary
	for key: Variant in ["technique_burnout", "techniqueBurnout", "technique_imbalance", "techniqueImbalance"]:
		if statuses.has(key):
			var status: Variant = statuses[key]
			if not status is Dictionary or int((status as Dictionary).get("rounds", 1)) != 0:
				return true
	return false

func _summon_capacity_reason(card: Dictionary, actor: Dictionary) -> String:
	var summons: Array = actor.get("summons", []) as Array
	if summons.size() < 3: return ""
	for raw_effect: Variant in _all_atomic_effects(card):
		if not raw_effect is Dictionary: continue
		var effect: Dictionary = raw_effect as Dictionary
		if str(effect.get("tool", "")) != "summon_unit": continue
		var params: Dictionary = effect.get("params", {}) as Dictionary
		var summon_id: String = str(params.get("unitId", params.get("summonId", params.get("id", ""))))
		for raw_summon: Variant in summons:
			if raw_summon is Dictionary and str((raw_summon as Dictionary).get("id", "")) == summon_id:
				return ""
		return "summon_limit_reached"
	return ""

func _all_atomic_effects(card: Dictionary) -> Array:
	var special_value: Variant = (card.get("effect", {}) as Dictionary).get("special", {})
	var special: Dictionary = special_value as Dictionary if special_value is Dictionary else {}
	var raw_effects: Variant = special.get("atomicEffects", [])
	if raw_effects is Array: return raw_effects as Array
	if raw_effects is Dictionary: return [raw_effects as Dictionary]
	return []

func _changes_availability_state(tool: String) -> bool:
	return tool == "set_counter" or tool == "adjust_counter" or tool == "consume_counter" or tool == "add_status" or tool == "remove_status" or tool == "modify_status" or tool == "summon_unit" or tool == "destroy_summon" or tool == "recall_summon" or tool == "unlock_card_pool" or tool == "grant_temporary_technique_tag"

func _actor(state: Dictionary, actor_index: int) -> Dictionary:
	var actors: Array = state.get("actors", [])
	return actors[actor_index] as Dictionary if actor_index >= 0 and actor_index < actors.size() else {}

func _preflight_effects(card: Dictionary) -> Array[Dictionary]:
	var result: Array[Dictionary] = []
	for effect: Variant in _all_atomic_effects(card):
		if not effect is Dictionary: continue
		var typed_effect: Dictionary = effect as Dictionary
		var tool: String = str(typed_effect.get("tool", ""))
		var trigger: String = str(typed_effect.get("trigger", ""))
		if trigger == "availability" or tool == "require_status" or tool == "require_summon" or tool == "require_value" or tool == "consume_counter" or tool == "selection_rule": result.append(typed_effect)
	return result

func _selection_reason(card: Dictionary, selected_cards: Array, mode: String, group_id: String, fallback: String) -> String:
	# 刷新已选牌时 selected_cards 包含候选自身；规则只应比较“其他”牌，
	# 否则单独使用牌刚进入待选区便会错误地锁死自己。
	var others: Array[Dictionary] = _other_selected_cards(card, selected_cards)
	if mode == "solo" and not others.is_empty(): return fallback
	var permitted_groups: Array[String] = []
	for selected: Dictionary in others:
		for effect: Dictionary in _preflight_effects(selected):
			var permit_params: Dictionary = effect.get("params", {}) as Dictionary
			if str(effect.get("tool", "")) == "selection_rule" and str(permit_params.get("mode", "")) == "permit-conflict-group": permitted_groups.append(str(permit_params.get("groupId", "")))
	for selected: Dictionary in others:
		for effect: Dictionary in _preflight_effects(selected):
			var params: Dictionary = effect.get("params", {}) as Dictionary
			if str(effect.get("tool", "")) != "selection_rule": continue
			var selected_mode: String = str(params.get("mode", ""))
			if selected_mode == "solo": return str(params.get("reason", "必须单独使用"))
			if mode == "conflict-group" and selected_mode == "conflict-group" and group_id == str(params.get("groupId", "")) and not permitted_groups.has(group_id): return fallback
	return ""

func _other_selected_cards(card: Dictionary, selected_cards: Array) -> Array[Dictionary]:
	var others: Array[Dictionary] = []
	var candidate_instance: String = str(card.get("instance_id", ""))
	for raw_selected: Variant in selected_cards:
		if not raw_selected is Dictionary: continue
		var selected: Dictionary = raw_selected as Dictionary
		if not candidate_instance.is_empty() and candidate_instance == str(selected.get("instance_id", "")):
			continue
		others.append(selected)
	return others

func _existing_solo_reason(card: Dictionary, selected_cards: Array) -> String:
	for selected: Dictionary in _other_selected_cards(card, selected_cards):
		for effect: Dictionary in _preflight_effects(selected):
			if str(effect.get("tool", "")) != "selection_rule": continue
			var params: Dictionary = effect.get("params", {}) as Dictionary
			if str(params.get("mode", "")) == "solo": return str(params.get("reason", "限制使用"))
	return ""

func _value_requirement_met(params: Dictionary, actor: Dictionary, state: Dictionary) -> bool:
	var source: String = str(params.get("source", params.get("field", "")))
	var value: float = _requirement_value(source, params, actor, state)
	var threshold: float = float(params.get("threshold", params.get("minimum", 0.0)))
	match str(params.get("operator", ">=")):
		">": return value > threshold
		">=": return value >= threshold
		"==": return is_equal_approx(value, threshold)
		"<=": return value <= threshold
		"<": return value < threshold
	return false

func _requirement_value(source: String, params: Dictionary, actor: Dictionary, state: Dictionary) -> float:
	if source == "round": return float(state.get("round", 0))
	if source == "counter":
		var counters: Dictionary = actor.get("counters", {}) as Dictionary
		var counter_id: String = str(params.get("counterId", ""))
		var namespace_id: String = str(params.get("namespace", ""))
		if not namespace_id.is_empty() and counters.get(namespace_id, {}) is Dictionary:
			return float((counters.get(namespace_id, {}) as Dictionary).get(counter_id, 0.0))
		return float(counters.get(counter_id, 0.0))
	return float(actor.get(source.trim_prefix("self."), 0.0))

func _counter_requirement_met(params: Dictionary, actor: Dictionary) -> bool:
	var counters: Dictionary = actor.get("counters", {}) as Dictionary
	var counter_id: String = str(params.get("counterId", ""))
	var namespace_id: String = str(params.get("namespace", ""))
	var value: float = float(counters.get(counter_id, 0.0))
	if not namespace_id.is_empty() and counters.get(namespace_id, {}) is Dictionary:
		value = float((counters.get(namespace_id, {}) as Dictionary).get(counter_id, 0.0))
	return value >= float(params.get("amount", 1.0))

func _summon_requirement_met(params: Dictionary, actor: Dictionary, opponent: Dictionary) -> bool:
	var owner: String = str(params.get("owner", "self"))
	var required_id: String = str(params.get("summonId", ""))
	var active_only: bool = bool(params.get("activeOnly", false))
	var summons: Array = actor.get("summons", []) as Array if owner != "opponent" else opponent.get("summons", []) as Array
	var found: bool = false
	for raw_summon: Variant in summons:
		if not raw_summon is Dictionary: continue
		var summon: Dictionary = raw_summon as Dictionary
		if not required_id.is_empty() and str(summon.get("id", "")) != required_id: continue
		if active_only and not bool(summon.get("active", true)): continue
		found = true
		break
	return not found if str(params.get("presence", "present")) == "absent" else found

func _blocked(result: Variant, reason: String, params: Dictionary = {}) -> Variant:
	result.playable = false
	result.reason = reason
	result.ui_reason = str(params.get("uiReason", ""))
	if bool(params.get("hideWhenUnavailable", false)) or bool(params.get("removeWhenUnavailable", false)): result.visible = false
	return result

