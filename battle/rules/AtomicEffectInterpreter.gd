class_name AtomicEffectInterpreter
extends RefCounted

const SUPPORTED_TOOLS: Array[String] = [
	"damage", "ce_damage", "heal", "block", "shield", "modify_hp", "modify_ce",
	"adjust_resource", "pay_hp_cost", "set_counter", "adjust_counter", "consume_counter",
	"selection_rule", "require_status", "require_summon", "require_summon_group", "require_value",
	"compute_action_value", "set_damage_policy", "set_action_mode", "register_counter_modifier",
	"set_action_order", "modify_damage", "modify_scale", "modify_weight", "adjust_action_resource",
	"unlock_card_pool", "grant_temporary_technique_tag", "branch_on_value", "schedule_effect",
	"advance_timer", "cancel_timer", "add_status", "apply_barrier", "add_computed_status",
	"remove_status", "modify_status", "grant_card", "discard_card", "remove_card", "transform_card",
	"summon_unit", "summon_group_action", "update_summon", "destroy_summon", "recall_summon",
	"delegate_control", "end_delegation", "emit_battle_event", "set_targeting", "set_combat_range"
]

func is_supported_tool(tool: String) -> bool:
	return SUPPORTED_TOOLS.has(tool)

func execute_atomic_effect(effect: Dictionary, state: Dictionary, source: Dictionary, target: Dictionary) -> Dictionary:
	var tool: String = str(effect.get("tool", ""))
	if not is_supported_tool(tool): return _error(state, tool, "Unknown atomic effect tool: " + tool)
	var params: Dictionary = effect.get("params", {}) if effect.get("params", {}) is Dictionary else {}
	var receiver: Dictionary = _receiver(effect, source, target)
	match tool:
		"damage": return _apply_damage(effect, params, _resolve_damage_target(effect, params, target), _number(effect, params, "amount", 0.0), tool)
		"ce_damage": return _change_value(target, "ce", -_number(effect, params, "amount", 0.0), tool)
		"heal": return _change_value(receiver, "hp", _number(effect, params, "amount", 0.0), tool)
		"block", "shield", "apply_barrier": return _change_value(receiver, "guard", _number(effect, params, "amount", 0.0), tool)
		"modify_hp": return _change_value(receiver, "hp", _number(effect, params, "amount", 0.0), tool)
		"modify_ce": return _change_value(receiver, "ce", _number(effect, params, "amount", 0.0), tool)
		"adjust_resource": return _adjust_resource(receiver, effect, params)
		"pay_hp_cost": return _pay_hp_cost(source, effect, params)
		"set_counter": return _set_counter(source, effect, params)
		"adjust_counter": return _adjust_counter(source, effect, params)
		"consume_counter": return _consume_counter(source, effect, params)
		"selection_rule", "require_status", "require_summon", "require_summon_group", "require_value": return _check_requirement(tool, state, source, target, effect, params)
		"compute_action_value", "modify_damage", "modify_scale", "modify_weight", "adjust_action_resource", "set_action_mode", "set_action_order", "set_damage_policy", "set_targeting", "set_combat_range": return _modify_action_context(tool, state, source, target, effect, params)
		"register_counter_modifier": return _append_state_item(state, "counter_modifiers", {"tool": tool, "params": params}, tool)
		"unlock_card_pool": return _unlock_card_pool(source, params)
		"grant_temporary_technique_tag": return _grant_temporary_technique_tag(source, params)
		"branch_on_value": return {"ok": true, "tool": tool, "branch": str(params.get("branch", "default"))}
		"schedule_effect": return _append_state_item(state, "timers", {"id": params.get("id", effect.get("id", "timer")), "rounds": int(params.get("rounds", 1)), "effect": params.get("effect", {})}, tool)
		"advance_timer": return _advance_timer(state, params)
		"cancel_timer": return _cancel_timer(state, params)
		"add_status", "add_computed_status": return _add_status(target if not effect.has("target") else receiver, effect, params, tool)
		"remove_status": return _remove_status(receiver, effect, params, tool)
		"modify_status": return _modify_status(receiver, effect, params, tool)
		"grant_card": return _append_state_item(state, "granted_cards", {"card_id": params.get("cardId", "")}, tool)
		"discard_card", "remove_card", "transform_card": return _append_state_item(state, "card_mutations", {"tool": tool, "params": params}, tool)
		"summon_unit": return _summon(source, effect, params)
		"summon_group_action", "update_summon", "destroy_summon", "recall_summon": return _summon_operation(source, tool, params)
		"delegate_control", "end_delegation": return _append_state_item(state, "delegations", {"tool": tool, "params": params}, tool)
		"emit_battle_event": return _append_state_item(state, "events", {"id": params.get("eventId", effect.get("id", "event")), "params": params}, tool)
	return _error(state, tool, "Unhandled atomic effect tool: " + tool)

func _receiver(effect: Dictionary, source: Dictionary, target: Dictionary) -> Dictionary:
	return target if str(effect.get("target", "self")) == "opponent" else source

func _resolve_damage_target(effect: Dictionary, params: Dictionary, defender: Dictionary) -> Dictionary:
	var summon_id: String = str(effect.get("targetSummonId", params.get("targetSummonId", "")))
	var raw_target: Variant = effect.get("target", null)
	if raw_target is Dictionary and str((raw_target as Dictionary).get("type", "")) == "summon":
		summon_id = str((raw_target as Dictionary).get("summonId", (raw_target as Dictionary).get("id", summon_id)))
	var selected: Dictionary = {}
	var selected_priority: int = -2147483648
	for raw_summon: Variant in _ensure_array(defender, "summons"):
		if not raw_summon is Dictionary: continue
		var summon: Dictionary = raw_summon as Dictionary
		var guard_rules: Dictionary = summon.get("guardRules", {}) as Dictionary
		var matches_id: bool = not summon_id.is_empty() and str(summon.get("id", "")) == summon_id
		var intercepts: bool = summon_id.is_empty() and bool(guard_rules.get("interceptsOpponentAttacks", false))
		if not matches_id and not intercepts: continue
		var priority: int = int(guard_rules.get("priority", 0))
		if selected.is_empty() or priority > selected_priority:
			selected = summon
			selected_priority = priority
	return selected if not selected.is_empty() else defender

func _apply_damage(effect: Dictionary, params: Dictionary, defender: Dictionary, amount: float, tool: String) -> Dictionary:
	var summon_id: String = str(effect.get("targetSummonId", params.get("targetSummonId", "")))
	var raw_target: Variant = effect.get("target", null)
	if raw_target is Dictionary and str((raw_target as Dictionary).get("type", "")) == "summon":
		summon_id = str((raw_target as Dictionary).get("summonId", (raw_target as Dictionary).get("id", summon_id)))
	if summon_id.is_empty():
		return _change_value(defender, "hp", -amount, tool)
	var summons: Array = _ensure_array(defender, "summons")
	for index: int in summons.size():
		if not summons[index] is Dictionary or str((summons[index] as Dictionary).get("id", "")) != summon_id: continue
		var summon: Dictionary = summons[index] as Dictionary
		var reduction: float = clampf(float(summon.get("damageReductionRatio", 0.0)), 0.0, 0.95)
		var defense: float = maxf(0.0, float(summon.get("defense", 0.0)))
		var applied: float = maxf(0.0, amount * (1.0 - reduction) - defense)
		summon["hp"] = clampf(float(summon.get("hp", 0.0)) - applied, 0.0, float(summon.get("max_hp", INF)))
		if float(summon.get("hp", 0.0)) <= 0.0: summons.remove_at(index)
		else: summons[index] = summon
		defender["summons"] = summons
		return {"ok": true, "tool": tool, "target_kind": "summon", "summon_id": summon_id, "damage": applied}
	return {"ok": false, "tool": tool, "error": "summon_not_found", "summon_id": summon_id}

func _number(effect: Dictionary, params: Dictionary, key: String, fallback: float) -> float:
	return float(effect.get(key, params.get(key, fallback)))

func _adjust_resource(receiver: Dictionary, effect: Dictionary, params: Dictionary) -> Dictionary:
	var field: String = str(params.get("resource", params.get("field", effect.get("field", "ce"))))
	if not ["hp", "ce", "guard", "stability", "domain_load"].has(field): return {"ok": false, "error": "invalid_resource"}
	return _change_value(receiver, field, _number(effect, params, "amount", 0.0), "adjust_resource")

func _pay_hp_cost(source: Dictionary, effect: Dictionary, params: Dictionary) -> Dictionary:
	var amount: float = _number(effect, params, "amount", 0.0) + float(source.get("max_hp", 0.0)) * float(params.get("ratio", 0.0))
	var minimum: float = 1.0 if bool(params.get("nonlethal", false)) else 0.0
	if float(source.get("hp", 0.0)) - amount < minimum: return {"ok": false, "error": "insufficient_hp"}
	source["hp"] = float(source.get("hp", 0.0)) - amount
	return {"ok": true, "tool": "pay_hp_cost", "amount": amount}

func _set_counter(source: Dictionary, effect: Dictionary, params: Dictionary) -> Dictionary:
	var counter_id: String = str(params.get("counterId", effect.get("counter_id", "")))
	_remember_counter_label(source, params, counter_id)
	_counter_store(source, params)[counter_id] = params.get("value", effect.get("value", 0))
	return {"ok": true, "tool": "set_counter", "counter_id": counter_id}

func _adjust_counter(source: Dictionary, effect: Dictionary, params: Dictionary) -> Dictionary:
	var counter_id: String = str(params.get("counterId", effect.get("counter_id", "")))
	_remember_counter_label(source, params, counter_id)
	var counters: Dictionary = _counter_store(source, params)
	counters[counter_id] = float(counters.get(counter_id, 0.0)) + _number(effect, params, "amount", 0.0)
	return {"ok": true, "tool": "adjust_counter", "counter_id": counter_id}

func _consume_counter(source: Dictionary, effect: Dictionary, params: Dictionary) -> Dictionary:
	var counter_id: String = str(params.get("counterId", effect.get("counter_id", "")))
	_remember_counter_label(source, params, counter_id)
	var counters: Dictionary = _counter_store(source, params)
	var amount: float = _consume_amount(counters, effect, params)
	if float(counters.get(counter_id, 0.0)) < amount: return {"ok": false, "error": "missing_counter", "counter_id": counter_id}
	counters[counter_id] = float(counters[counter_id]) - amount
	return {"ok": true, "tool": "consume_counter", "counter_id": counter_id}

## DSL 的 amountSource=counter 表示消耗当前全部层数，maxAmount 只限制本次上限。
## 此解释器用于待选预演，必须与 CoreActionResolver 的正式结算同义。
func _consume_amount(counters: Dictionary, effect: Dictionary, params: Dictionary) -> float:
	if str(params.get("amountSource", "")) != "counter":
		return _number(effect, params, "amount", 1.0)
	var counter_id: String = str(params.get("counterId", effect.get("counter_id", "")))
	var current: float = float(counters.get(counter_id, 0.0))
	var maximum: float = float(params.get("maxAmount", INF))
	return minf(current, maximum)

func _unlock_card_pool(source: Dictionary, params: Dictionary) -> Dictionary:
	_ensure_array(source, "unlocked_card_pools").append(params.duplicate(true))
	return {"ok": true, "tool": "unlock_card_pool"}

func _grant_temporary_technique_tag(source: Dictionary, params: Dictionary) -> Dictionary:
	var tags: Dictionary = _ensure_dictionary(source, "temporary_technique_tags")
	tags[str(params.get("slotId", "temporary"))] = params.duplicate(true)
	return {"ok": true, "tool": "grant_temporary_technique_tag"}

func _counter_store(source: Dictionary, params: Dictionary) -> Dictionary:
	var counters: Dictionary = _ensure_dictionary(source, "counters")
	var namespace_id: String = str(params.get("namespace", ""))
	if namespace_id.is_empty(): return counters
	var namespace_value: Variant = counters.get(namespace_id, null)
	if not namespace_value is Dictionary:
		counters[namespace_id] = {}
		return counters.get(namespace_id, {}) as Dictionary
	return namespace_value as Dictionary

func _remember_counter_label(source: Dictionary, params: Dictionary, counter_id: String) -> void:
	if counter_id.is_empty(): return
	var label: String = str(params.get("label", "")).strip_edges()
	if label.is_empty(): return
	var namespace_id: String = str(params.get("namespace", "")).strip_edges()
	var canonical_id: String = counter_id if namespace_id.is_empty() else "%s.%s" % [namespace_id, counter_id]
	_ensure_dictionary(source, "counter_labels")[canonical_id] = label

func _check_requirement(tool: String, state: Dictionary, source: Dictionary, target: Dictionary, effect: Dictionary, params: Dictionary) -> Dictionary:
	var receiver: Dictionary = _receiver(effect, source, target)
	if tool == "require_status" and not _ensure_dictionary(receiver, "statuses").has(str(params.get("statusId", ""))): return {"ok": false, "error": "missing_status"}
	if tool == "require_summon" and _ensure_array(receiver, "summons").is_empty(): return {"ok": false, "error": "missing_summon"}
	if tool == "require_summon_group" and _ensure_array(receiver, "summons").size() < int(params.get("minCount", 1)): return {"ok": false, "error": "missing_summon_group"}
	if tool == "require_value":
		var field: String = str(params.get("field", ""))
		if float(receiver.get(field, 0.0)) < float(params.get("minimum", params.get("threshold", 0.0))): return {"ok": false, "error": "value_requirement_failed"}
	return {"ok": true, "tool": tool}

func _modify_action_context(tool: String, state: Dictionary, source: Dictionary, target: Dictionary, effect: Dictionary, params: Dictionary) -> Dictionary:
	var context: Dictionary = _ensure_dictionary(state, "action_context")
	if tool == "compute_action_value":
		var field: String = str(params.get("field", "damage"))
		var value: float = float(params.get("multiplier", 1.0)) + float(params.get("offset", 0.0))
		context[field] = value
		if field == "incomingHpScale" or field == "incoming_hp_scale":
			_receiver(effect, source, target)["incomingHpScale"] = value
	elif tool == "modify_damage": context["damage"] = float(context.get("damage", 0.0)) + float(params.get("amount", params.get("offset", 0.0)))
	elif tool == "modify_scale": context["damage"] = float(context.get("damage", 0.0)) * float(params.get("scale", params.get("multiplier", 1.0)))
	else: context[tool] = params.duplicate(true)
	return {"ok": true, "tool": tool}

func _add_status(receiver: Dictionary, effect: Dictionary, params: Dictionary, tool: String) -> Dictionary:
	var status_id: String = str(params.get("statusId", effect.get("status_id", "")))
	var status: Dictionary = params.duplicate(true)
	status["value"] = params.get("value", effect.get("value", true))
	status["rounds"] = params.get("rounds", 0)
	status["label"] = str(params.get("label", status_id))
	_ensure_dictionary(receiver, "statuses")[status_id] = status
	return {"ok": true, "tool": tool, "status_id": status_id}

func _remove_status(receiver: Dictionary, effect: Dictionary, params: Dictionary, tool: String) -> Dictionary:
	_ensure_dictionary(receiver, "statuses").erase(str(params.get("statusId", effect.get("status_id", ""))))
	return {"ok": true, "tool": tool}

func _modify_status(receiver: Dictionary, effect: Dictionary, params: Dictionary, tool: String) -> Dictionary:
	var status_id: String = str(params.get("statusId", effect.get("status_id", "")))
	var statuses: Dictionary = _ensure_dictionary(receiver, "statuses")
	if not statuses.has(status_id): return {"ok": false, "error": "missing_status"}
	var current: Dictionary = statuses[status_id] as Dictionary if statuses[status_id] is Dictionary else {}
	current.merge(params, true)
	if not current.has("label"): current["label"] = status_id
	statuses[status_id] = current
	return {"ok": true, "tool": tool}

func _summon(source: Dictionary, effect: Dictionary, params: Dictionary) -> Dictionary:
	var unit_id: String = str(params.get("unitId", effect.get("unit_id", "summon")))
	var max_hp: float = float(params.get("maxHp", params.get("max_hp", params.get("hp", 1.0))))
	var unit: Dictionary = params.duplicate(true)
	unit["id"] = unit_id
	unit["active"] = true
	unit["max_hp"] = max_hp
	unit["hp"] = clampf(float(params.get("hp", max_hp)), 0.0, max_hp)
	unit["attack"] = float(params.get("attack", params.get("attackPower", 0.0)))
	unit["defense"] = float(params.get("defense", params.get("defensePower", 0.0)))
	var summons: Array = _ensure_array(source, "summons")
	var replaced: bool = false
	for index: int in summons.size():
		if summons[index] is Dictionary and str((summons[index] as Dictionary).get("id", "")) == unit_id:
			summons[index] = unit
			replaced = true
			break
	if not replaced: summons.append(unit)
	if not replaced and summons.size() > 3: summons.pop_back()
	return {"ok": true, "tool": "summon_unit", "unit_id": unit_id}

func _summon_operation(source: Dictionary, tool: String, params: Dictionary) -> Dictionary:
	var summons: Array = _ensure_array(source, "summons")
	var summon_id: String = str(params.get("summonId", params.get("id", "")))
	if tool == "destroy_summon" or tool == "recall_summon":
		summons = summons.filter(func(raw: Variant) -> bool: return not (raw is Dictionary and (summon_id.is_empty() or str((raw as Dictionary).get("id", "")) == summon_id)))
		source["summons"] = summons
	elif tool == "update_summon":
		for index: int in summons.size():
			if not summons[index] is Dictionary or str((summons[index] as Dictionary).get("id", "")) != summon_id: continue
			var updated: Dictionary = (summons[index] as Dictionary).duplicate(true)
			for key: String in ["name", "attack", "defense", "active", "status", "statuses"]:
				if params.has(key): updated[key] = params[key]
			var max_hp: float = float(params.get("maxHp", params.get("max_hp", updated.get("max_hp", 1.0))))
			if params.has("maxHp") or params.has("max_hp"): updated["max_hp"] = max_hp
			if params.has("hp"): updated["hp"] = clampf(float(params["hp"]), 0.0, max_hp)
			if float(updated.get("hp", 0.0)) <= 0.0: summons.remove_at(index)
			else: summons[index] = updated
			source["summons"] = summons
			break
	return {"ok": true, "tool": tool}

func _advance_timer(state: Dictionary, params: Dictionary) -> Dictionary:
	for timer: Dictionary in _ensure_array(state, "timers"):
		timer["rounds"] = int(timer.get("rounds", 0)) - 1
	return {"ok": true, "tool": "advance_timer"}

func _cancel_timer(state: Dictionary, params: Dictionary) -> Dictionary:
	var timers: Array = _ensure_array(state, "timers")
	if not timers.is_empty(): timers.pop_back()
	return {"ok": true, "tool": "cancel_timer"}

func _append_state_item(state: Dictionary, key: String, value: Dictionary, tool: String) -> Dictionary:
	_ensure_array(state, key).append(value)
	return {"ok": true, "tool": tool}

func _ensure_dictionary(owner: Dictionary, key: String) -> Dictionary:
	if not owner.has(key) or not owner[key] is Dictionary: owner[key] = {}
	return owner[key] as Dictionary

func _ensure_array(owner: Dictionary, key: String) -> Array:
	if not owner.has(key) or not owner[key] is Array: owner[key] = []
	return owner[key] as Array

func _change_value(actor: Dictionary, field: String, delta: float, tool: String) -> Dictionary:
	var old_value: float = float(actor.get(field, 0.0))
	var new_value: float = old_value + delta
	if field == "hp": new_value = clampf(new_value, 0.0, float(actor.get("max_hp", 999999.0)))
	elif field == "ce": new_value = clampf(new_value, 0.0, float(actor.get("max_ce", 999999.0)))
	elif field == "guard" or field == "domain_load": new_value = maxf(new_value, 0.0)
	elif field == "stability": new_value = clampf(new_value, 0.0, 1.0)
	actor[field] = new_value
	return {"ok": true, "tool": tool, "old_value": old_value, "new_value": new_value, "delta": new_value - old_value}

func _error(state: Dictionary, tool: String, message: String) -> Dictionary:
	_ensure_array(state, "errors").append(message)
	return {"ok": false, "tool": tool, "error": message}

