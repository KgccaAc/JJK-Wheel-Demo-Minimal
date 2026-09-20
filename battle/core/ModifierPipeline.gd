class_name ModifierPipeline
extends RefCounted

## 无状态的修正聚合器，返回值与可解释 trace 必须一起消费。
## 不读取 BattleState，也不提交资源；生产费用路径由 BattleResolutionPipeline 统一调用。
func evaluate(base_values: Dictionary, source_modifiers: Array, target_modifiers: Array) -> Dictionary:
	var values: Dictionary = {
		"damage": float(base_values.get("damage", 0.0)),
		"ce_damage": float(base_values.get("ce_damage", 0.0)),
		"ce_cost": float(base_values.get("ce_cost", 0.0)),
		"domain_load_delta": float(base_values.get("domain_load_delta", 0.0)),
		"stability_delta": float(base_values.get("stability_delta", 0.0)),
		"weight": float(base_values.get("weight", 0.0)),
		"weight_deltas": {}
	}
	var trace: Array[Dictionary] = []
	for raw_modifier: Variant in source_modifiers:
		if raw_modifier is Dictionary:
			_apply_source_effects(values, trace, raw_modifier as Dictionary)
	for raw_modifier: Variant in target_modifiers:
		if raw_modifier is Dictionary:
			_apply_target_effects(values, trace, raw_modifier as Dictionary)
	return {"values": values, "trace": trace}

func _apply_source_effects(values: Dictionary, trace: Array[Dictionary], modifier: Dictionary) -> void:
	var source: String = str(modifier.get("source", "unknown"))
	var effects: Dictionary = modifier.get("effects", {}) as Dictionary
	_apply_scale(values, trace, source, "damage", float(effects.get("outgoingScale", 1.0)))
	_apply_scale(values, trace, source, "ce_cost", float(effects.get("ceCostScale", 1.0)))
	_apply_add(values, trace, source, "domain_load_delta", float(effects.get("domainLoadDelta", 0.0)))
	_apply_add(values, trace, source, "stability_delta", float(effects.get("stabilityDelta", 0.0)))
	var weights: Dictionary = effects.get("weightDeltas", {}) as Dictionary
	var accumulated: Dictionary = values.get("weight_deltas", {}) as Dictionary
	for key: String in weights.keys():
		var delta: float = float(weights.get(key, 0.0))
		accumulated[key] = float(accumulated.get(key, 0.0)) + delta
		trace.append({"source": source, "field": "weight_deltas." + key, "operation": "add", "value": delta})
	values["weight_deltas"] = accumulated

func _apply_target_effects(values: Dictionary, trace: Array[Dictionary], modifier: Dictionary) -> void:
	var source: String = str(modifier.get("source", "unknown"))
	var effects: Dictionary = modifier.get("effects", {}) as Dictionary
	_apply_scale(values, trace, source, "damage", float(effects.get("incomingHpScale", 1.0)))
	_apply_scale(values, trace, source, "ce_damage", float(effects.get("incomingCeScale", 1.0)))

func _apply_scale(values: Dictionary, trace: Array[Dictionary], source: String, field: String, scale: float) -> void:
	if is_equal_approx(scale, 1.0):
		return
	var before: float = float(values.get(field, 0.0))
	values[field] = before * scale
	trace.append({"source": source, "field": field, "operation": "scale", "before": before, "value": scale, "after": values[field]})

func _apply_add(values: Dictionary, trace: Array[Dictionary], source: String, field: String, delta: float) -> void:
	if is_zero_approx(delta):
		return
	var before: float = float(values.get(field, 0.0))
	values[field] = before + delta
	trace.append({"source": source, "field": field, "operation": "add", "before": before, "value": delta, "after": values[field]})

