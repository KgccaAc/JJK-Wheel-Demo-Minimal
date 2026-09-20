class_name CoreActionResolver
extends RefCounted

## 原子效果执行器：只在 BattleFlowSession 的工作状态内写入规则副作用。
## 输入是卡牌与状态快照，输出 trace；Presenter、Gateway 与 fixture 不得绕过会话直接调用。
const SUPPORTED_TOOLS: Array[String] = [
	"modify_scale", "compute_action_value", "adjust_resource", "add_status", "adjust_counter", "set_counter", "consume_counter", "set_action_mode", "register_counter_modifier",
	"add_computed_status", "adjust_action_resource", "emit_battle_event", "grant_temporary_technique_tag", "modify_damage", "modify_weight", "pay_hp_cost", "recall_summon", "update_summon", "destroy_summon", "remove_status", "require_status", "require_summon", "require_value", "selection_rule", "set_action_order", "set_damage_policy", "summon_unit", "unlock_card_pool"
]
const RngScript: Script = preload("res://battle/core/SourceCompatibleRng.gd")
const CostResolverScript: Script = preload("res://battle/rules/ActionCostResolver.gd")
const BATTLE_RANK_SCORES: Dictionary = {"E-": 0.0, "E": 1.0, "D": 2.0, "C": 3.0, "B": 4.0, "A": 5.0, "S": 6.0, "SS": 7.0, "SSS": 8.0, "EX-": 9.0, "EX": 10.0}

## 给 UI 可用性层使用：不支持的 DSL 卡不进入可选状态，也不把内部错误码暴露给玩家。
static func first_unsupported_atomic_tool(card: Dictionary) -> String:
	var effect: Dictionary = card.get("effect", {}) as Dictionary
	var raw_special: Variant = effect.get("special", {})
	var special: Dictionary = raw_special as Dictionary if raw_special is Dictionary else {}
	var raw_effects: Variant = special.get("atomicEffects", [])
	var effects: Array = raw_effects as Array if raw_effects is Array else [raw_effects]
	for raw_effect: Variant in effects:
		if not raw_effect is Dictionary: continue
		var tool: String = str((raw_effect as Dictionary).get("tool", ""))
		if not tool.is_empty() and tool not in SUPPORTED_TOOLS: return tool
	return ""

func resolve_selected(state: Variant, actor_index: int) -> Dictionary:
	if state == null:
		return {"ok": false, "error": "missing_state"}
	if actor_index < 0 or actor_index >= (state.actors as Array).size():
		return {"ok": false, "error": "invalid_actor"}
	# Resolve the complete selected set against detached actors. A failed later
	# atomic effect must not leave damage, counters, or zones partially applied.
	var working_actors: Array = (state.actors as Array).duplicate(true)
	var actor: Dictionary = working_actors[actor_index] as Dictionary
	var target_index: int = 1 - actor_index
	var target: Dictionary = working_actors[target_index] as Dictionary
	var zones: Dictionary = actor.get("zones", {}) as Dictionary
	var selected: Array = zones.get("selected", []) as Array
	if selected.is_empty():
		return {"ok": false, "error": "no_committed_cards"}
	var trace: Array[Dictionary] = []
	var resolved_ids: Array[String] = []
	var evasion_results: Array[Dictionary] = []
	# set_action_order 以卡牌声明的 priority 决定同批结算顺序，数值越小越先结算。
	selected.sort_custom(func(left: Dictionary, right: Dictionary) -> bool: return _action_priority(left) < _action_priority(right))
	for raw_card: Variant in selected:
		if not raw_card is Dictionary:
			return {"ok": false, "error": "selected_card_invalid"}
		var result: Dictionary = _resolve_card(raw_card as Dictionary, actor, target, state, actor_index, trace)
		if not bool(result.get("ok", false)):
			return result
		if result.has("evasion"):
			evasion_results.append((result.get("evasion", {}) as Dictionary).duplicate(true))
		resolved_ids.append(str((raw_card as Dictionary).get("instance_id", "")))
	var discard: Array = zones.get("discard", []) as Array
	for raw_card: Variant in selected:
		discard.append((raw_card as Dictionary).duplicate(true))
	zones["selected"] = []
	zones["discard"] = discard
	actor["zones"] = zones
	working_actors[actor_index] = actor
	working_actors[target_index] = target
	state.actors = working_actors
	state.append_event("actions_resolved", {"actor_index": actor_index, "instance_ids": resolved_ids, "trace": trace})
	var response: Dictionary = {"ok": true, "actor_index": actor_index, "instance_ids": resolved_ids, "trace": trace}
	if not evasion_results.is_empty():
		response["evasion"] = evasion_results.back()
		response["evasions"] = evasion_results
	return response

## 只预演卡牌的前置原子效果；用于费用/可用性计算，不提交任何状态。
func preview_action_values(card: Dictionary, actor: Dictionary, target: Dictionary, state: Variant) -> Dictionary:
	var preview_actor: Dictionary = actor.duplicate(true)
	var preview_target: Dictionary = target.duplicate(true)
	var effect: Dictionary = card.get("effect", {}) as Dictionary
	var values: Dictionary = _initial_values(effect, card)
	var trace: Array[Dictionary] = []
	_apply_card_scaling(card, preview_actor, preview_target, values, trace)
	var effects: Array = _atomic_effects(effect)
	for trigger: String in ["pre-damage", "pre_action", "pre-action"]:
		var result: Dictionary = _run_trigger(effects, trigger, preview_actor, preview_target, values, trace, state)
		if not bool(result.get("ok", false)): return result
	return {"ok":true, "values":values, "trace":trace}

func _resolve_card(card: Dictionary, actor: Dictionary, target: Dictionary, state: Variant, actor_index: int, trace: Array[Dictionary]) -> Dictionary:
	var effect: Dictionary = card.get("effect", {}) as Dictionary
	var values: Dictionary = _initial_values(effect, card)
	var effects: Array = _atomic_effects(effect)
	_apply_card_scaling(card, actor, target, values, trace)
	var evasion: Dictionary = _resolve_evasion(card, actor, target, state)
	trace.append({"tool": "evasion", "evasion": evasion.duplicate(true)})
	for trigger: String in ["pre-damage", "pre_action", "pre-action"]:
		var preflight: Dictionary = _run_trigger(effects, trigger, actor, target, values, trace, state)
		if not bool(preflight.get("ok", false)):
			return preflight
	_apply_strategy_modifiers(state, actor_index, values, trace)
	_apply_initiative_damage_modifier(state, actor_index, values, trace)
	_apply_domain_modifiers(actor, target, values, trace)
	if bool(evasion.get("evaded", false)):
		var accuracy: Dictionary = card.get("accuracy", {}) as Dictionary
		var raw_on_miss: Variant = accuracy.get("onMiss", {})
		var on_miss: Dictionary = raw_on_miss as Dictionary if raw_on_miss is Dictionary else {}
		var damage_scale: Variant = on_miss.get("damageScale", 0.0)
		var ce_scale: Variant = on_miss.get("ceDamageScale", 0.0)
		values["damage"] *= float(damage_scale) if damage_scale is float or damage_scale is int else 0.0
		values["ce_damage"] *= float(ce_scale) if ce_scale is float or ce_scale is int else 0.0
	var damage_target: Dictionary = _resolve_damage_target(effect, target)
	if _requested_summon_id(effect) != "" and damage_target == target:
		return {"ok": false, "error": "summon_not_found", "summon_id": _requested_summon_id(effect)}
	_apply_base_values(actor, damage_target, values, trace, str(card.get("action_id", card.get("id", ""))))
	_remove_dead_summon(target, damage_target)
	for trigger: String in ["post-damage", "post_action", "post-action", "on-hit"]:
		var postflight: Dictionary = _run_trigger(effects, trigger, actor, target, values, trace, state)
		if not bool(postflight.get("ok", false)):
			return postflight
	return {"ok": true, "evasion": evasion}

## 策略是整回合修正，放在卡牌原子效果之后、领域修正之前，便于 trace 解释最终值。
func _apply_strategy_modifiers(state: Variant, actor_index: int, values: Dictionary, trace: Array[Dictionary]) -> void:
	if state == null or not "strategy_snapshot" in state:
		return
	var strategies: Array = state.strategy_snapshot as Array
	if actor_index < 0 or actor_index >= strategies.size():
		return
	var actor_strategy: Dictionary = strategies[actor_index] as Dictionary
	var target_index: int = 1 - actor_index
	var target_strategy: Dictionary = strategies[target_index] as Dictionary if target_index >= 0 and target_index < strategies.size() else {}
	var outgoing: float = maxf(0.0, float(actor_strategy.get("outgoing_damage_multiplier", 1.0)))
	var incoming: float = maxf(0.0, float(target_strategy.get("incoming_damage_multiplier", 1.0)))
	var scale: float = outgoing * incoming
	if is_equal_approx(scale, 1.0):
		return
	var before: float = float(values.get("damage", 0.0))
	values["damage"] = before * scale
	trace.append({"tool":"strategy_modifier", "field":"damage", "attacker_strategy":str(actor_strategy.get("id", "default")), "defender_strategy":str(target_strategy.get("id", "default")), "outgoing_scale":outgoing, "incoming_scale":incoming, "before":before, "after":values["damage"]})

## 源项目先手争夺：后手本回合承伤降低 10%。
func _apply_initiative_damage_modifier(state: Variant, actor_index: int, values: Dictionary, trace: Array[Dictionary]) -> void:
	if state == null or not "initiative" in state: return
	var initiative: Dictionary = state.initiative as Dictionary
	var winner: int = int(initiative.get("winner_index", -1))
	if winner < 0 or winner == actor_index: return
	var before: float = float(values.get("damage", 0.0))
	values["damage"] = before * 0.9
	trace.append({"tool":"initiative_modifier", "field":"damage", "target":"second_actor", "before":before, "scale":0.9, "after":values["damage"]})

func _initial_values(effect: Dictionary, card: Dictionary) -> Dictionary:
	return {
		"damage": float(effect.get("damage", 0.0)),
		"ce_damage": float(effect.get("ceDamage", 0.0)),
		"healing": float(effect.get("healing", 0.0)),
		"block": float(effect.get("block", 0.0)),
		"shield": float(effect.get("shield", 0.0)),
		"domain_load": float(effect.get("domainLoad", 0.0)),
		"domain_pressure": float(effect.get("domainPressure", 0.0)),
		"stability_damage": float(effect.get("stabilityDamage", 0.0)),
		"block_ignore_ratio": float(effect.get("blockIgnoreRatio", card.get("blockIgnoreRatio", 0.0))),
		"damage_type": str(effect.get("damageType", card.get("damageType", "standard")))
	}

## Applies the source project's direct-card settlement formula once, before DSL.
## DSL runs afterwards so compute_action_value(finalFormula=true) remains authoritative.
func _apply_card_scaling(card: Dictionary, actor: Dictionary, target: Dictionary, values: Dictionary, trace: Array[Dictionary]) -> void:
	var raw_scaling: Variant = card.get("scaling", {})
	if not raw_scaling is Dictionary:
		return
	var scaling: Dictionary = raw_scaling as Dictionary
	# Runtime templates may carry only a display profile name (for example
	# {source:"physical"}); that is not a direct-card scaling contract.
	if scaling.is_empty() or not scaling.has("baseDamageMultiplier"):
		return
	var source: String = str(scaling.get("source", ""))
	var control_delta: float = _battle_stat_delta(actor, "control")
	var efficiency_delta: float = _battle_stat_delta(actor, "efficiency")
	var talent_delta: float = _battle_stat_delta(actor, "talent")
	var martial_delta: float = _battle_stat_delta(actor, "martial")
	var body_delta: float = _battle_stat_delta(actor, "body")
	var technique_delta: float = _battle_stat_delta(actor, "technique")
	var cursed_energy_delta: float = _battle_stat_delta(actor, "cursedEnergy")
	var source_delta: float = martial_delta if source in ["攻击", "穿透攻击", "群体攻击"] else 0.0
	var target_martial_delta: float = _battle_stat_delta(target, "martial")
	var target_body_delta: float = _battle_stat_delta(target, "body")
	var cost_multiplier: float = clampf(1.0 - efficiency_delta * float(scaling.get("efficiencyCostPerRank", 0.0)), float(scaling.get("efficiencyCostMin", 0.0)), float(scaling.get("efficiencyCostMax", 1.0)))
	var base_cost: float = CostResolverScript.new().resolve_ce_cost(card.get("cost", {}) as Dictionary, float(actor.get("max_ce", actor.get("ce", 0.0))))
	var cost_ce: float = maxf(0.0, base_cost * cost_multiplier)
	var ce_after_cost: float = maxf(0.0, float(actor.get("ce", 0.0)) - cost_ce)
	var max_ce: float = float(actor.get("max_ce", 0.0))
	var high_ce: float = 1.0
	var high_ce_active: bool = max_ce > 0.0 and ce_after_cost / max_ce >= float(scaling.get("highCeThreshold", 0.5))
	if high_ce_active:
		high_ce = float(scaling.get("highCeDamageMultiplier", 1.0))
	var accuracy: float = clampf(float(scaling.get("controlAccuracyBase", 1.0)) + control_delta * float(scaling.get("controlAccuracyPerRank", 0.0)) - target_martial_delta * float(scaling.get("martialEvasionPerRank", 0.0)), float(scaling.get("accuracyMin", 0.0)), float(scaling.get("accuracyMax", 1.0)))
	# The four per-rank damage coefficients form one source multiplier. This
	# keeps the seven-dimension contribution additive and bounded instead of
	# creating another independent multiplication layer for every stat.
	var source_multiplier_raw: float = 1.0 + source_delta * float(scaling.get("martialDamagePerRank", 0.0)) + body_delta * float(scaling.get("bodyDamagePerRank", 0.0)) + technique_delta * float(scaling.get("techniqueDamagePerRank", 0.0)) + cursed_energy_delta * float(scaling.get("cursedEnergyDamagePerRank", 0.0))
	var source_min: float = float(scaling.get("sourceDamageMin", 0.0))
	var source_max: float = float(scaling.get("sourceDamageMax", 0.0))
	var source_multiplier: float = source_multiplier_raw
	if source_max > source_min and source_max > 0.0:
		source_multiplier = clampf(source_multiplier_raw, source_min, source_max)
	var talent_multiplier: float = 1.0 + talent_delta * float(scaling.get("talentDamagePerRank", 0.0))
	var resistance: float = clampf(float(scaling.get("bodyResistanceBase", 0.0)) + target_body_delta * float(scaling.get("bodyResistancePerRank", 0.0)), float(scaling.get("bodyResistanceMin", 0.0)), float(scaling.get("bodyResistanceMax", 1.0)))
	var damage_before: float = float(values.get("damage", 0.0))
	values["damage"] = maxf(0.0, damage_before * float(scaling.get("baseDamageMultiplier", 1.0)) * source_multiplier * accuracy * talent_multiplier * high_ce * (1.0 - resistance))
	values["block"] = maxf(0.0, float(values.get("block", 0.0)) * (1.0 + talent_delta * float(scaling.get("talentBlockPerRank", 0.0))))
	values["healing"] = maxf(0.0, float(values.get("healing", 0.0)) * (1.0 + talent_delta * float(scaling.get("talentHealingPerRank", 0.0))))
	var ce_damage_multiplier: float = maxf(0.0, float(scaling.get("ceDamageMultiplier", 1.0)) * (1.0 + control_delta * float(scaling.get("ceDamageControlPerRank", 0.0))))
	var stability_multiplier: float = maxf(0.0, float(scaling.get("stabilityDamageMultiplier", 1.0)) * (1.0 + control_delta * float(scaling.get("stabilityDamageControlPerRank", 0.0))))
	var domain_load_multiplier: float = maxf(0.0, float(scaling.get("domainLoadMultiplier", 1.0)) * (1.0 - efficiency_delta * float(scaling.get("domainLoadEfficiencyPerRank", 0.0))))
	var domain_pressure_multiplier: float = maxf(0.0, float(scaling.get("domainPressureMultiplier", 1.0)) * (1.0 + control_delta * float(scaling.get("domainPressureControlPerRank", 0.0))))
	values["ce_damage"] = maxf(0.0, float(values.get("ce_damage", 0.0)) * ce_damage_multiplier)
	values["stability_damage"] = maxf(0.0, float(values.get("stability_damage", 0.0)) * stability_multiplier)
	values["domain_load"] = maxf(0.0, float(values.get("domain_load", 0.0)) * domain_load_multiplier)
	values["domain_pressure"] = maxf(0.0, float(values.get("domain_pressure", 0.0)) * domain_pressure_multiplier)
	values["ce_cost"] = cost_ce
	values["ce_cost_is_resolved"] = true
	trace.append({"tool":"card_scaling", "source":source, "martial_core_weight":float(scaling.get("martialCoreWeight", 0.0)), "technique_core_weight":float(scaling.get("techniqueCoreWeight", 0.0)), "damage_before":damage_before, "damage_after":values["damage"], "source_multiplier":source_multiplier, "source_multiplier_raw":source_multiplier_raw, "source_min":source_min, "source_max":source_max, "accuracy_multiplier":accuracy, "talent_multiplier":talent_multiplier, "high_ce_multiplier":high_ce, "resistance_multiplier":1.0 - resistance, "ce_damage_multiplier":ce_damage_multiplier, "stability_damage_multiplier":stability_multiplier, "domain_load_multiplier":domain_load_multiplier, "domain_pressure_multiplier":domain_pressure_multiplier, "cost_multiplier":cost_multiplier, "high_ce_active":high_ce_active})

func _battle_stat_delta(entity: Dictionary, stat: String) -> float:
	var profile: Dictionary = entity.get("profile", {}) as Dictionary
	var base_stats: Dictionary = entity.get("baseStats", profile.get("baseStats", {})) as Dictionary
	var stats: Dictionary = profile.get("stats", {}) as Dictionary
	var raw: Variant = entity.get(stat, base_stats.get(stat, stats.get(stat, "S")))
	if stat == "technique" and not str(profile.get("techniquePower", "")).is_empty():
		raw = entity.get(stat, profile.get("techniquePower", "S"))
	if raw is Dictionary:
		raw = (raw as Dictionary).get("rank", (raw as Dictionary).get("value", "S"))
	if raw is float or raw is int:
		return float(raw) - BATTLE_RANK_SCORES["S"]
	var rank: String = str(raw).strip_edges().to_upper()
	var score: float = float(BATTLE_RANK_SCORES.get(rank, BATTLE_RANK_SCORES["S"]))
	return score - BATTLE_RANK_SCORES["S"]

func _apply_domain_modifiers(actor: Dictionary, target: Dictionary, values: Dictionary, trace: Array[Dictionary]) -> void:
	var actor_domain: Dictionary = actor.get("domain_state", {}) as Dictionary
	if bool(actor_domain.get("active", false)):
		var actor_profile: Dictionary = actor_domain.get("effect_profile", {}) as Dictionary
		var outgoing: float = maxf(0.0, float(actor_profile.get("outgoing_damage_multiplier", 1.0)))
		if not is_equal_approx(outgoing, 1.0):
			var before_outgoing: float = float(values.get("damage", 0.0))
			values["damage"] = before_outgoing * outgoing
			trace.append({"tool":"domain_modifier", "field":"damage", "source":"attacker", "before":before_outgoing, "scale":outgoing, "after":values["damage"]})
	var target_domain: Dictionary = target.get("domain_state", {}) as Dictionary
	if bool(target_domain.get("active", false)):
		var target_profile: Dictionary = target_domain.get("effect_profile", {}) as Dictionary
		var incoming: float = maxf(0.0, float(target_profile.get("incoming_damage_multiplier", 1.0)))
		if not is_equal_approx(incoming, 1.0):
			var before_incoming: float = float(values.get("damage", 0.0))
			values["damage"] = before_incoming * incoming
			trace.append({"tool":"domain_modifier", "field":"damage", "source":"defender", "before":before_incoming, "scale":incoming, "after":values["damage"]})

func _resolve_evasion(card: Dictionary, actor: Dictionary, target: Dictionary, state: Variant) -> Dictionary:
	var accuracy: Dictionary = card.get("accuracy", {}) as Dictionary
	if accuracy.is_empty() or accuracy.get("evasionAllowed", true) == false:
		return {"checked": false, "evaded": false, "profile": "none", "hit_rate": 1.0, "roll": 0.0}
	var profile: String = str(accuracy.get("profile", "melee"))
	var bonuses: Dictionary = {"melee": 0.0, "weapon": 0.02, "technique_projectile": 0.08, "technique_area": 0.23, "technique_bind": 0.08}
	var attacker_martial: float = _martial_score(actor)
	var defender_martial: float = _martial_score(target)
	var diff: float = attacker_martial - defender_martial
	var base_rate: float = 0.66 + sign(diff) * sqrt(abs(diff)) * 0.055
	var scaling: Dictionary = card.get("scaling", {}) as Dictionary
	if not scaling.is_empty():
		var control_delta: float = _battle_stat_delta(actor, "control")
		var target_martial_delta: float = _battle_stat_delta(target, "martial")
		base_rate = clampf(float(scaling.get("controlAccuracyBase", 1.0)) + control_delta * float(scaling.get("controlAccuracyPerRank", 0.0)) - target_martial_delta * float(scaling.get("martialEvasionPerRank", 0.0)), float(scaling.get("accuracyMin", 0.0)), float(scaling.get("accuracyMax", 1.0)))
	var explicit: Variant = accuracy.get("hitRate", null)
	if explicit != null and is_finite(float(explicit)):
		base_rate = float(explicit) if float(explicit) <= 1.0 else float(explicit) / 100.0
	var hit_rate: float = clampf(base_rate + float(bonuses.get(profile, 0.0)) + float(accuracy.get("modifier", 0.0)), 0.05, 0.96)
	var rng: RefCounted = RngScript.new()
	var action_id: String = str(card.get("action_id", card.get("id", "")))
	var battle_seed: String = str(state.seed) if state != null and "seed" in state else str(actor.get("rng_seed", actor.get("seed", 0)))
	var battle_round: int = int(state.round) if state != null and "round" in state else int(actor.get("round", 1))
	var roll: float = float(rng.call("online_roll", battle_seed, "core", battle_round, "evasion:" + action_id, 1))
	return {"checked": true, "evaded": roll > hit_rate, "profile": profile, "hit_rate": hit_rate, "roll": roll, "attacker_martial": attacker_martial, "defender_martial": defender_martial}

func _martial_score(actor: Dictionary) -> float:
	var direct: Variant = actor.get("martial", null)
	if direct is float or direct is int:
		return float(direct)
	var stats: Dictionary = actor.get("profile", {}).get("stats", {}) as Dictionary
	var value: Variant = stats.get("martial", actor.get("profile", {}).get("martial", 4.0))
	if value is float or value is int:
		return float(value)
	var grades: Dictionary = {"F":0.0,"E":1.0,"D":2.0,"C":3.0,"B":4.0,"A":5.0,"S":6.0,"SS":7.0,"SSS":8.0,"EX":12.0,"EX-":10.0}
	return float(grades.get(str(value).to_upper(), 4.0))

func _run_trigger(effects: Array, trigger: String, actor: Dictionary, target: Dictionary, values: Dictionary, trace: Array[Dictionary], state: Variant) -> Dictionary:
	for raw_effect: Variant in effects:
		if not raw_effect is Dictionary:
			continue
		var atomic: Dictionary = raw_effect as Dictionary
		if str(atomic.get("trigger", "")) != trigger:
			continue
		if not _matches_when(atomic.get("when", []), actor, target):
			continue
		var tool: String = str(atomic.get("tool", ""))
		if tool not in SUPPORTED_TOOLS:
			return {"ok": false, "error": "unsupported_atomic_tool", "tool": tool}
		var params: Dictionary = atomic.get("params", {}) as Dictionary
		var receiver: Dictionary = target if str(atomic.get("target", "self")) == "opponent" else actor
		match tool:
			"require_status":
				var required_status: String = str(params.get("statusId", ""))
				if required_status.is_empty() or not (receiver.get("statuses", {}) as Dictionary).has(required_status): return {"ok":false, "error":"missing_required_status", "status_id":required_status}
				if bool(params.get("consumeAfterUse", false)): (receiver.get("statuses", {}) as Dictionary).erase(required_status)
				trace.append({"tool":tool, "trigger":trigger, "status_id":required_status})
			"require_summon":
				if not _summon_requirement_met(params, actor, target): return {"ok":false, "error":"missing_required_summon", "summon_id":str(params.get("summonId", ""))}
				trace.append({"tool":tool, "trigger":trigger, "summon_id":str(params.get("summonId", ""))})
			"require_value":
				if not _value_requirement_met(params, actor, target): return {"ok":false, "error":"required_value_not_met"}
				trace.append({"tool":tool, "trigger":trigger, "source":str(params.get("source", ""))})
			"selection_rule":
				# 组合限制由 validate_play/CardAvailabilityService 在提交前处理；此处保留可回放 trace。
				trace.append({"tool":tool, "trigger":trigger, "mode":str(params.get("mode", "")), "group_id":str(params.get("groupId", ""))})
			"pay_hp_cost":
				var hp_cost: float = float(params.get("amount", 0.0)) + float(actor.get("max_hp", 0.0)) * float(params.get("ratio", 0.0))
				var minimum_hp: float = 1.0 if bool(params.get("nonlethal", false)) else 0.0
				if float(actor.get("hp", 0.0)) - hp_cost < minimum_hp: return {"ok":false, "error":"insufficient_hp"}
				actor["hp"] = float(actor.get("hp", 0.0)) - hp_cost
				trace.append({"tool":tool, "trigger":trigger, "amount":hp_cost})
			"modify_damage":
				var damage_before: float = float(values.get("damage", 0.0))
				values["damage"] = maxf(0.0, damage_before * float(params.get("multiplier", 1.0)) + float(params.get("flat", 0.0)))
				values["block_ignore_ratio"] = clampf(float(values.get("block_ignore_ratio", 0.0)) + float(params.get("penetrationAdd", 0.0)) + float(params.get("penetrationRatio", 0.0)), 0.0, 0.9)
				trace.append({"tool":tool, "trigger":trigger, "before":damage_before, "after":values["damage"]})
			"set_action_order":
				trace.append({"tool":tool, "trigger":trigger, "priority":int(params.get("priority", 0))})
			"set_damage_policy":
				values["damage_policy"] = str(params.get("policy", "default"))
				trace.append({"tool":tool, "trigger":trigger, "policy":values["damage_policy"]})
			"adjust_action_resource":
				_adjust_action_resource(receiver, params)
				trace.append({"tool":tool, "trigger":trigger, "resource":str(params.get("resource", "")), "amount":float(params.get("amount", 0.0))})
			"modify_weight":
				_append_weight_modifier(receiver, params)
				trace.append({"tool":tool, "trigger":trigger, "family":str(params.get("family", "")), "delta":float(params.get("delta", 0.0))})
			"summon_unit":
				_summon_unit(receiver, params)
				trace.append({"tool":tool, "trigger":trigger, "summon_id":str(params.get("summonId", ""))})
			"update_summon":
				var updated: Dictionary = _update_summon(receiver, str(params.get("summonId", params.get("id", ""))), params)
				if not bool(updated.get("ok", false)): return updated
				trace.append({"tool":tool, "trigger":trigger, "summon_id":str(params.get("summonId", params.get("id", "")))})
			"destroy_summon":
				_destroy_summon(receiver, str(params.get("summonId", params.get("id", ""))))
				trace.append({"tool":tool, "trigger":trigger, "summon_id":str(params.get("summonId", params.get("id", "")))})
			"recall_summon":
				_recall_summon(receiver, str(params.get("summonId", "")))
				trace.append({"tool":tool, "trigger":trigger, "summon_id":str(params.get("summonId", ""))})
			"remove_status":
				var remove_id: String = str(params.get("statusId", params.get("id", "")))
				(receiver.get("statuses", {}) as Dictionary).erase(remove_id)
				trace.append({"tool":tool, "trigger":trigger, "status_id":remove_id})
			"add_computed_status":
				_add_computed_status(receiver, params)
				trace.append({"tool":tool, "trigger":trigger, "status_id":str(params.get("statusId", ""))})
			"grant_temporary_technique_tag":
				_grant_temporary_tag(receiver, actor, target, state, params)
				trace.append({"tool":tool, "trigger":trigger, "slot_id":str(params.get("slotId", ""))})
			"unlock_card_pool":
				_unlock_card_pool(receiver, state, params)
				trace.append({"tool":tool, "trigger":trigger, "pool":str(params.get("pool", ""))})
			"emit_battle_event":
				var emitted: Array = receiver.get("emitted_events", []) as Array
				emitted.append({"id":str(params.get("eventId", "")), "label":str(params.get("label", ""))})
				receiver["emitted_events"] = emitted
				trace.append({"tool":tool, "trigger":trigger, "event_id":str(params.get("eventId", ""))})
			"modify_scale":
				var field: String = str(params.get("field", "damage"))
				var normalized_field: String = _value_field(field)
				var scale: float = float(params.get("scale", params.get("multiplier", params.get("value", 1.0))))
				var before: float = float(values.get(normalized_field, 0.0))
				values[normalized_field] = before * scale
				trace.append({"tool": tool, "trigger": trigger, "field": normalized_field, "before": before, "scale": scale, "after": values[normalized_field]})
			"compute_action_value":
				var computed_field: String = _value_field(str(params.get("field", "damage")))
				var multiplier: float = float(params.get("multiplier", 1.0))
				var offset: float = float(params.get("offset", 0.0))
				# sourceA 是 DSL 的运算输入；赤血操术以「血/穿」计数器参与最终公式。
				var source_value: float = _computed_source_value(params, actor, target, values, computed_field)
				var computed: float = source_value * multiplier + offset
				if str(params.get("mode", "")) != "set" and str(params.get("sourceA", "")).is_empty():
					computed = float(values.get(computed_field, 0.0)) * multiplier + offset
				computed = maxf(float(params.get("minimum", -INF)), computed)
				computed = minf(float(params.get("maximum", INF)), computed)
				if computed_field == "incoming_hp_scale":
					receiver["incomingHpScale"] = computed
					trace.append({"tool": tool, "trigger": trigger, "field": computed_field, "target": str(atomic.get("target", "self")), "value": computed})
				else:
					values[computed_field] = computed
					trace.append({"tool": tool, "trigger": trigger, "field": computed_field, "value": computed})
			"adjust_resource":
				var resource: String = str(params.get("resource", params.get("field", "ce")))
				var amount: float = float(params.get("amount", params.get("delta", 0.0)))
				_adjust_resource(receiver, resource, amount)
				trace.append({"tool": tool, "trigger": trigger, "target": str(atomic.get("target", "self")), "resource": resource, "amount": amount})
			"add_status":
				var status_id: String = str(params.get("statusId", params.get("id", "")))
				if status_id.is_empty():
					return {"ok": false, "error": "status_id_missing"}
				var statuses: Dictionary = receiver.get("statuses", {}) as Dictionary
				var status: Dictionary = params.duplicate(true)
				status["id"] = status_id
				status["label"] = str(params.get("label", status_id))
				status["rounds"] = int(params.get("rounds", 1))
				status["value"] = params.get("value", 1)
				statuses[status_id] = status
				receiver["statuses"] = statuses
				trace.append({"tool": tool, "trigger": trigger, "status_id": status_id})
			"adjust_counter":
				var counter_id: String = str(params.get("counterId", ""))
				if counter_id.is_empty():
					return {"ok": false, "error": "counter_id_missing"}
				var counters: Dictionary = receiver.get("counters", {}) as Dictionary
				var namespace_id: String = str(params.get("namespace", ""))
				var destination: Dictionary = counters.get(namespace_id, {}) as Dictionary if not namespace_id.is_empty() else counters
				destination[counter_id] = clampf(float(destination.get(counter_id, 0.0)) + float(params.get("amount", 0.0)), 0.0, float(params.get("max", INF)))
				if namespace_id.is_empty(): counters = destination
				else: counters[namespace_id] = destination
				receiver["counters"] = counters
				trace.append({"tool": tool, "trigger": trigger, "counter_id": counter_id, "namespace": namespace_id})
			"set_counter":
				var set_counter_id: String = str(params.get("counterId", ""))
				if set_counter_id.is_empty():
					return {"ok": false, "error": "counter_id_missing"}
				var set_counters: Dictionary = receiver.get("counters", {}) as Dictionary
				var set_namespace: String = str(params.get("namespace", ""))
				var set_destination: Dictionary = set_counters.get(set_namespace, {}) as Dictionary if not set_namespace.is_empty() else set_counters
				set_destination[set_counter_id] = clampf(float(params.get("value", 0.0)), 0.0, float(params.get("max", INF)))
				if set_namespace.is_empty(): set_counters = set_destination
				else: set_counters[set_namespace] = set_destination
				receiver["counters"] = set_counters
				trace.append({"tool": tool, "trigger": trigger, "counter_id": set_counter_id, "namespace": set_namespace})
			"consume_counter":
				var consume_counter_id: String = str(params.get("counterId", ""))
				if consume_counter_id.is_empty():
					return {"ok": false, "error": "counter_id_missing"}
				var consume_amount: float = maxf(0.0, float(params.get("amount", 1.0)))
				var consume_counters: Dictionary = receiver.get("counters", {}) as Dictionary
				var consume_namespace: String = str(params.get("namespace", ""))
				var consume_destination: Dictionary = consume_counters.get(consume_namespace, {}) as Dictionary if not consume_namespace.is_empty() else consume_counters
				var available: float = float(consume_destination.get(consume_counter_id, 0.0))
				if str(params.get("amountSource", "")) == "counter":
					consume_amount = available
					if params.has("maxAmount"): consume_amount = minf(consume_amount, float(params.get("maxAmount", consume_amount)))
				if available < consume_amount:
					return {"ok": false, "error": "missing_counter", "counter_id": consume_counter_id, "namespace": consume_namespace, "required": consume_amount, "available": available}
				consume_destination[consume_counter_id] = available - consume_amount
				if consume_namespace.is_empty(): consume_counters = consume_destination
				else: consume_counters[consume_namespace] = consume_destination
				receiver["counters"] = consume_counters
				trace.append({"tool": tool, "trigger": trigger, "counter_id": consume_counter_id, "namespace": consume_namespace, "amount": consume_amount, "remaining": available - consume_amount})
			"set_action_mode":
				if params.has("damage"):
					values["damage"] = float(params.get("damage", values.get("damage", 0.0)))
				if params.has("ceDamage"):
					values["ce_damage"] = float(params.get("ceDamage", values.get("ce_damage", 0.0)))
				trace.append({"tool": tool, "trigger": trigger, "card_type": str(params.get("cardType", "")), "damage": values.get("damage", 0.0)})
			"register_counter_modifier":
				var modifiers: Array = receiver.get("counter_modifiers", []) as Array
				var modifier: Dictionary = {
					"counter_id": str(params.get("counterId", "")),
					"namespace": str(params.get("namespace", "")),
					"label": str(params.get("label", params.get("counterId", ""))),
					"field": str(params.get("field", "")),
					"offset": float(params.get("offset", 0.0)),
					"per_counter": float(params.get("perCounter", 0.0)),
					"minimum": float(params.get("minimum", -INF)),
					"maximum": float(params.get("maximum", INF)),
					"inactive_when_zero": bool(params.get("inactiveWhenZero", false)),
					"hook": str(params.get("hook", ""))
				}
				var replaced: bool = false
				for index: int in modifiers.size():
					var existing: Dictionary = modifiers[index] as Dictionary
					if str(existing.get("counter_id", "")) == str(modifier.get("counter_id", "")) and str(existing.get("namespace", "")) == str(modifier.get("namespace", "")) and str(existing.get("hook", "")) == str(modifier.get("hook", "")):
						modifiers[index] = modifier
						replaced = true
						break
				if not replaced: modifiers.append(modifier)
				receiver["counter_modifiers"] = modifiers
				trace.append({"tool":tool, "trigger":trigger, "counter_id":modifier["counter_id"], "namespace":modifier["namespace"], "hook":modifier["hook"]})
	return {"ok": true}

func _action_priority(card: Dictionary) -> int:
	for raw_effect: Variant in _atomic_effects(card.get("effect", {}) as Dictionary):
		if raw_effect is Dictionary and str((raw_effect as Dictionary).get("tool", "")) == "set_action_order": return int(((raw_effect as Dictionary).get("params", {}) as Dictionary).get("priority", 0))
	return 0

func _value_requirement_met(params: Dictionary, actor: Dictionary, _target: Dictionary) -> bool:
	var source: String = str(params.get("source", params.get("field", "")))
	var value: float = 0.0
	if source == "counter":
		value = _counter_value(actor, str(params.get("counterId", "")), str(params.get("namespace", "")))
	else:
		value = float(actor.get(source.trim_prefix("self."), 0.0))
	var threshold: float = float(params.get("threshold", params.get("minimum", 0.0)))
	match str(params.get("operator", ">=")):
		">": return value > threshold
		">=": return value >= threshold
		"==": return is_equal_approx(value, threshold)
		"<=": return value <= threshold
		"<": return value < threshold
	return false

func _summon_requirement_met(params: Dictionary, actor: Dictionary, target: Dictionary) -> bool:
	var owner: Dictionary = target if str(params.get("owner", "self")) == "opponent" else actor
	var required_id: String = str(params.get("summonId", ""))
	var found: bool = false
	for raw_summon: Variant in owner.get("summons", []) as Array:
		if not raw_summon is Dictionary: continue
		var summon: Dictionary = raw_summon as Dictionary
		if not required_id.is_empty() and str(summon.get("id", "")) != required_id: continue
		if bool(params.get("activeOnly", false)) and not bool(summon.get("active", true)): continue
		found = true
		break
	return not found if str(params.get("presence", "present")) == "absent" else found

func _counter_value(actor: Dictionary, counter_id: String, namespace_id: String) -> float:
	var counters: Dictionary = actor.get("counters", {}) as Dictionary
	var container: Dictionary = counters.get(namespace_id, {}) as Dictionary if not namespace_id.is_empty() else counters
	return float(container.get(counter_id, 0.0))

func _computed_source_value(params: Dictionary, actor: Dictionary, target: Dictionary, values: Dictionary, field: String) -> float:
	match str(params.get("sourceA", "")):
		"constant": return 1.0
		"counter":
			var count: float = _counter_value(actor, str(params.get("sourceACounterId", params.get("counterId", ""))), str(params.get("sourceANamespace", params.get("namespace", ""))))
			if params.has("sourceAMin"): count = maxf(count, float(params.get("sourceAMin", count)))
			if params.has("sourceAMax"): count = minf(count, float(params.get("sourceAMax", count)))
			return count
		"target": return float(target.get(str(params.get("sourceAField", field)), 0.0))
		"self": return float(actor.get(str(params.get("sourceAField", field)), 0.0))
		_: return float(values.get(field, 0.0))

func _adjust_action_resource(receiver: Dictionary, params: Dictionary) -> void:
	var resources: Dictionary = receiver.get("action_resources", {}) as Dictionary
	var key: String = str(params.get("resource", params.get("field", "")))
	resources[key] = {"value":float(resources.get(key, {}).get("value", 0.0)) + float(params.get("amount", params.get("delta", 0.0))), "duration":int(params.get("duration", 0))}
	receiver["action_resources"] = resources

func _append_weight_modifier(receiver: Dictionary, params: Dictionary) -> void:
	var modifiers: Array = receiver.get("weight_modifiers", []) as Array
	modifiers.append({"family":str(params.get("family", "")), "delta":float(params.get("delta", 0.0)), "duration":int(params.get("duration", 0))})
	receiver["weight_modifiers"] = modifiers

func _summon_unit(receiver: Dictionary, params: Dictionary) -> void:
	var summons: Array = receiver.get("summons", []) as Array
	var summon_id: String = str(params.get("summonId", params.get("id", "")))
	var unit: Dictionary = params.duplicate(true)
	unit["id"] = summon_id
	unit["active"] = true
	unit["max_hp"] = float(params.get("maxHp", params.get("max_hp", params.get("hp", 1.0))))
	unit["hp"] = clampf(float(params.get("hp", unit["max_hp"])), 0.0, unit["max_hp"])
	unit["attack"] = float(params.get("attack", params.get("attackPower", 0.0)))
	unit["defense"] = float(params.get("defense", params.get("defensePower", 0.0)))
	var replaced: bool = false
	for index: int in summons.size():
		if str((summons[index] as Dictionary).get("id", "")) == summon_id:
			summons[index] = unit
			replaced = true
			break
	if not replaced: summons.append(unit)
	if not replaced and summons.size() > 3: summons.pop_back()
	receiver["summons"] = summons

func apply_summon_update(receiver: Dictionary, summon_id: String, changes: Dictionary) -> Dictionary:
	return _update_summon(receiver, summon_id, changes)

func _update_summon(receiver: Dictionary, summon_id: String, changes: Dictionary) -> Dictionary:
	var summons: Array = receiver.get("summons", []) as Array
	for index: int in summons.size():
		if not summons[index] is Dictionary or str((summons[index] as Dictionary).get("id", "")) != summon_id: continue
		var summon: Dictionary = (summons[index] as Dictionary).duplicate(true)
		for key: String in ["name", "attack", "defense", "active", "status", "statuses"]:
			if changes.has(key): summon[key] = changes[key]
		var max_hp: float = float(changes.get("maxHp", changes.get("max_hp", summon.get("max_hp", summon.get("hp", 1.0)))))
		if changes.has("maxHp") or changes.has("max_hp"): summon["max_hp"] = max_hp
		if changes.has("hp"):
			summon["hp"] = clampf(float(changes["hp"]), 0.0, max_hp)
		if float(summon.get("hp", 0.0)) <= 0.0:
			summons.remove_at(index)
		else:
			summons[index] = summon
		receiver["summons"] = summons
		return {"ok": true, "tool": "update_summon", "summon_id": summon_id}
	return {"ok": false, "error": "summon_not_found", "summon_id": summon_id}

func _destroy_summon(receiver: Dictionary, summon_id: String) -> void:
	_recall_summon(receiver, summon_id)

func _recall_summon(receiver: Dictionary, summon_id: String) -> void:
	receiver["summons"] = (receiver.get("summons", []) as Array).filter(func(raw: Variant) -> bool: return not (raw is Dictionary and str((raw as Dictionary).get("id", "")) == summon_id))

func _add_computed_status(receiver: Dictionary, params: Dictionary) -> void:
	var status_id: String = str(params.get("statusId", ""))
	if status_id.is_empty(): return
	var source_count: float = _counter_value(receiver, str(params.get("sourceACounterId", "")), str(params.get("sourceANamespace", ""))) if str(params.get("sourceA", "")) == "counter" else 0.0
	var value: float = clampf(float(params.get("offset", 0.0)) + source_count * float(params.get("multiplier", 1.0)), float(params.get("minimum", -INF)), float(params.get("maximum", INF)))
	var statuses: Dictionary = receiver.get("statuses", {}) as Dictionary
	var status: Dictionary = params.duplicate(true)
	status["id"] = status_id
	status["label"] = str(params.get("label", status_id))
	status["rounds"] = int(params.get("rounds", 1))
	status["value"] = value
	if str(params.get("field", "")) == "incomingHpScale": status["incomingHpScale"] = value
	statuses[status_id] = status
	receiver["statuses"] = statuses

func _grant_temporary_tag(receiver: Dictionary, actor: Dictionary, target: Dictionary, state: Variant, params: Dictionary) -> void:
	var tags: Dictionary = receiver.get("temporary_technique_tags", {}) as Dictionary
	var slot: String = str(params.get("slotId", "temporary"))
	var grant: Dictionary = params.duplicate(true)
	grant["resolvedTechniqueFamily"] = _resolve_temporary_technique_family(actor, target, state, grant)
	grant["activeFromRound"] = _state_int(state, "round") + (1 if bool(grant.get("durationStartsNextRound", false)) else 0)
	grant["remainingRounds"] = int(grant.get("durationRounds", 0))
	tags[slot] = grant
	receiver["temporary_technique_tags"] = tags

func _resolve_temporary_technique_family(actor: Dictionary, target: Dictionary, state: Variant, params: Dictionary) -> String:
	if not str(params.get("resolvedTechniqueFamily", "")).is_empty(): return str(params.get("resolvedTechniqueFamily", ""))
	var candidates: Array[String] = []
	if str(params.get("source", "")) == "opponent":
		for raw_family: Variant in (target.get("profile", {}) as Dictionary).get("techniqueFamilies", []) as Array:
			if not candidates.has(str(raw_family)): candidates.append(str(raw_family))
	else:
		var own_families: Array = (actor.get("profile", {}) as Dictionary).get("techniqueFamilies", []) as Array
		var repository: RefCounted = preload("res://battle/data/BattleDataRepository.gd").new()
		for raw_card: Variant in repository.cards():
			if not raw_card is Dictionary: continue
			var family: String = str((raw_card as Dictionary).get("sourceTechniqueFamily", ""))
			if family.is_empty() or own_families.has(family) or candidates.has(family): continue
			candidates.append(family)
	if candidates.is_empty(): return ""
	candidates.sort()
	return candidates[absi(hash("%s:%s:%s" % [_state_int(state, "seed"), _state_int(state, "round"), str(params.get("slotId", "temporary"))])) % candidates.size()]

func _unlock_card_pool(receiver: Dictionary, state: Variant, params: Dictionary) -> void:
	var pools: Array = receiver.get("unlocked_card_pools", []) as Array
	var unlock: Dictionary = params.duplicate(true)
	unlock["activeFromRound"] = _state_int(state, "round") + int(unlock.get("delayRounds", 0))
	var duration: int = int(unlock.get("duration", 0))
	unlock["remainingRounds"] = duration if duration > 0 else -1
	pools.append(unlock)
	receiver["unlocked_card_pools"] = pools

func _state_int(state: Variant, key: String) -> int:
	if state is Dictionary: return int((state as Dictionary).get(key, 0))
	return int(state.get(key)) if state != null else 0

func _apply_base_values(actor: Dictionary, target: Dictionary, values: Dictionary, trace: Array[Dictionary], action_id: String) -> void:
	var damage: float = maxf(0.0, float(values.get("damage", 0.0)))
	var guard: float = maxf(0.0, float(target.get("guard", 0.0)))
	var block_ignore_ratio: float = clampf(float(values.get("block_ignore_ratio", 0.0)), 0.0, 0.9)
	var summon_reduction: float = clampf(float(target.get("damageReductionRatio", 0.0)), 0.0, 0.95)
	if summon_reduction > 0.0:
		damage *= 1.0 - summon_reduction
	var summon_defense: float = maxf(0.0, float(target.get("defense", 0.0)))
	if summon_defense > 0.0:
		var effective_defense: float = summon_defense * (1.0 - block_ignore_ratio)
		var absorbed_by_defense: float = minf(effective_defense, damage)
		damage -= absorbed_by_defense
	var effective_guard: float = guard * (1.0 - block_ignore_ratio)
	var absorbed: float = minf(effective_guard, damage)
	target["guard"] = guard - absorbed
	var after_guard: float = maxf(0.0, damage - absorbed)
	var incoming_hp_scale: float = _incoming_hp_scale(target)
	var applied_hp_damage: float = after_guard * incoming_hp_scale
	target["hp"] = clampf(float(target.get("hp", 0.0)) - applied_hp_damage, 0.0, float(target.get("max_hp", INF)))
	target["ce"] = clampf(float(target.get("ce", 0.0)) - maxf(0.0, float(values.get("ce_damage", 0.0))), 0.0, float(target.get("max_ce", INF)))
	if target.has("stability"):
		target["stability"] = maxf(0.0, float(target.get("stability", 0.0)) - maxf(0.0, float(values.get("stability_damage", 0.0))) / 100.0)
	actor["hp"] = clampf(float(actor.get("hp", 0.0)) + float(values.get("healing", 0.0)), 0.0, float(actor.get("max_hp", INF)))
	actor["guard"] = maxf(0.0, float(actor.get("guard", 0.0)) + float(values.get("block", 0.0)) + float(values.get("shield", 0.0)))
	actor["domain_load"] = maxf(0.0, float(actor.get("domain_load", 0.0)) + float(values.get("domain_load", 0.0)))
	target["domain_load"] = maxf(0.0, float(target.get("domain_load", 0.0)) + float(values.get("domain_pressure", 0.0)))
	trace.append({"tool": "base_action", "action_id": action_id, "damage": damage, "damage_type": str(values.get("damage_type", "standard")), "block_ignore_ratio": block_ignore_ratio, "guard_before": guard, "effective_guard": effective_guard, "absorbed": absorbed, "after_guard": after_guard, "incoming_hp_scale": incoming_hp_scale, "applied_hp_damage": applied_hp_damage, "stability_damage": float(values.get("stability_damage", 0.0)), "domain_load": float(values.get("domain_load", 0.0)), "domain_pressure": float(values.get("domain_pressure", 0.0)), "target_kind": "summon" if target.has("id") and target.has("max_hp") and target.has("damageReductionRatio") else "actor"})
	if target.has("id") and target.has("max_hp") and target.has("damageReductionRatio") and float(target.get("hp", 0.0)) <= 0.0:
		# The summon dictionary is owned by the defender's summons array; the caller
		# removes it after resolving the card so the snapshot cannot retain corpses.
		target["active"] = false

func _resolve_damage_target(effect: Dictionary, defender: Dictionary) -> Dictionary:
	var summon_id: String = _requested_summon_id(effect)
	var raw_target: Variant = effect.get("target", null)
	if raw_target is Dictionary:
		var target_spec: Dictionary = raw_target as Dictionary
		if str(target_spec.get("type", "")) == "summon":
			summon_id = str(target_spec.get("summonId", target_spec.get("id", summon_id)))
	if summon_id.is_empty():
		var interceptor: Dictionary = _front_interceptor(defender)
		return interceptor if not interceptor.is_empty() else defender
	for raw_summon: Variant in defender.get("summons", []) as Array:
		if raw_summon is Dictionary and str((raw_summon as Dictionary).get("id", "")) == summon_id:
			return raw_summon as Dictionary
	return defender

func _requested_summon_id(effect: Dictionary) -> String:
	var summon_id: String = str(effect.get("targetSummonId", ""))
	var raw_target: Variant = effect.get("target", null)
	if raw_target is Dictionary and str((raw_target as Dictionary).get("type", "")) == "summon":
		var target_spec: Dictionary = raw_target as Dictionary
		summon_id = str(target_spec.get("summonId", target_spec.get("id", summon_id)))
	return summon_id

func _front_interceptor(defender: Dictionary) -> Dictionary:
	var selected: Dictionary = {}
	var selected_priority: int = -2147483648
	for raw_summon: Variant in defender.get("summons", []) as Array:
		if not raw_summon is Dictionary: continue
		var summon: Dictionary = raw_summon as Dictionary
		if not bool(summon.get("active", true)): continue
		var guard_rules: Dictionary = summon.get("guardRules", {}) as Dictionary
		if not bool(guard_rules.get("interceptsOpponentAttacks", false)): continue
		var priority: int = int(guard_rules.get("priority", 0))
		if selected.is_empty() or priority > selected_priority:
			selected = summon
			selected_priority = priority
	return selected

func _remove_dead_summon(defender: Dictionary, damage_target: Dictionary) -> void:
	if damage_target == defender or float(damage_target.get("hp", 1.0)) > 0.0:
		return
	var summon_id: String = str(damage_target.get("id", ""))
	if summon_id.is_empty():
		return
	defender["summons"] = (defender.get("summons", []) as Array).filter(func(raw: Variant) -> bool:
		return not (raw is Dictionary and str((raw as Dictionary).get("id", "")) == summon_id)
	)

func _incoming_hp_scale(target: Dictionary) -> float:
	var scale: float = maxf(0.0, float(target.get("incomingHpScale", target.get("incoming_hp_scale", 1.0))))
	var statuses: Dictionary = target.get("statuses", {}) as Dictionary
	for raw_status: Variant in statuses.values():
		if not raw_status is Dictionary:
			continue
		var status: Dictionary = raw_status as Dictionary
		if int(status.get("rounds", 1)) == 0:
			continue
		scale *= maxf(0.0, float(status.get("incomingHpScale", status.get("incoming_hp_scale", 1.0))))
	var counters: Dictionary = target.get("counters", {}) as Dictionary
	for raw_modifier: Variant in target.get("counter_modifiers", []) as Array:
		if not raw_modifier is Dictionary: continue
		var modifier: Dictionary = raw_modifier as Dictionary
		var namespace_id: String = str(modifier.get("namespace", ""))
		var container: Dictionary = counters.get(namespace_id, {}) as Dictionary if not namespace_id.is_empty() else counters
		var count: float = float(container.get(str(modifier.get("counter_id", "")), 0.0))
		if bool(modifier.get("inactive_when_zero", false)) and count <= 0.0: continue
		if str(modifier.get("field", "")) != "incomingHpScale": continue
		var modifier_scale: float = clampf(float(modifier.get("offset", 0.0)) + float(modifier.get("per_counter", 0.0)) * count, float(modifier.get("minimum", -INF)), float(modifier.get("maximum", INF)))
		scale *= maxf(0.0, modifier_scale)
	return scale

func _adjust_resource(receiver: Dictionary, resource: String, amount: float) -> void:
	match resource:
		"ce", "cursed_energy":
			receiver["ce"] = clampf(float(receiver.get("ce", 0.0)) + amount, 0.0, float(receiver.get("max_ce", INF)))
		"hp":
			receiver["hp"] = clampf(float(receiver.get("hp", 0.0)) + amount, 0.0, float(receiver.get("max_hp", INF)))
		"domain_load", "domainLoad":
			receiver["domain_load"] = maxf(0.0, float(receiver.get("domain_load", 0.0)) + amount)

func _atomic_effects(effect: Dictionary) -> Array:
	var special: Variant = effect.get("special", {})
	if not special is Dictionary:
		return []
	var raw: Variant = (special as Dictionary).get("atomicEffects", [])
	if raw is Array:
		return raw as Array
	if raw is Dictionary:
		return [raw]
	return []

func _value_field(field: String) -> String:
	match field:
		"damage", "damageScale", "outgoingScale": return "damage"
		"ceDamage", "ce_damage": return "ce_damage"
		"costCe", "ceCost", "ce_cost": return "ce_cost"
		"healing": return "healing"
		"block", "shield": return field
		"domainLoad", "domain_load": return "domain_load"
		"domainPressure", "domain_pressure": return "domain_pressure"
		"stabilityDamage", "stability_damage": return "stability_damage"
		"incomingHpScale", "incoming_hp_scale": return "incoming_hp_scale"
		"blockIgnoreRatio", "block_ignore_ratio": return "block_ignore_ratio"
		_: return field

func _matches_when(raw_conditions: Variant, actor: Dictionary, target: Dictionary) -> bool:
	if not raw_conditions is Array:
		return true
	for raw_condition: Variant in raw_conditions as Array:
		if not raw_condition is Dictionary:
			continue
		var condition: Dictionary = raw_condition as Dictionary
		var value: float = 0.0
		var source: String = str(condition.get("source", ""))
		if source == "counter":
			var counters: Dictionary = actor.get("counters", {}) as Dictionary
			var namespace_id: String = str(condition.get("namespace", ""))
			var container: Dictionary = counters.get(namespace_id, {}) as Dictionary if not namespace_id.is_empty() else counters
			value = float(container.get(str(condition.get("counterId", "")), 0.0))
		elif source.begins_with("target."):
			value = float(target.get(source.trim_prefix("target."), 0.0))
		else:
			value = float(actor.get(source.trim_prefix("self."), 0.0))
		var threshold: float = float(condition.get("threshold", 0.0))
		match str(condition.get("operator", "==")):
			">": if value <= threshold: return false
			">=": if value < threshold: return false
			"==": if not is_equal_approx(value, threshold): return false
			"<=": if value > threshold: return false
			"<": if value >= threshold: return false
			_: return false
	return true

