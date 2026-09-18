class_name DomainRuntime
extends RefCounted

const DataRepositoryScript: Script = preload("res://battle/data/BattleDataRepository.gd")
const DOMAIN_LOAD_THRESHOLD: float = 58.0

var _data: RefCounted = DataRepositoryScript.new()

func activate(state: Variant, actor_index: int) -> Dictionary:
	if state == null:
		return {"ok": false, "error": "missing_state"}
	if bool(state.finished):
		return {"ok": false, "error": "battle_finished"}
	if actor_index < 0 or actor_index >= (state.actors as Array).size():
		return {"ok": false, "error": "invalid_actor"}
	var actor: Dictionary = state.actors[actor_index] as Dictionary
	var current_state: Dictionary = actor.get("domain_state", {}) as Dictionary
	if bool(current_state.get("active", false)):
		return {"ok": false, "error": "domain_already_active"}
	var profile: Dictionary = actor.get("profile", {}) as Dictionary
	var domain_id: String = _resolve_domain_id(profile)
	if domain_id.is_empty():
		return {"ok": false, "error": "domain_not_available"}
	var definition: Dictionary = _find_definition(domain_id)
	if definition.is_empty():
		return {"ok": false, "error": "domain_definition_missing"}
	var resource: Dictionary = definition.get("resource", {}) as Dictionary
	var ce_cost: float = maxf(0.0, float(actor.get("max_ce", 0.0)) * float(resource.get("ceCostRatio", 0.0)))
	# 领域策略的费用修正由战斗状态读取，领域运行时不依赖 UI 节点。
	var strategy_multiplier: float = _strategy_multiplier(state, actor_index, "domain_cost_multiplier")
	ce_cost *= strategy_multiplier
	if float(actor.get("ce", 0.0)) < ce_cost:
		return {"ok": false, "error": "insufficient_ce", "required": ce_cost, "available": float(actor.get("ce", 0.0))}
	var barrier: Dictionary = definition.get("barrier", {}) as Dictionary
	var sure_hit: Dictionary = definition.get("sureHit", {}) as Dictionary
	actor["ce"] = float(actor.get("ce", 0.0)) - ce_cost
	actor["domain_state"] = {
		"id": domain_id,
		"name": str(definition.get("name", domain_id)),
		"active": true,
		"owner_index": actor_index,
		"load": float(resource.get("domainLoadBase", 0.0)),
		"threshold": DOMAIN_LOAD_THRESHOLD,
		"load_growth": float(resource.get("domainLoadGrowth", 0.0)),
		"stability_pressure": float(resource.get("stabilityPressure", 0.0)),
		"barrier_type": str(barrier.get("type", "")),
		"sure_hit_enabled": bool(sure_hit.get("enabled", false)),
		"sure_hit_type": str(sure_hit.get("type", "")),
		"effect_profile": {
			"outgoing_damage_multiplier": 1.5,
			"incoming_damage_multiplier": 0.8,
			"ce_cost_multiplier": 1.1
		},
		"counterplay": (definition.get("counterplay", []) as Array).duplicate(),
		"end_reason": ""
	}
	state.actors[actor_index] = actor
	state.revision = int(state.revision) + 1
	state.append_event("domain_activated", {"actor_index": actor_index, "domain_id": domain_id, "ce_cost": ce_cost, "strategy_cost_multiplier":strategy_multiplier})
	return {"ok": true, "domain_state": actor.get("domain_state", {})}

func maintain(state: Variant, actor_index: int) -> Dictionary:
	if state == null:
		return {"ok": false, "error": "missing_state"}
	if actor_index < 0 or actor_index >= (state.actors as Array).size():
		return {"ok": false, "error": "invalid_actor"}
	var actor: Dictionary = state.actors[actor_index] as Dictionary
	var domain_state: Dictionary = actor.get("domain_state", {}) as Dictionary
	if not bool(domain_state.get("active", false)):
		return {"ok": false, "error": "domain_not_active"}
	var growth: float = maxf(0.0, float(domain_state.get("load_growth", 0.0)))
	var load: float = float(domain_state.get("load", 0.0)) + growth
	var threshold: float = maxf(1.0, float(domain_state.get("threshold", DOMAIN_LOAD_THRESHOLD)))
	domain_state["load"] = minf(load, threshold)
	if load < threshold:
		domain_state["turns_active"] = int(domain_state.get("turns_active", 0)) + 1
		actor["domain_state"] = domain_state
		state.actors[actor_index] = actor
		state.append_event("domain_maintained", {"actor_index": actor_index, "load": domain_state["load"], "growth": growth})
		return {"ok": true, "ended": false, "load": domain_state["load"], "domain_state": domain_state.duplicate(true)}
	var ce_loss: float = minf(float(actor.get("ce", 0.0)), maxf(8.0, float(actor.get("max_ce", 0.0)) * 0.28))
	actor["ce"] = float(actor.get("ce", 0.0)) - ce_loss
	domain_state["active"] = false
	domain_state["end_reason"] = "domainMeltdown"
	actor["domain_state"] = domain_state
	var statuses: Dictionary = actor.get("statuses", {}) as Dictionary
	statuses["techniqueImbalance"] = {"id":"techniqueImbalance", "label":"术式失衡", "rounds":2, "value":1}
	statuses["techniqueBurnout"] = {"id":"techniqueBurnout", "label":"术式烧断", "rounds":2, "value":1}
	statuses["ceRegenBlocked"] = {"id":"ceRegenBlocked", "label":"咒力回流断裂", "rounds":1, "value":1}
	actor["statuses"] = statuses
	state.actors[actor_index] = actor
	state.append_event("domain_meltdown", {"actor_index": actor_index, "end_reason":"domainMeltdown", "ce_loss":ce_loss, "load":threshold})
	return {"ok": true, "ended": true, "end_reason":"domainMeltdown", "load":threshold, "ce_loss":ce_loss, "domain_state":domain_state.duplicate(true)}

func clash(state: Variant, actor_index: int) -> Dictionary:
	if state == null or actor_index < 0 or actor_index >= (state.actors as Array).size():
		return {"ok": false, "error": "invalid_state"}
	var opponent_index: int = 1 - actor_index
	var actor: Dictionary = state.actors[actor_index] as Dictionary
	var opponent: Dictionary = state.actors[opponent_index] as Dictionary
	var own_domain: Dictionary = actor.get("domain_state", {}) as Dictionary
	var opponent_domain: Dictionary = opponent.get("domain_state", {}) as Dictionary
	if not bool(own_domain.get("active", false)) or not bool(opponent_domain.get("active", false)):
		return {"ok": false, "error": "opponent_domain_not_active"}
	var ce_cost: float = maxf(28.0, float(actor.get("max_ce", 0.0)) * 0.14)
	if float(actor.get("ce", 0.0)) < ce_cost:
		return {"ok": false, "error": "insufficient_ce", "required": ce_cost}
	actor["ce"] = float(actor.get("ce", 0.0)) - ce_cost
	own_domain["load"] = minf(float(own_domain.get("load", 0.0)) + 8.0, DOMAIN_LOAD_THRESHOLD)
	opponent_domain["load"] = minf(float(opponent_domain.get("load", 0.0)) + 16.0, DOMAIN_LOAD_THRESHOLD)
	opponent_domain["sure_hit_scale"] = 0.46
	opponent_domain["pressure_scale"] = 0.72
	opponent_domain["clash_weakened"] = true
	actor["domain_state"] = own_domain
	opponent["domain_state"] = opponent_domain
	state.actors[actor_index] = actor
	state.actors[opponent_index] = opponent
	state.append_event("domain_clash", {"actor_index": actor_index, "opponent_index": opponent_index, "ce_cost": ce_cost, "self_load": 8.0, "opponent_load": 16.0, "sure_hit_scale": 0.46, "pressure_scale": 0.72})
	return {"ok": true, "ce_cost": ce_cost, "domain_state": own_domain.duplicate(true), "opponent_domain_state": opponent_domain.duplicate(true)}

func _find_definition(domain_id: String) -> Dictionary:
	var domains: Array = (_data.call("load_json", "domains.json") as Dictionary).get("domains", []) as Array
	for raw_domain: Variant in domains:
		if raw_domain is Dictionary and str((raw_domain as Dictionary).get("id", "")) == domain_id:
			return (raw_domain as Dictionary).duplicate(true)
	return {}

func _resolve_domain_id(profile: Dictionary) -> String:
	var explicit_id: String = str(profile.get("domainId", ""))
	if not explicit_id.is_empty(): return explicit_id
	if not bool((profile.get("flags", {}) as Dictionary).get("hasDomainAccess", false)):
		return ""
	var character_id: String = str(profile.get("id", ""))
	for raw_domain: Variant in (_data.call("domains") as Array):
		if raw_domain is Dictionary and str((raw_domain as Dictionary).get("ownerId", "")) == character_id:
			return str((raw_domain as Dictionary).get("id", ""))
	return ""

func _strategy_multiplier(state: Variant, actor_index: int, field: String) -> float:
	if state == null or not "strategy_snapshot" in state:
		return 1.0
	var strategies: Array = state.strategy_snapshot as Array
	if actor_index < 0 or actor_index >= strategies.size() or not strategies[actor_index] is Dictionary:
		return 1.0
	return maxf(0.0, float((strategies[actor_index] as Dictionary).get(field, 1.0)))

