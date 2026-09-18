class_name ActionResolverV3
extends RefCounted

const RulesScript: Script = preload("res://battle/v3/BattleRulesV3.gd")
const AdapterScript: Script = preload("res://battle/v3/ActionDefinitionAdapterV3.gd")
const DefenseScript: Script = preload("res://battle/v3/DefenseResolverV3.gd")
const DslScript: Script = preload("res://battle/v3/DslRuntimeV3.gd")
const StateScript: Script = preload("res://battle/core/BattleState.gd")

var _rules: RefCounted = RulesScript.new()
var _defense: RefCounted = DefenseScript.new()
var _dsl: RefCounted = DslScript.new()

func resolve_action(before_state: BattleState, intent: ActionIntentV3, mode: StringName = &"commit") -> Dictionary:
	if before_state == null or intent == null: return _failure("missing_input")
	var actor_index: int = int(intent.actor_index)
	if actor_index not in [0, 1]: return _failure("invalid_actor")
	var snapshot: Dictionary = before_state.canonical_snapshot()
	var working: BattleState = StateScript.new()
	working.restore_canonical_snapshot(snapshot)
	var actor: Dictionary = working.actors[actor_index] as Dictionary
	var target_index: int = 1 - actor_index
	var target: Dictionary = working.actors[target_index] as Dictionary
	var actor_statuses: Dictionary = actor.get("statuses", {}) as Dictionary
	if _contains_technique_burnout(actor_statuses):
		for blocked_id: String in intent.card_instance_ids:
			var blocked_card: Dictionary = _find_card(actor, blocked_id)
			if _is_technique_card(blocked_card): return _failure("technique_burnout")
	if float(target.get("hp", 0.0)) <= 0.0: return _failure("target_defeated")
	_apply_derived_stats(actor)
	_apply_derived_stats(target)
	working.actors[actor_index] = actor
	working.actors[target_index] = target
	var all_trace: Array[Dictionary] = []
	var action_results: Array[Dictionary] = []
	# set_action_order is a card declaration, not a UI ordering suggestion. Sort
	# once from the same input snapshot so support cards (for example 苍附着) can
	# affect later cards in the submitted batch.
	var ordered_card_ids: Array[String] = intent.card_instance_ids.duplicate()
	ordered_card_ids.sort_custom(func(left_id: String, right_id: String) -> bool: return _action_priority(_find_card(actor, left_id)) < _action_priority(_find_card(actor, right_id)))
	for card_id: String in ordered_card_ids:
		var card: Dictionary = _find_card(actor, card_id)
		if card.is_empty(): return _failure("card_not_in_hand")
		var resolved: Dictionary = _resolve_card(card, actor, target, working, actor_index)
		if not bool(resolved.get("ok", false)): return resolved
		all_trace.append_array(resolved.get("trace", []) as Array)
		action_results.append(resolved)
		actor = working.actors[actor_index] as Dictionary
		target = working.actors[target_index] as Dictionary
	working.actors[actor_index] = actor
	working.actors[target_index] = target
	var result: Dictionary = {
		"ok": true,
		"ruleset_version": String(BattleRulesV3.RULESET_VERSION),
		"actor_index": actor_index,
		"target_index": target_index,
		"actions": action_results,
		"trace": all_trace,
		"before_state_hash": str(snapshot.get("state_hash", "")),
		"after_state": working.canonical_snapshot(),
		"after_state_hash": str(working.canonical_snapshot().get("state_hash", ""))
	}
	if mode != &"preview": before_state.restore_canonical_snapshot(result.after_state)
	return result

func preview_action(before_state: BattleState, intent: ActionIntentV3) -> Dictionary:
	return resolve_action(before_state, intent, &"preview")

func _resolve_card(card: Dictionary, actor: Dictionary, target: Dictionary, state: RefCounted, actor_index: int) -> Dictionary:
	# Cards in one submitted batch can grant a status used by the next card. Reset
	# derived attributes to their immutable base, then rebuild runtime modifiers for
	# every action so modifiers neither lag one card nor compound repeatedly.
	_apply_derived_stats(actor)
	_apply_derived_stats(target)
	_apply_runtime_modifiers(actor)
	_apply_runtime_modifiers(target)
	var definition: ActionDefinitionV3 = AdapterScript.from_card(card)
	if _summon_capacity_exceeded(actor, definition.dsl_effects): return _failure("summon_limit_reached")
	var deltas: Dictionary = _combatant_deltas(actor)
	var values: Dictionary = definition.base_values.duplicate(true)
	var scaling: Dictionary = definition.scaling_profile
	# Preview resolves against a detached BattleState, so it may stage and apply
	# mutations locally. The caller decides whether that detached state is committed.
	var dsl_result: Dictionary = _dsl.evaluate(definition.dsl_effects, actor, target, values, false, {"round":state.round})
	if not bool(dsl_result.get("ok", false)): return dsl_result
	values = dsl_result.get("values", values) as Dictionary
	var damage_profile: Dictionary = scaling.get("damage", {}) as Dictionary
	var damage_multiplier: float = _rules.channel_multiplier(damage_profile.get("weights", {}) as Dictionary, deltas, float(damage_profile.get("minimum", 0.0)), float(damage_profile.get("maximum", 3.0)))
	if scaling.has("baseDamageMultiplier"): damage_multiplier *= float(scaling.get("baseDamageMultiplier", 1.0))
	var high_ce_active: bool = float(actor.get("max_ce", 0.0)) > 0.0 and float(actor.get("ce", 0.0)) / float(actor.get("max_ce", 1.0)) >= float(scaling.get("highCeThreshold", 2.0))
	if high_ce_active: damage_multiplier *= float(scaling.get("highCeDamageMultiplier", 1.0))
	values["raw_damage"] = float(values.get("damage", 0.0))
	values["damage_scaling_multiplier"] = damage_multiplier
	values["scaled_damage"] = maxf(0.0, float(values.get("damage", 0.0)) * damage_multiplier)
	values["damage"] = float(values.get("scaled_damage", 0.0))
	values["ce_damage"] = float(values.get("ce_damage", 0.0)) * _channel_multiplier(scaling, "ce_damage", deltas)
	values["stability_damage"] = float(values.get("stability_damage", 0.0)) * _channel_multiplier(scaling, "stability_damage", deltas)
	values["healing"] = float(values.get("healing", 0.0)) * _channel_multiplier(scaling, "healing", deltas)
	values["guard"] = float(values.get("guard", 0.0)) * _channel_multiplier(scaling, "guard", deltas)
	# A DSL costCe formula is an override of the card's source cost, not a second
	# cosmetic display value. This keeps UI preview and CE settlement identical.
	var cost: Dictionary = _resolve_cost(definition.cost, scaling, actor, deltas, definition.category, float(values.get("cost_ce", -1.0)), bool(values.get("cost_affected_by_efficiency", true)))
	if float(actor.get("ce", 0.0)) + 0.0001 < float(cost.get("resolved_ce", 0.0)):
		return {"ok":false, "error":"insufficient_ce", "required":float(cost.get("resolved_ce", 0.0))}
	var outgoing: float = maxf(0.0, float(actor.get("outgoing_damage_multiplier", 1.0)))
	var incoming: float = maxf(0.0, float(target.get("incoming_damage_multiplier", 1.0)))
	var actor_domain: Dictionary = actor.get("domain_state", {}) as Dictionary
	var target_domain: Dictionary = target.get("domain_state", {}) as Dictionary
	if bool(actor_domain.get("active", false)): outgoing *= maxf(0.0, float(actor_domain.get("outgoing_damage_multiplier", 1.0)))
	if bool(target_domain.get("active", false)): incoming *= maxf(0.0, float(target_domain.get("incoming_damage_multiplier", 1.0)))
	var resistance: float = clampf(float(target.get("damage_resistance", 0.0)), 0.0, 0.95)
	var post_modifier: float = values.damage * outgoing * incoming * (1.0 - resistance)
	# DSL set_action_mode may replace the card's static attack profile (赫 becomes
	# a non-attacking support action while 苍 is present). Resolve hit semantics
	# from the calculated action context, otherwise the UI/preview sees one mode
	# while settlement still runs the original projectile/evasion branch.
	var effective_accuracy: Dictionary = _effective_accuracy_profile(definition.accuracy_profile, values)
	var hit: Dictionary = _resolve_hit(effective_accuracy, scaling, actor, target, state, definition.id)
	var miss_profile: Dictionary = effective_accuracy.get("onMiss", {}) as Dictionary
	if bool(hit.get("evaded", false)):
		post_modifier *= _safe_number(miss_profile.get("damageScale", 0.0), 0.0)
		values.ce_damage *= _safe_number(miss_profile.get("ceDamageScale", 0.0), 0.0)
		values.stability_damage *= _safe_number(miss_profile.get("stabilityScale", miss_profile.get("stabilityDamageScale", 0.0)), 0.0)
	var mitigation: Dictionary = _defense.resolve(target, post_modifier, float(values.get("block_ignore_ratio", 0.0)))
	var trace: Array[Dictionary] = [
		{"stage":"values", "action_id":definition.id, "raw_damage":float(values.get("raw_damage", 0.0)), "scaled_damage":float(values.get("scaled_damage", 0.0)), "post_modifier_damage":post_modifier},
		{"stage":"hit", "result":hit.duplicate(true)},
		{"stage":"defense", "result":mitigation.duplicate(true)},
		{"stage":"cost", "result":cost.duplicate(true)}
	]
	var hp_after: float = clampf(float(target.get("hp", 0.0)) - float(mitigation.get("hp_damage", 0.0)), 0.0, float(target.get("max_hp", INF)))
	var ce_after: float = clampf(float(actor.get("ce", 0.0)) - float(cost.get("resolved_ce", 0.0)), 0.0, float(actor.get("max_ce", INF)))
	actor["ce"] = ce_after
	actor["hp"] = clampf(float(actor.get("hp", 0.0)) + float(values.get("healing", 0.0)), 0.0, float(actor.get("max_hp", INF)))
	actor["guard"] = maxf(0.0, float(actor.get("guard", 0.0)) + float(values.get("guard", 0.0)) + float(values.get("shield", 0.0)))
	target["hp"] = hp_after
	target["ce"] = clampf(float(target.get("ce", 0.0)) - maxf(0.0, float(values.get("ce_damage", 0.0))), 0.0, float(target.get("max_ce", INF)))
	target["stability"] = clampf(float(target.get("stability", 100.0)) - maxf(0.0, float(values.get("stability_damage", 0.0))), 0.0, 100.0)
	if bool(actor_domain.get("active", false)):
		actor_domain["load"] = clampf(float(actor_domain.get("load", 0.0)) + maxf(0.0, float(values.get("domain_load", 0.0))), 0.0, float(actor_domain.get("threshold", 100.0)))
		actor["domain_state"] = actor_domain
	if bool(target_domain.get("active", false)):
		target_domain["load"] = clampf(float(target_domain.get("load", 0.0)) + maxf(0.0, float(values.get("domain_pressure", 0.0))), 0.0, float(target_domain.get("threshold", 100.0)))
		if float(target_domain.get("load", 0.0)) >= float(target_domain.get("threshold", 100.0)):
			var meltdown_ce_loss: float = minf(float(target.get("ce", 0.0)), float(target.get("max_ce", 0.0)) * 0.20)
			target["ce"] = float(target.get("ce", 0.0)) - meltdown_ce_loss
			target_domain["active"] = false
			target_domain["load"] = 0.0
			target_domain["end_reason"] = "domain_meltdown"
			target_domain["collapsed_this_round"] = true
			var target_statuses: Dictionary = target.get("statuses", {}) as Dictionary
			target_statuses["technique_burnout"] = {"id":"technique_burnout", "rounds":2, "value":1, "source":"domain_meltdown"}
			target["statuses"] = target_statuses
			state.append_event("domain_meltdown", {"actor_index":1 - actor_index, "reason":"pressure_threshold", "ce_loss":meltdown_ce_loss})
		target["domain_state"] = target_domain
	if float(mitigation.get("guard_absorbed", 0.0)) > 0.0: target["guard"] = maxf(0.0, float(target.get("guard", 0.0)) - float(mitigation.get("guard_absorbed", 0.0)))
	var dsl_mutations: Array[Dictionary] = []
	for raw_mutation: Variant in dsl_result.get("mutations", []) as Array:
		if raw_mutation is Dictionary: dsl_mutations.append(raw_mutation as Dictionary)
	_dsl.apply_mutations(actor, target, dsl_mutations)
	var zones: Dictionary = actor.get("zones", {}) as Dictionary
	zones["hand"] = (zones.get("hand", []) as Array).filter(func(item: Dictionary) -> bool: return str(item.get("instance_id", "")) != str(card.get("instance_id", "")))
	(zones.get("discard", []) as Array).append(card.duplicate(true))
	actor["zones"] = zones
	trace.append_array(dsl_result.get("trace", []) as Array)
	return {"ok":true, "action_id":definition.id, "cost":cost, "values":values, "mitigation":mitigation, "outcome":{"hit":not bool(hit.get("evaded", false)), "evaded":bool(hit.get("evaded", false)), "hp_damage":float(mitigation.get("hp_damage", 0.0)), "defeated":hp_after <= 0.0}, "mutations":dsl_mutations, "trace":trace}

func _effective_accuracy_profile(base: Dictionary, values: Dictionary) -> Dictionary:
	var profile: Dictionary = base.duplicate(true)
	var mode: Variant = values.get("accuracy_profile", null)
	if mode is Dictionary:
		profile = (mode as Dictionary).duplicate(true)
	elif mode != null:
		var mode_name: String = str(mode).to_lower()
		if mode_name in ["none", "support", "non_attack"]:
			profile = {}
		else:
			profile["profile"] = mode_name
	if values.has("evasion_allowed"):
		profile["evasionAllowed"] = bool(values.get("evasion_allowed", true))
	return profile

func _resolve_cost(cost: Dictionary, scaling: Dictionary, actor: Dictionary, deltas: Dictionary, category: String, dsl_base_override: float = -1.0, affected_by_efficiency: bool = true) -> Dictionary:
	var base: float = dsl_base_override if dsl_base_override >= 0.0 else maxf(maxf(float(cost.get("ce", 0.0)), float(actor.get("max_ce", 0.0)) * float(cost.get("ceRatio", 0.0))), float(cost.get("minCe", 0.0)))
	var multiplier: float = clampf(1.0 - float(deltas.get("efficiency", 0.0)) * float(scaling.get("efficiencyCostPerRank", 0.0)), float(scaling.get("efficiencyCostMin", 0.5)), float(scaling.get("efficiencyCostMax", 1.5))) if affected_by_efficiency else 1.0
	var strategy_multiplier: float = maxf(0.0, float(actor.get("technique_cost_multiplier", 1.0))) if category == "technique" else 1.0
	var resolved: float = maxf(0.0, base * multiplier * maxf(0.0, float(actor.get("ce_cost_multiplier", 1.0))) * strategy_multiplier)
	return {"base_ce":base, "resolved_ce":resolved, "paid_ce":resolved, "cost_multiplier":multiplier, "strategy_multiplier":strategy_multiplier}

func _resolve_hit(accuracy: Dictionary, scaling: Dictionary, actor: Dictionary, target: Dictionary, state: RefCounted, action_id: String) -> Dictionary:
	if accuracy.is_empty() or accuracy.get("evasionAllowed", true) == false: return {"checked":false, "evaded":false, "hit_rate":1.0, "roll":0.0}
	var actor_deltas: Dictionary = _combatant_deltas(actor)
	var target_deltas: Dictionary = _combatant_deltas(target)
	var base: float = float(scaling.get("controlAccuracyBase", accuracy.get("baseAccuracy", 0.70)))
	var rate: float = base + float(actor_deltas.get("control", 0.0)) * float(scaling.get("controlAccuracyPerRank", accuracy.get("controlAccuracyWeight", 0.0))) - float(target_deltas.get("martial", 0.0)) * float(scaling.get("martialEvasionPerRank", accuracy.get("targetMartialEvasionWeight", 0.0))) + float(actor.get("accuracy_bonus", 0.0)) - float(target.get("evasion_bonus", 0.0))
	rate = clampf(rate, float(scaling.get("accuracyMin", 0.10)), float(scaling.get("accuracyMax", 0.95)))
	var roll: float = float(absi(hash("%s:%s:%s:%s" % [state.seed, state.round, actor.id, action_id])) % 10000) / 10000.0
	return {"checked":true, "evaded":roll > rate, "hit_rate":rate, "roll":roll}

func _combatant_deltas(actor: Dictionary) -> Dictionary:
	var cached: Variant = actor.get("dimension_deltas", null)
	if cached is Dictionary: return (cached as Dictionary).duplicate(true)
	return _rules.dimension_deltas(actor.get("profile", {}) as Dictionary)

func _is_technique_card(card: Dictionary) -> bool:
	var type: String = str(card.get("type", card.get("category", ""))).to_lower()
	var tags: Array = card.get("tags", []) as Array
	return type in ["technique", "spell", "术式"] or tags.has("technique") or tags.has("术式") or not str(card.get("sourceTechniqueFamily", "")).is_empty()

func _contains_technique_burnout(statuses: Dictionary) -> bool:
	for key: String in ["technique_burnout", "techniqueBurnout", "technique_imbalance", "techniqueImbalance"]:
		if statuses.has(key):
			var status: Variant = statuses[key]
			if not status is Dictionary or int((status as Dictionary).get("rounds", 1)) != 0: return true
	return false

func _summon_capacity_exceeded(actor: Dictionary, effects: Array) -> bool:
	var summons: Array = actor.get("summons", []) as Array
	if summons.size() < 3: return false
	for raw_effect: Variant in effects:
		if not raw_effect is Dictionary: continue
		var effect: Dictionary = raw_effect as Dictionary
		if str(effect.get("tool", "")) != "summon_unit": continue
		var params: Dictionary = effect.get("params", {}) as Dictionary
		var summon_id: String = str(params.get("unitId", params.get("summonId", params.get("id", ""))))
		var replaces: bool = false
		for raw_summon: Variant in summons:
			if raw_summon is Dictionary and str((raw_summon as Dictionary).get("id", "")) == summon_id: replaces = true
		if not replaces: return true
	return false

func _apply_derived_stats(actor: Dictionary) -> void:
	var profile: Dictionary = actor.get("profile", {}) as Dictionary
	var derived: Dictionary = _rules.derive_combatant_stats(profile)
	# Guard is a mutable battle resource.  It is initialized from the profile at
	# strategy confirmation, then gained/consumed by cards and attacks; rebuilding
	# it from base_guard for every action erased defense cards before the opponent
	# could hit them.
	for key: String in ["defense", "outgoing_damage_multiplier", "incoming_damage_multiplier", "damage_resistance", "accuracy_bonus", "evasion_bonus", "ce_cost_multiplier", "ce_regen_multiplier", "dimension_deltas"]:
		var base_key: String = "base_" + key
		if not actor.has(base_key): actor[base_key] = actor.get(key, derived.get(key))
		actor[key] = (actor.get(base_key) as Dictionary).duplicate(true) if actor.get(base_key) is Dictionary else actor.get(base_key)
	if not actor.has("stability"): actor["stability"] = derived.get("stability", 100.0)

func _apply_runtime_modifiers(actor: Dictionary) -> void:
	for raw_status: Variant in (actor.get("statuses", {}) as Dictionary).values():
		if not raw_status is Dictionary: continue
		var status: Dictionary = raw_status as Dictionary
		actor["outgoing_damage_multiplier"] = maxf(0.0, float(actor.get("outgoing_damage_multiplier", 1.0)) * float(status.get("outgoingScale", status.get("outgoing_damage_multiplier", 1.0))))
		actor["incoming_damage_multiplier"] = maxf(0.0, float(actor.get("incoming_damage_multiplier", 1.0)) * float(status.get("incomingHpScale", status.get("incoming_damage_multiplier", 1.0))))
		actor["accuracy_bonus"] = float(actor.get("accuracy_bonus", 0.0)) + float(status.get("hitRateModifier", status.get("accuracy_bonus", 0.0)))
		actor["evasion_bonus"] = float(actor.get("evasion_bonus", 0.0)) + float(status.get("evasionBonus", status.get("evasion_bonus", 0.0)))
	for raw_modifier: Variant in actor.get("counter_modifiers", []) as Array:
		if not raw_modifier is Dictionary: continue
		var modifier: Dictionary = raw_modifier as Dictionary
		var counters: Dictionary = actor.get("counters", {}) as Dictionary
		var namespace_id: String = str(modifier.get("namespace", ""))
		var storage: Dictionary = counters.get(namespace_id, {}) as Dictionary if not namespace_id.is_empty() else counters
		var count: float = float(storage.get(str(modifier.get("counter_id", "")), 0.0))
		if count <= 0.0 and bool(modifier.get("inactive_when_zero", false)): continue
		var value: float = clampf(float(modifier.get("offset", 1.0)) + count * float(modifier.get("per_counter", 0.0)), float(modifier.get("minimum", -INF)), float(modifier.get("maximum", INF)))
		match str(modifier.get("field", "")):
			"incomingHpScale", "incoming_damage_multiplier": actor["incoming_damage_multiplier"] = maxf(0.0, float(actor.get("incoming_damage_multiplier", 1.0)) * value)
			"outgoingScale", "outgoing_damage_multiplier": actor["outgoing_damage_multiplier"] = maxf(0.0, float(actor.get("outgoing_damage_multiplier", 1.0)) * value)
			"accuracy_bonus": actor["accuracy_bonus"] = float(actor.get("accuracy_bonus", 0.0)) + value
			"evasion_bonus": actor["evasion_bonus"] = float(actor.get("evasion_bonus", 0.0)) + value

func _channel_multiplier(scaling: Dictionary, channel: String, deltas: Dictionary) -> float:
	var profile: Dictionary = scaling.get(channel, {}) as Dictionary
	return _rules.channel_multiplier(profile.get("weights", {}) as Dictionary, deltas, float(profile.get("minimum", 0.0)), float(profile.get("maximum", 3.0)))

func _find_card(actor: Dictionary, card_id: String) -> Dictionary:
	for zone_name: String in ["hand", "selected"]:
		for raw_card: Variant in (actor.get("zones", {}) as Dictionary).get(zone_name, []) as Array:
			if raw_card is Dictionary and str((raw_card as Dictionary).get("instance_id", "")) == card_id: return (raw_card as Dictionary).duplicate(true)
	return {}

func _action_priority(card: Dictionary) -> int:
	var special: Dictionary = ((card.get("effect", {}) as Dictionary).get("special", {}) as Dictionary)
	var raw_effects: Variant = special.get("atomicEffects", [])
	if not raw_effects is Array: return 0
	for raw_effect: Variant in raw_effects as Array:
		if raw_effect is Dictionary and str((raw_effect as Dictionary).get("tool", "")) == "set_action_order":
			return int(((raw_effect as Dictionary).get("params", {}) as Dictionary).get("priority", 0))
	return 0

func _failure(reason: String) -> Dictionary:
	return {"ok":false, "error":reason}

func _safe_number(value: Variant, fallback: float = 0.0) -> float:
	if value == null: return fallback
	if value is bool: return 1.0 if bool(value) else 0.0
	if value is int or value is float: return float(value)
	var text := str(value).strip_edges()
	if text.is_empty(): return fallback
	return float(text) if text.is_valid_float() else fallback
