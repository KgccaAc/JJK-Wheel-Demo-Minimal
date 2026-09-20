class_name DomainRuntimeV3
extends RefCounted

const THRESHOLD: float = 100.0
const DataScript: Script = preload("res://battle/data/BattleDataRepository.gd")
var _data: RefCounted = DataScript.new()

func activate(state: BattleState, actor_index: int, domain_id: String = "") -> Dictionary:
	if state == null or actor_index not in [0, 1]: return {"ok":false, "error":"invalid_state"}
	var actor: Dictionary = state.actors[actor_index] as Dictionary
	var current: Dictionary = actor.get("domain_state", {}) as Dictionary
	if bool(current.get("active", false)): return {"ok":false, "error":"domain_already_active"}
	var profile: Dictionary = actor.get("profile", {}) as Dictionary
	var resolved_id: String = domain_id if not domain_id.is_empty() else str(profile.get("domainId", ""))
	if resolved_id.is_empty(): return {"ok":false, "error":"domain_not_available"}
	var record: Dictionary = _find_domain(resolved_id)
	var resource: Dictionary = record.get("resource", {}) as Dictionary
	var cost_ratio: float = float(resource.get("ceCostRatio", 0.35))
	var cost: float = maxf(0.0, _actor_number(actor, "max_ce", 0.0) * cost_ratio * maxf(0.0, _actor_number(actor, "ce_cost_multiplier", 1.0)) * maxf(0.0, _actor_number(actor, "domain_cost_multiplier", 1.0)))
	if float(actor.get("ce", 0.0)) < cost: return {"ok":false, "error":"insufficient_ce", "required":cost}
	actor["ce"] = float(actor.get("ce", 0.0)) - cost
	var load_base: float = float(resource.get("domainLoadBase", 0.0))
	var load_growth: float = float(resource.get("domainLoadGrowth", 10.0))
	var load_modifier: float = float((record.get("barrier", {}) as Dictionary).get("behavior", {}).get("domainLoadModifier", 1.0))
	actor["domain_state"] = {"id":resolved_id, "active":true, "load":load_base, "threshold":THRESHOLD, "load_growth":load_growth * load_modifier, "outgoing_damage_multiplier":1.25, "incoming_damage_multiplier":0.80, "ce_cost_multiplier":1.10, "stability_pressure":float(resource.get("stabilityPressure", 0.0)), "sure_hit":bool((record.get("sureHit", {}) as Dictionary).get("enabled", false)), "effects":(record.get("effects", []) as Array).duplicate(true), "actions":(record.get("actions", []) as Array).duplicate(true), "opponent_actions":(record.get("opponentActions", []) as Array).duplicate(true)}
	state.actors[actor_index] = actor
	return {"ok":true, "ce_cost":cost, "domain_state":(actor.domain_state as Dictionary).duplicate(true)}

func add_pressure(state: BattleState, target_index: int, amount: float) -> Dictionary:
	if state == null or target_index not in [0, 1]: return {"ok":false, "error":"invalid_state"}
	var target: Dictionary = state.actors[target_index] as Dictionary
	var domain: Dictionary = target.get("domain_state", {}) as Dictionary
	if not bool(domain.get("active", false)): return {"ok":true, "applied":0.0, "ignored":true}
	var before: float = float(domain.get("load", 0.0))
	domain["load"] = clampf(before + maxf(0.0, amount), 0.0, THRESHOLD)
	if float(domain.get("load", 0.0)) >= THRESHOLD:
		return _melt_domain(state, target_index, domain, "pressure_threshold")
	target["domain_state"] = domain
	state.actors[target_index] = target
	return {"ok":true, "applied":float(domain["load"]) - before, "load":float(domain["load"])}

func maintain(state: BattleState, actor_index: int) -> Dictionary:
	if state == null or actor_index not in [0, 1]: return {"ok":false, "error":"invalid_state"}
	var actor: Dictionary = state.actors[actor_index] as Dictionary
	var domain: Dictionary = actor.get("domain_state", {}) as Dictionary
	if bool(domain.get("active", false)):
		var next_load: float = float(domain.get("load", 0.0)) + maxf(0.0, float(domain.get("load_growth", 0.0)))
		if next_load >= THRESHOLD:
			return _melt_domain(state, actor_index, domain, "maintenance_threshold")
		else:
			domain["load"] = next_load
		actor["domain_state"] = domain
		state.actors[actor_index] = actor
		return {"ok":true, "ended":not bool(domain.get("active", false)), "load":float(domain.get("load", 0.0))}
	return {"ok":true, "ended":false, "load":0.0}

func _melt_domain(state: BattleState, actor_index: int, domain: Dictionary, reason: String) -> Dictionary:
	var actor: Dictionary = state.actors[actor_index] as Dictionary
	var ce_loss: float = minf(_actor_number(actor, "ce", 0.0), _actor_number(actor, "max_ce", 0.0) * 0.20)
	actor["ce"] = float(actor.get("ce", 0.0)) - ce_loss
	domain["active"] = false
	domain["load"] = 0.0
	domain["end_reason"] = "domain_meltdown"
	domain["collapsed_this_round"] = true
	var statuses: Dictionary = actor.get("statuses", {}) as Dictionary
	# Maintenance decrements statuses after the current round. Keep two ticks so
	# one full following round remains technique-locked.
	statuses["technique_burnout"] = {"id":"technique_burnout", "rounds":2, "value":1, "source":"domain_meltdown"}
	actor["statuses"] = statuses
	actor["domain_state"] = domain
	state.actors[actor_index] = actor
	state.append_event("domain_meltdown", {"actor_index":actor_index, "reason":reason, "ce_loss":ce_loss})
	return {"ok":true, "ended":true, "collapsed":true, "load":0.0, "end_reason":"domain_meltdown", "ce_loss":ce_loss}

func recover_ce(state: BattleState, actor_index: int) -> Dictionary:
	if state == null or actor_index not in [0, 1]: return {"ok":false, "error":"invalid_state"}
	var actor: Dictionary = state.actors[actor_index] as Dictionary
	var statuses: Dictionary = actor.get("statuses", {}) as Dictionary
	var scale: float = 0.0 if statuses.has("ce_regen_blocked") else maxf(0.0, _actor_number(actor, "ce_regen_multiplier", 1.0))
	var amount: float = maxf(0.0, _actor_number(actor, "ce_regen", 0.0)) * scale
	actor["ce"] = minf(_actor_number(actor, "max_ce", 0.0), _actor_number(actor, "ce", 0.0) + amount)
	state.actors[actor_index] = actor
	return {"ok":true, "amount":amount, "ce":float(actor.get("ce", 0.0))}

func _actor_number(actor: Dictionary, key: String, fallback: float) -> float:
	if actor.has(key): return float(actor.get(key, fallback))
	var profile: Dictionary = actor.get("profile", {}) as Dictionary
	if profile.has(key): return float(profile.get(key, fallback))
	return fallback

func _find_domain(domain_id: String) -> Dictionary:
	for raw: Variant in _data.domains():
		if raw is Dictionary and str((raw as Dictionary).get("id", "")) == domain_id: return (raw as Dictionary)
	return {}

