class_name RoundResolverV3
extends RefCounted

const StateScript: Script = preload("res://battle/rules/BattleState.gd")
const ActionResolverScript: Script = preload("res://battle/v3/ActionResolverV3.gd")
const DomainRuntimeScript: Script = preload("res://battle/v3/DomainRuntimeV3.gd")

var _action_resolver: ActionResolverV3 = ActionResolverScript.new()

## 双方输入必须基于同一 checkpoint；顺序由调用方传入，通常先手在前。
func resolve_round(before_state: BattleState, intents: Array[ActionIntentV3], order: Array[int] = [0, 1]) -> Dictionary:
	if before_state == null or intents.size() != 2: return {"ok":false, "error":"round_inputs_required"}
	var checkpoint: Dictionary = before_state.canonical_snapshot()
	var working: BattleState = StateScript.new()
	working.restore_canonical_snapshot(checkpoint)
	var actions: Array[Dictionary] = []
	var domain_runtime: RefCounted = DomainRuntimeScript.new()
	for actor_index: int in order:
		if actor_index < 0 or actor_index >= intents.size(): return {"ok":false, "error":"invalid_order"}
		var intent: ActionIntentV3 = intents[actor_index]
		intent.actor_index = actor_index
		if float((working.actors[actor_index] as Dictionary).get("hp", 0.0)) <= 0.0:
			actions.append({"actor_index":actor_index, "ok":false, "cancelled_reason":"defeated"})
			continue
		# 一个角色的领域与卡牌属于同一原子输入：任一部分拒绝，整个输入回到
		# 该角色结算前，而不留下“领域已扣费、牌却未出”的半提交状态。
		var actor_checkpoint: Dictionary = working.canonical_snapshot()
		var domain_result: Dictionary = _resolve_domain_selection(working, intent)
		if not bool(domain_result.get("ok", false)):
			actions.append({"actor_index":actor_index, "ok":false, "cancelled_reason":str(domain_result.get("error", "domain_rejected"))})
			continue
		var action_result: Dictionary = _action_resolver.resolve_action(working, intent, &"commit")
		if not bool(action_result.get("ok", false)):
			working.restore_canonical_snapshot(actor_checkpoint)
			actions.append({"actor_index":actor_index, "ok":false, "cancelled_reason":str(action_result.get("error", "rejected"))})
			continue
		working.restore_canonical_snapshot(action_result.get("after_state", {}) as Dictionary)
		actions.append({"actor_index":actor_index, "ok":true, "domain":domain_result, "result":action_result})
	for side: int in 2:
		domain_runtime.call("maintain", working, side)
		domain_runtime.call("recover_ce", working, side)
		_maintain_statuses(working, side)
		# Delayed DSL effects become active only for the next playable round. They
		# are deliberately advanced at one central maintenance point rather than
		# by individual cards or UI queries.
		var maintained_actor: Dictionary = working.actors[side] as Dictionary
		_action_resolver._dsl.advance_timed_effects(maintained_actor, working.round + 1)
		working.actors[side] = maintained_actor
	var left: Dictionary = working.actors[0] as Dictionary
	var right: Dictionary = working.actors[1] as Dictionary
	var finished: bool = float(left.get("hp", 0.0)) <= 0.0 or float(right.get("hp", 0.0)) <= 0.0
	if finished:
		working.finished = true
		working.winner = "draw" if float(left.get("hp", 0.0)) <= 0.0 and float(right.get("hp", 0.0)) <= 0.0 else "right" if float(left.get("hp", 0.0)) <= 0.0 else "left"
		working.finish_reason = "hp_zero"
	else:
		working.round += 1
	working.phase = &"FINISHED" if finished else &"DEAL"
	var after: Dictionary = working.canonical_snapshot()
	if not before_state.finished: before_state.restore_canonical_snapshot(after)
	return {"ok":true, "ruleset_version":"battle-rules-v3", "round":int(checkpoint.get("round", 1)), "actions":actions, "before_state_hash":str(checkpoint.get("state_hash", "")), "after_state":after, "after_state_hash":str(after.get("state_hash", ""))}

func _resolve_domain_selection(state: BattleState, intent: ActionIntentV3) -> Dictionary:
	if intent.domain_instance_ids.is_empty(): return {"ok":true, "activated":false}
	if intent.domain_instance_ids.size() != 1: return {"ok":false, "error":"domain_play_limit_exceeded"}
	var actor: Dictionary = state.actors[intent.actor_index] as Dictionary
	var zones: Dictionary = actor.get("zones", {}) as Dictionary
	var selected_id: String = str(intent.domain_instance_ids[0])
	var selected: Dictionary = {}
	for raw_card: Variant in zones.get("domain", []) as Array:
		if raw_card is Dictionary and str((raw_card as Dictionary).get("instance_id", "")) == selected_id:
			selected = (raw_card as Dictionary).duplicate(true)
			break
	if selected.is_empty(): return {"ok":false, "error":"domain_card_not_available"}
	var result: Dictionary = DomainRuntimeScript.new().activate(state, intent.actor_index)
	if not bool(result.get("ok", false)): return result
	zones["domain"] = (zones.get("domain", []) as Array).filter(func(card: Dictionary) -> bool: return str(card.get("instance_id", "")) != selected_id)
	(zones.get("discard", []) as Array).append(selected)
	actor["zones"] = zones
	state.actors[intent.actor_index] = actor
	result["activated"] = true
	result["instance_id"] = selected_id
	return result

func _maintain_statuses(state: BattleState, side: int) -> void:
	var actor: Dictionary = state.actors[side] as Dictionary
	var statuses: Dictionary = actor.get("statuses", {}) as Dictionary
	for key: Variant in statuses.keys():
		if not statuses[key] is Dictionary: continue
		var status: Dictionary = statuses[key] as Dictionary
		if not status.has("rounds") or int(status.get("rounds", -1)) < 0: continue
		status["rounds"] = int(status.get("rounds", 0)) - 1
		if int(status["rounds"]) <= 0: statuses.erase(key)
	actor["statuses"] = statuses
	state.actors[side] = actor

