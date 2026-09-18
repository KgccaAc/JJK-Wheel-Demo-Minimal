class_name BattleResolutionPipeline
extends RefCounted

## 生产战斗的纯计算边界。
## 输入为不可变的卡牌、双方快照与回合上下文；输出为最终 CE 成本和可写入回合包的 trace。
## BattleFlowSession 是唯一调用者。Presenter、Gateway 和 fixture 不得绕过本类直接组合费用规则。

const ActionResolverScript: Script = preload("res://battle/core/CoreActionResolver.gd")
const CostResolverScript: Script = preload("res://battle/core/ActionCostResolver.gd")
const ModifierPipelineScript: Script = preload("res://battle/core/ModifierPipeline.gd")

var _action_resolver: RefCounted = ActionResolverScript.new()
var _cost_resolver: RefCounted = CostResolverScript.new()
var _modifier_pipeline: RefCounted = ModifierPipelineScript.new()

func resolve_cost(card: Dictionary, actor: Dictionary, target: Dictionary, state: Variant, actor_index: int) -> Dictionary:
	var preview: Dictionary = _action_resolver.preview_action_values(card, actor, target, state)
	if not bool(preview.get("ok", false)):
		return preview
	var cost: Dictionary = card.get("cost", {}) as Dictionary
	var base_cost: float = _cost_resolver.resolve_ce_cost(cost, float(actor.get("max_ce", 0.0)))
	var action_values: Dictionary = preview.get("values", {}) as Dictionary
	var final_cost: float = float(action_values.get("ce_cost", base_cost)) if bool(action_values.get("ce_cost_is_resolved", false)) else maxf(base_cost, float(action_values.get("ce_cost", 0.0)))
	var trace: Array[Dictionary] = [{"stage":"cost", "base_ce_cost":base_cost, "action_ce_cost":float(action_values.get("ce_cost", 0.0)), "before":final_cost}]

	# ModifierPipeline owns the neutral baseline and keeps cost trace format consistent with all future modifiers.
	var neutral: Dictionary = _modifier_pipeline.evaluate({"ce_cost":final_cost}, [], [])
	final_cost = float((neutral.get("values", {}) as Dictionary).get("ce_cost", final_cost))
	var strategy: Dictionary = _strategy_for(state, actor_index)
	if _is_technique(card):
		var technique_scale: float = float(strategy.get("technique_cost_multiplier", 1.0))
		final_cost *= technique_scale
		trace.append({"stage":"modifier", "source":"strategy", "field":"ce_cost", "scale":technique_scale})
	if _initiative_winner(state) == actor_index and _initiative_discount_applies(state, actor_index):
		final_cost *= 0.95
		trace.append({"stage":"modifier", "source":"initiative", "field":"ce_cost", "scale":0.95})
	if bool((actor.get("domain_state", {}) as Dictionary).get("active", false)):
		var domain: Dictionary = actor.get("domain_state", {}) as Dictionary
		var domain_profile: Dictionary = domain.get("effect_profile", {}) as Dictionary
		var domain_scale: float = float(domain_profile.get("ce_cost_multiplier", 1.0))
		final_cost *= domain_scale
		trace.append({"stage":"modifier", "source":"domain", "field":"ce_cost", "scale":domain_scale})
	if not trace.any(func(entry: Dictionary) -> bool: return str(entry.get("stage", "")) == "modifier"):
		trace.append({"stage":"modifier", "source":"none", "field":"ce_cost", "scale":1.0})
	for entry: Variant in preview.get("trace", []) as Array:
		if entry is Dictionary:
			var action_entry: Dictionary = (entry as Dictionary).duplicate(true)
			action_entry["stage"] = "action"
			trace.append(action_entry)
	if not trace.any(func(entry: Dictionary) -> bool: return str(entry.get("stage", "")) == "action"):
		trace.append({"stage":"action", "source":"preview", "effect":"base_values"})
	return {"ok":true, "values":action_values, "ce_cost":maxf(0.0, final_cost), "trace":trace}

func _strategy_for(state: Variant, actor_index: int) -> Dictionary:
	var strategies: Array = []
	if state is Dictionary:
		strategies = state.get("strategy_snapshot", []) as Array
	elif state != null and "strategy_snapshot" in state:
		strategies = state.strategy_snapshot as Array
	return strategies[actor_index] as Dictionary if actor_index >= 0 and actor_index < strategies.size() and strategies[actor_index] is Dictionary else {}

func _initiative_winner(state: Variant) -> int:
	if state is Dictionary:
		return int((state.get("initiative", {}) as Dictionary).get("winner_index", -1))
	if state != null and "initiative" in state:
		return int((state.initiative as Dictionary).get("winner_index", -1))
	return -1

func _initiative_commitment(state: Variant, actor_index: int) -> int:
	var initiative: Dictionary = {}
	if state is Dictionary:
		initiative = state.get("initiative", {}) as Dictionary
	elif state != null and "initiative" in state:
		initiative = state.initiative as Dictionary
	if actor_index == 0: return int(initiative.get("left_effective", initiative.get("left", 0)))
	if actor_index == 1: return int(initiative.get("right_effective", initiative.get("right", 0)))
	return 0

func _initiative_discount_applies(state: Variant, actor_index: int) -> bool:
	var initiative: Dictionary = {}
	if state is Dictionary:
		initiative = state.get("initiative", {}) as Dictionary
	elif state != null and "initiative" in state:
		initiative = state.initiative as Dictionary
	# Older preview fixtures only provide winner_index; preserve that contract.
	# Formal states include effective commitments, where a zero-vs-zero tie has
	# no investment and therefore receives no discount.
	var key := "left_effective" if actor_index == 0 else "right_effective"
	return true if not initiative.has(key) else int(initiative.get(key, 0)) > 0

func _is_technique(card: Dictionary) -> bool:
	var type: String = str(card.get("type", "")).to_lower()
	if type in ["technique", "spell", "术式"]:
		return true
	var tags: Array = card.get("tags", []) as Array
	return tags.has("technique") or tags.has("术式") or not str(card.get("sourceTechniqueFamily", "")).is_empty()

