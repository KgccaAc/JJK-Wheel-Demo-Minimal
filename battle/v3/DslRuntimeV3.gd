class_name DslRuntimeV3
extends RefCounted

## V3 DSL 的唯一解释边界：前置条件、动作数值和提交写回在同一处定义。
const SUPPORTED_TOOLS: Array[String] = [
	"require_status", "require_counter", "require_value", "require_summon", "require_summon_group",
	"compute_action_value", "modify_scale", "modify_damage", "set_action_mode", "set_damage_policy",
	"adjust_counter", "set_counter", "consume_counter", "add_status", "add_computed_status", "remove_status",
	"adjust_resource", "pay_hp_cost", "register_counter_modifier", "adjust_action_resource", "modify_weight",
	"selection_rule", "set_action_order", "emit_battle_event", "grant_temporary_technique_tag", "unlock_card_pool",
	"summon_unit", "update_summon", "destroy_summon", "recall_summon"
]

func evaluate(effects: Array, actor: Dictionary, target: Dictionary, values: Dictionary, preview: bool = true, context: Dictionary = {}) -> Dictionary:
	var working_values: Dictionary = values.duplicate(true)
	var mutations: Array[Dictionary] = []
	var trace: Array[Dictionary] = []
	# 消耗型计数器的可用性在任何数值和写回之前检查；它仍会在 post-action 再消费。
	for raw_effect: Variant in effects:
		if not raw_effect is Dictionary: continue
		var effect: Dictionary = raw_effect as Dictionary
		var tool: String = str(effect.get("tool", ""))
		if tool not in SUPPORTED_TOOLS: return {"ok":false, "error":"unsupported_dsl_tool", "tool":tool}
		if not _when_met(effect, actor, target, working_values): continue
		var params: Dictionary = _params(effect)
		if tool.begins_with("require"):
			var requirement: Dictionary = _check_requirement(tool, params, actor, target)
			if not bool(requirement.get("ok", false)): return requirement
		elif tool == "consume_counter" and _requires_counter_before_action(params):
			var consumption: Dictionary = _check_counter(params, actor, target)
			if not bool(consumption.get("ok", false)): return consumption
	for raw_effect: Variant in effects:
		if not raw_effect is Dictionary: continue
		var effect: Dictionary = raw_effect as Dictionary
		var tool: String = str(effect.get("tool", ""))
		if not _when_met(effect, actor, target, working_values):
			trace.append({"phase":"skipped", "tool":tool, "reason":"when_false"})
			continue
		var params: Dictionary = _params(effect)
		var phase: String = _phase(effect)
		if phase == "require":
			trace.append({"phase":phase, "tool":tool})
		elif phase == "calculate" or phase == "modifier":
			var calculation: Dictionary = _calculate(tool, params, actor, target, working_values)
			if not bool(calculation.get("ok", false)): return calculation
			working_values = calculation.get("values", working_values) as Dictionary
			trace.append({"phase":phase, "tool":tool, "field":calculation.get("field", "")})
		elif phase == "commit" and not preview:
			var mutation_result: Dictionary = _commit(tool, params, actor, target, context)
			if not bool(mutation_result.get("ok", false)): return mutation_result
			var mutation: Dictionary = mutation_result.get("mutation", {}) as Dictionary
			if not mutation.is_empty() and str(mutation.get("kind", "")) != "noop": mutations.append(mutation)
			trace.append({"phase":phase, "tool":tool})
	return {"ok":true, "values":working_values, "mutations":mutations, "trace":trace}

func apply_mutations(actor: Dictionary, target: Dictionary, mutations: Array[Dictionary]) -> void:
	for mutation: Dictionary in mutations:
		var receiver: Dictionary = target if str(mutation.get("receiver", "actor")) == "target" else actor
		match str(mutation.get("kind", "")):
			"counter_delta":
				var current: float = _counter_value(receiver, str(mutation.get("namespace", "")), str(mutation.get("counter_id", "")))
				_set_counter_value(receiver, str(mutation.get("namespace", "")), str(mutation.get("counter_id", "")), clampf(current + float(mutation.get("amount", 0.0)), 0.0, float(mutation.get("maximum", INF))))
			"counter_set": _set_counter_value(receiver, str(mutation.get("namespace", "")), str(mutation.get("counter_id", "")), clampf(float(mutation.get("value", 0.0)), 0.0, float(mutation.get("maximum", INF))) )
			"counter_schedule": _append_dictionary(receiver, "pending_counters", mutation)
			"status_add":
				var statuses: Dictionary = receiver.get("statuses", {}) as Dictionary
				statuses[str(mutation.get("status_id", ""))] = (mutation.get("status", {}) as Dictionary).duplicate(true)
				receiver["statuses"] = statuses
			"status_remove": (receiver.get("statuses", {}) as Dictionary).erase(str(mutation.get("status_id", "")))
			"status_schedule": _append_dictionary(receiver, "pending_statuses", mutation)
			"resource_delta": _apply_resource_delta(receiver, str(mutation.get("field", "")), float(mutation.get("amount", 0.0)))
			"counter_modifier_register": _register_counter_modifier(receiver, mutation.get("modifier", {}) as Dictionary)
			"action_resource_adjust": _adjust_action_resource(receiver, mutation)
			"weight_modifier_add": _append_dictionary(receiver, "weight_modifiers", mutation.get("modifier", {}) as Dictionary)
			"event_emit": _append_dictionary(receiver, "emitted_events", mutation.get("event", {}) as Dictionary)
			"temporary_technique_tag":
				var tags: Dictionary = receiver.get("temporary_technique_tags", {}) as Dictionary
				tags[str(mutation.get("slot_id", "temporary"))] = (mutation.get("tag", {}) as Dictionary).duplicate(true)
				receiver["temporary_technique_tags"] = tags
			"unlock_card_pool": _append_dictionary(receiver, "unlocked_card_pools", mutation.get("unlock", {}) as Dictionary)
			"summon_unit", "update_summon", "destroy_summon", "recall_summon": _apply_summon_mutation(receiver, mutation)

## next_round 是本次回合结算后将进入的回合号。延迟效果在这里一次性激活。
func advance_timed_effects(actor: Dictionary, next_round: int) -> void:
	var active: Array = actor.get("timed_counters", []) as Array
	var remaining: Array = []
	for raw_pending: Variant in actor.get("pending_counters", []) as Array:
		if not raw_pending is Dictionary: continue
		var pending: Dictionary = raw_pending as Dictionary
		if int(pending.get("available_round", next_round)) <= next_round:
			_set_counter_value(actor, str(pending.get("namespace", "")), str(pending.get("counter_id", "")), float(pending.get("value", 0.0)))
			if int(pending.get("expires_round", -1)) > next_round: active.append(pending)
		else: remaining.append(pending)
	actor["pending_counters"] = remaining
	var kept: Array = []
	for raw_active: Variant in active:
		if not raw_active is Dictionary: continue
		var timed: Dictionary = raw_active as Dictionary
		if int(timed.get("expires_round", -1)) >= 0 and int(timed.get("expires_round", -1)) <= next_round:
			_set_counter_value(actor, str(timed.get("namespace", "")), str(timed.get("counter_id", "")), 0.0)
		else: kept.append(timed)
	actor["timed_counters"] = kept
	var pending_statuses: Array = []
	for raw_pending_status: Variant in actor.get("pending_statuses", []) as Array:
		if not raw_pending_status is Dictionary: continue
		var scheduled: Dictionary = raw_pending_status as Dictionary
		if int(scheduled.get("available_round", next_round)) <= next_round:
			var statuses: Dictionary = actor.get("statuses", {}) as Dictionary
			statuses[str(scheduled.get("status_id", ""))] = (scheduled.get("status", {}) as Dictionary).duplicate(true)
			actor["statuses"] = statuses
		else: pending_statuses.append(scheduled)
	actor["pending_statuses"] = pending_statuses

func _phase(effect: Dictionary) -> String:
	var explicit: String = str(effect.get("phase", "")).to_lower()
	if not explicit.is_empty(): return explicit
	var tool: String = str(effect.get("tool", ""))
	if tool.begins_with("require"): return "require"
	if tool in ["adjust_counter", "set_counter", "consume_counter", "add_status", "add_computed_status", "remove_status", "summon_unit", "update_summon", "destroy_summon", "recall_summon", "adjust_resource", "pay_hp_cost", "register_counter_modifier", "adjust_action_resource", "modify_weight", "emit_battle_event", "grant_temporary_technique_tag", "unlock_card_pool"]: return "commit"
	var trigger: String = str(effect.get("trigger", "")).to_lower()
	if trigger in ["availability", "require", "precondition"]: return "require"
	if trigger in ["pre-damage", "pre_action", "pre-action", "calculate"]: return "calculate"
	if trigger in ["modifier", "temporary"]: return "modifier"
	return "commit" if trigger in ["post-damage", "post_action", "post-action", "on-hit", "commit"] else "calculate"

func _params(effect: Dictionary) -> Dictionary:
	var result: Dictionary = (effect.get("params", {}) as Dictionary).duplicate(true)
	result["__target"] = str(effect.get("target", "self"))
	return result

func _check_requirement(tool: String, params: Dictionary, actor: Dictionary, target: Dictionary) -> Dictionary:
	var receiver: Dictionary = _receiver(params, actor, target)
	match tool:
		"require_status":
			if not (receiver.get("statuses", {}) as Dictionary).has(str(params.get("statusId", ""))): return {"ok":false, "error":"missing_status"}
		"require_counter": return _check_counter(params, actor, target)
		"require_value":
			if not _comparison(_requirement_value(params, receiver), str(params.get("operator", ">=")), float(params.get("threshold", params.get("minimum", 0.0)))): return {"ok":false, "error":"value_requirement_failed"}
		"require_summon":
			if not _has_summon(receiver, params): return {"ok":false, "error":"missing_summon"}
		"require_summon_group":
			if (receiver.get("summons", []) as Array).size() < int(params.get("minCount", 1)): return {"ok":false, "error":"missing_summon_group"}
	return {"ok":true}

func _check_counter(params: Dictionary, actor: Dictionary, target: Dictionary) -> Dictionary:
	var receiver: Dictionary = _receiver(params, actor, target)
	var current: float = _counter_value(receiver, str(params.get("namespace", "")), str(params.get("counterId", "")))
	var required: float = current if str(params.get("amountSource", "")) == "counter" else float(params.get("amount", 1.0))
	if params.has("maxAmount"): required = minf(required, float(params.get("maxAmount", required)))
	if current + 0.0001 < required: return {"ok":false, "error":"missing_counter", "counter_id":str(params.get("counterId", "")), "namespace":str(params.get("namespace", "")), "required":required, "available":current}
	return {"ok":true, "amount":required}

func _requires_counter_before_action(params: Dictionary) -> bool:
	# A consume is never an optional late write. Legacy availability evaluated every
	# consume_counter before selection; preserving that invariant prevents a card
	# from looking playable and only failing after the opponent has committed.
	return true

func _calculate(tool: String, params: Dictionary, actor: Dictionary, target: Dictionary, values: Dictionary) -> Dictionary:
	var result: Dictionary = values.duplicate(true)
	var field: String = _value_field(str(params.get("field", "damage")))
	match tool:
		"compute_action_value":
			var source_a: float = _computed_source(params, actor, target, result, field, "A")
			var source_b: float = _computed_source(params, actor, target, result, field, "B")
			var exponent_a: float = float(params.get("sourceAExponent", 1.0))
			var exponent_b: float = float(params.get("sourceBExponent", 1.0))
			var growth: float = 1.0
			var growth_source: String = str(params.get("growthSource", "none"))
			if not growth_source.is_empty() and growth_source != "none":
				var growth_value: float = _read_source(growth_source, params, actor, target, result, "growth")
				growth = pow(maxf(0.0, float(params.get("growthBase", 1.0))), growth_value)
			var computed: float = pow(maxf(0.0, source_a), exponent_a) * pow(maxf(0.0, source_b), exponent_b) * growth * float(params.get("multiplier", 1.0)) + float(params.get("offset", 0.0))
			result[field] = clampf(computed, float(params.get("minimum", -INF)), float(params.get("maximum", INF)))
			if field == "cost_ce": result["cost_affected_by_efficiency"] = bool(params.get("affectedByEfficiency", true))
		"modify_scale": result[field] = float(result.get(field, 0.0)) * float(params.get("scale", params.get("multiplier", 1.0)))
		"modify_damage":
			result["damage"] = float(result.get("damage", 0.0)) + float(params.get("amount", params.get("offset", 0.0)))
			field = "damage"
		"set_action_mode":
			for pair: Array in [["damage", "damage"], ["ceDamage", "ce_damage"], ["stabilityDamage", "stability_damage"], ["accuracyProfile", "accuracy_profile"], ["evasionAllowed", "evasion_allowed"], ["cardType", "card_type"]]:
				if params.has(pair[0]): result[pair[1]] = params[pair[0]]
		"set_damage_policy": result["damage_policy"] = params.duplicate(true)
		"selection_rule", "set_action_order": pass
		_: return {"ok":false, "error":"unsupported_calculate_tool", "tool":tool}
	return {"ok":true, "values":result, "field":field}

func _commit(tool: String, params: Dictionary, actor: Dictionary, target: Dictionary, context: Dictionary) -> Dictionary:
	var receiver: String = "target" if str(params.get("__target", "self")) == "opponent" else "actor"
	match tool:
		"adjust_counter": return {"ok":true, "mutation":_counter_mutation("counter_delta", receiver, params, float(params.get("amount", params.get("delta", 0.0))))}
		"consume_counter":
			var check: Dictionary = _check_counter(params, actor, target)
			if not bool(check.get("ok", false)): return check
			return {"ok":true, "mutation":_counter_mutation("counter_delta", receiver, params, -float(check.get("amount", 1.0)))}
		"set_counter":
			var delay: int = int(params.get("activationDelayRounds", 0))
			if delay > 0:
				var available_round: int = int(context.get("round", 1)) + delay
				var duration: int = int(params.get("durationRounds", 0))
				return {"ok":true, "mutation":{"kind":"counter_schedule", "receiver":receiver, "counter_id":str(params.get("counterId", "")), "namespace":str(params.get("namespace", "")), "value":float(params.get("value", 0.0)), "available_round":available_round, "expires_round":available_round + duration if duration > 0 else -1}}
			return {"ok":true, "mutation":_counter_mutation("counter_set", receiver, params, float(params.get("value", 0.0)))}
		"add_status", "add_computed_status":
			var status_id: String = str(params.get("statusId", params.get("id", "")))
			if status_id.is_empty(): return {"ok":false, "error":"status_id_missing"}
			var status: Dictionary = params.duplicate(true)
			status.erase("__target")
			status["id"] = status_id
			status["label"] = str(params.get("label", status_id))
			status["rounds"] = int(params.get("rounds", 1))
			if int(params.get("activationDelayRounds", 0)) > 0: return {"ok":true, "mutation":{"kind":"status_schedule", "receiver":receiver, "status_id":status_id, "status":status, "available_round":int(context.get("round", 1)) + int(params.get("activationDelayRounds", 0))}}
			return {"ok":true, "mutation":{"kind":"status_add", "receiver":receiver, "status_id":status_id, "status":status}}
		"remove_status": return {"ok":true, "mutation":{"kind":"status_remove", "receiver":receiver, "status_id":str(params.get("statusId", params.get("id", "")))}}
		"adjust_resource": return {"ok":true, "mutation":{"kind":"resource_delta", "receiver":receiver, "field":str(params.get("resource", params.get("field", "ce"))), "amount":float(params.get("amount", params.get("delta", 0.0)))}}
		"pay_hp_cost":
			var source: Dictionary = target if receiver == "target" else actor
			var hp_cost: float = float(params.get("amount", 0.0)) + float(source.get("max_hp", 0.0)) * float(params.get("ratio", 0.0))
			var floor: float = 1.0 if bool(params.get("nonlethal", false)) else 0.0
			if float(source.get("hp", 0.0)) - hp_cost < floor: return {"ok":false, "error":"insufficient_hp"}
			return {"ok":true, "mutation":{"kind":"resource_delta", "receiver":receiver, "field":"hp", "amount":-hp_cost}}
		"register_counter_modifier": return {"ok":true, "mutation":{"kind":"counter_modifier_register", "receiver":receiver, "modifier":_counter_modifier(params)}}
		"adjust_action_resource": return {"ok":true, "mutation":{"kind":"action_resource_adjust", "receiver":receiver, "resource":str(params.get("resource", params.get("field", ""))), "amount":float(params.get("amount", params.get("delta", 0.0))), "duration":int(params.get("duration", 0))}}
		"modify_weight": return {"ok":true, "mutation":{"kind":"weight_modifier_add", "receiver":receiver, "modifier":{"family":str(params.get("family", "")), "delta":float(params.get("delta", 0.0)), "duration":int(params.get("duration", 0))}}}
		"emit_battle_event": return {"ok":true, "mutation":{"kind":"event_emit", "receiver":receiver, "event":{"id":str(params.get("eventId", "")), "label":str(params.get("label", ""))}}}
		"grant_temporary_technique_tag": return {"ok":true, "mutation":{"kind":"temporary_technique_tag", "receiver":receiver, "slot_id":str(params.get("slotId", "temporary")), "tag":params.duplicate(true)}}
		"unlock_card_pool": return {"ok":true, "mutation":{"kind":"unlock_card_pool", "receiver":receiver, "unlock":params.duplicate(true)}}
		"summon_unit", "update_summon", "destroy_summon", "recall_summon": return {"ok":true, "mutation":{"kind":tool, "receiver":receiver, "params":params.duplicate(true)}}
		"selection_rule", "set_action_order": return {"ok":true, "mutation":{"kind":"noop"}}
		_: return {"ok":false, "error":"unsupported_commit_tool", "tool":tool}

func _counter_mutation(kind: String, receiver: String, params: Dictionary, amount: float) -> Dictionary:
	return {"kind":kind, "receiver":receiver, "counter_id":str(params.get("counterId", "")), "namespace":str(params.get("namespace", "")), "amount":amount, "value":amount, "maximum":float(params.get("max", INF))}

func _when_met(effect: Dictionary, actor: Dictionary, target: Dictionary, values: Dictionary) -> bool:
	var raw_conditions: Variant = effect.get("when", [])
	if not raw_conditions is Array: return true
	for raw_condition: Variant in raw_conditions as Array:
		if not raw_condition is Dictionary: continue
		var condition: Dictionary = raw_condition as Dictionary
		var receiver: Dictionary = target if str(condition.get("target", "self")) == "opponent" else actor
		if not _comparison(_condition_value(condition, receiver, values), str(condition.get("operator", ">=")), float(condition.get("threshold", condition.get("value", 0.0)))): return false
	return true

func _condition_value(condition: Dictionary, receiver: Dictionary, values: Dictionary) -> float:
	match str(condition.get("source", "value")):
		"counter": return _counter_value(receiver, str(condition.get("namespace", "")), str(condition.get("counterId", "")))
		"status": return 1.0 if (receiver.get("statuses", {}) as Dictionary).has(str(condition.get("statusId", ""))) else 0.0
		"action", "value": return float(values.get(_value_field(str(condition.get("field", ""))), receiver.get(str(condition.get("field", "")), 0.0)))
		_: return float(receiver.get(str(condition.get("field", condition.get("source", ""))), 0.0))

func _computed_source(params: Dictionary, actor: Dictionary, target: Dictionary, values: Dictionary, field: String, suffix: String = "A") -> float:
	var default_source: String = str(params.get("source", "")) if suffix == "A" else "constant"
	return _read_source(str(params.get("source%s" % suffix, default_source)), params, actor, target, values, suffix)

func _read_source(source: String, params: Dictionary, actor: Dictionary, target: Dictionary, values: Dictionary, suffix: String) -> float:
	var key_prefix: String = "growth" if suffix == "growth" else "source%s" % suffix
	match source:
		"constant": return 1.0
		"counter":
			var counter_receiver: Dictionary = actor if suffix != "B" else target
			return _counter_value(counter_receiver, str(params.get("%sNamespace" % key_prefix, params.get("namespace", ""))), str(params.get("%sCounterId" % key_prefix, params.get("counterId", ""))))
		"target", "self":
			var receiver: Dictionary = target if source == "target" else actor
			var raw_field: String = str(params.get("source%sField" % suffix, params.get("field", "")))
			var value: Variant = receiver
			for part: String in raw_field.split("."):
				if value is Dictionary: value = (value as Dictionary).get(part, 0.0)
				else: value = 0.0
			return float(value) if value is float or value is int else 0.0
		_: return float(values.get(str(params.get("field", "damage")), 0.0))

func _value_field(field: String) -> String:
	match field:
		"costCe", "ceCost", "ce_cost": return "cost_ce"
		"ceDamage": return "ce_damage"
		"stabilityDamage": return "stability_damage"
		"domainLoad": return "domain_load"
		"domainPressure": return "domain_pressure"
		"blockIgnoreRatio": return "block_ignore_ratio"
		_: return field

func _receiver(params: Dictionary, actor: Dictionary, target: Dictionary) -> Dictionary:
	return target if str(params.get("__target", params.get("target", "self"))) == "opponent" else actor

func _requirement_value(params: Dictionary, receiver: Dictionary) -> float:
	if str(params.get("source", "")) == "counter": return _counter_value(receiver, str(params.get("namespace", "")), str(params.get("counterId", "")))
	return float(receiver.get(str(params.get("field", params.get("source", ""))).trim_prefix("self."), 0.0))

func _comparison(value: float, operator: String, threshold: float) -> bool:
	match operator:
		">": return value > threshold
		">=": return value >= threshold
		"==": return is_equal_approx(value, threshold)
		"<=": return value <= threshold
		"<": return value < threshold
	return false

func _counter_value(receiver: Dictionary, namespace_id: String, counter_id: String) -> float:
	var counters: Dictionary = receiver.get("counters", {}) as Dictionary
	var storage: Dictionary = counters.get(namespace_id, {}) as Dictionary if not namespace_id.is_empty() else counters
	return float(storage.get(counter_id, 0.0))

func _set_counter_value(receiver: Dictionary, namespace_id: String, counter_id: String, value: float) -> void:
	var counters: Dictionary = receiver.get("counters", {}) as Dictionary
	if namespace_id.is_empty(): counters[counter_id] = value
	else:
		var namespaced: Dictionary = counters.get(namespace_id, {}) as Dictionary
		namespaced[counter_id] = value
		counters[namespace_id] = namespaced
	receiver["counters"] = counters

func _counter_modifier(params: Dictionary) -> Dictionary:
	return {"counter_id":str(params.get("counterId", "")), "namespace":str(params.get("namespace", "")), "label":str(params.get("label", params.get("counterId", ""))), "field":str(params.get("field", "")), "offset":float(params.get("offset", 0.0)), "per_counter":float(params.get("perCounter", 0.0)), "minimum":float(params.get("minimum", -INF)), "maximum":float(params.get("maximum", INF)), "inactive_when_zero":bool(params.get("inactiveWhenZero", false)), "hook":str(params.get("hook", ""))}

func _register_counter_modifier(receiver: Dictionary, modifier: Dictionary) -> void:
	var modifiers: Array = receiver.get("counter_modifiers", []) as Array
	var replaced: bool = false
	for index: int in modifiers.size():
		if not modifiers[index] is Dictionary: continue
		var existing: Dictionary = modifiers[index] as Dictionary
		if str(existing.get("counter_id", "")) == str(modifier.get("counter_id", "")) and str(existing.get("namespace", "")) == str(modifier.get("namespace", "")) and str(existing.get("hook", "")) == str(modifier.get("hook", "")):
			modifiers[index] = modifier.duplicate(true)
			replaced = true
			break
	if not replaced: modifiers.append(modifier.duplicate(true))
	receiver["counter_modifiers"] = modifiers

func _apply_resource_delta(receiver: Dictionary, field: String, amount: float) -> void:
	var next: float = float(receiver.get(field, 0.0)) + amount
	if field == "hp": next = clampf(next, 0.0, float(receiver.get("max_hp", INF)))
	elif field == "ce": next = clampf(next, 0.0, float(receiver.get("max_ce", INF)))
	elif field == "stability": next = clampf(next, 0.0, 100.0)
	else: next = maxf(0.0, next)
	receiver[field] = next

func _adjust_action_resource(receiver: Dictionary, mutation: Dictionary) -> void:
	var resources: Dictionary = receiver.get("action_resources", {}) as Dictionary
	var id: String = str(mutation.get("resource", ""))
	var current: Dictionary = resources.get(id, {}) as Dictionary
	resources[id] = {"value":float(current.get("value", 0.0)) + float(mutation.get("amount", 0.0)), "duration":int(mutation.get("duration", 0))}
	receiver["action_resources"] = resources

func _has_summon(receiver: Dictionary, params: Dictionary) -> bool:
	var found: bool = false
	for raw_summon: Variant in receiver.get("summons", []) as Array:
		if not raw_summon is Dictionary: continue
		var summon: Dictionary = raw_summon as Dictionary
		if not str(params.get("summonId", "")).is_empty() and str(summon.get("id", "")) != str(params.get("summonId", "")): continue
		if bool(params.get("activeOnly", false)) and not bool(summon.get("active", true)): continue
		found = true
		break
	return not found if str(params.get("presence", "present")) == "absent" else found

func _apply_summon_mutation(receiver: Dictionary, mutation: Dictionary) -> void:
	var kind: String = str(mutation.get("kind", ""))
	var params: Dictionary = mutation.get("params", {}) as Dictionary
	var summon_id: String = str(params.get("summonId", params.get("unitId", params.get("id", ""))))
	var summons: Array = receiver.get("summons", []) as Array
	if kind == "summon_unit":
		var max_hp: float = float(params.get("maxHp", params.get("max_hp", params.get("hp", 1.0))))
		var unit: Dictionary = params.duplicate(true)
		unit["id"] = summon_id
		unit["active"] = true
		unit["max_hp"] = max_hp
		unit["hp"] = clampf(float(params.get("hp", max_hp)), 0.0, max_hp)
		unit["attack"] = float(params.get("attack", params.get("attackPower", 0.0)))
		unit["defense"] = float(params.get("defense", params.get("defensePower", 0.0)))
		var replaced: bool = false
		for index: int in summons.size():
			if summons[index] is Dictionary and str((summons[index] as Dictionary).get("id", "")) == summon_id:
				summons[index] = unit
				replaced = true
				break
		if not replaced: summons.append(unit)
		if not replaced and summons.size() > 3: summons.pop_back()
	elif kind == "destroy_summon" or kind == "recall_summon":
		summons = summons.filter(func(raw: Variant) -> bool: return not (raw is Dictionary and (summon_id.is_empty() or str((raw as Dictionary).get("id", "")) == summon_id)))
	elif kind == "update_summon":
		for index: int in summons.size():
			if not summons[index] is Dictionary or str((summons[index] as Dictionary).get("id", "")) != summon_id: continue
			var updated: Dictionary = (summons[index] as Dictionary).duplicate(true)
			for key: String in ["name", "attack", "defense", "active", "status", "statuses"]:
				if params.has(key): updated[key] = params[key]
			var updated_max_hp: float = float(params.get("maxHp", params.get("max_hp", updated.get("max_hp", 1.0))))
			if params.has("maxHp") or params.has("max_hp"): updated["max_hp"] = updated_max_hp
			if params.has("hp"): updated["hp"] = clampf(float(params.get("hp", updated.get("hp", 0.0))), 0.0, updated_max_hp)
			if float(updated.get("hp", 0.0)) <= 0.0: summons.remove_at(index)
			else: summons[index] = updated
			break
	receiver["summons"] = summons

func _append_dictionary(receiver: Dictionary, key: String, value: Dictionary) -> void:
	var items: Array = receiver.get(key, []) as Array
	items.append(value.duplicate(true))
	receiver[key] = items

