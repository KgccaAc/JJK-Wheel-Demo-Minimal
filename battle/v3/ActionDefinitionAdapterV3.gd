class_name ActionDefinitionAdapterV3
extends RefCounted

## 将现有卡牌 JSON 转换为 V3 单一动作定义。
## 旧字段只在这里解释一次，生产 resolver 不再直接读取旧 scaling 字段。

static func from_card(card: Dictionary) -> ActionDefinitionV3:
	var definition: ActionDefinitionV3 = ActionDefinitionV3.new()
	definition.id = str(card.get("action_id", card.get("actionId", card.get("id", ""))))
	definition.category = _category(card)
	definition.cost = (card.get("cost", {}) as Dictionary).duplicate(true)
	var effect: Dictionary = card.get("effect", {}) as Dictionary
	definition.base_values = {
		"damage": float(effect.get("damage", card.get("attack", 0.0))),
		"ce_damage": float(effect.get("ceDamage", 0.0)),
		"stability_damage": float(effect.get("stabilityDamage", 0.0)),
		"healing": float(effect.get("healing", 0.0)),
		"guard": float(effect.get("block", effect.get("guard", 0.0))),
		"shield": float(effect.get("shield", 0.0)),
		"domain_load": float(effect.get("domainLoad", 0.0)),
		"domain_pressure": float(effect.get("domainPressure", 0.0)),
		"damage_type": str(effect.get("damageType", card.get("damageType", "standard")))
	}
	definition.scaling_profile = _scaling_profile(card.get("scaling", {}))
	definition.accuracy_profile = (card.get("accuracy", {}) as Dictionary).duplicate(true)
	definition.target_policy = (effect.get("target", {}) as Dictionary).duplicate(true) if effect.get("target", {}) is Dictionary else {}
	definition.dsl_effects = _atomic_effects(effect)
	definition.tags = (card.get("tags", []) as Array).duplicate(true)
	return definition

static func _scaling_profile(raw_value: Variant) -> Dictionary:
	var raw: Dictionary = raw_value as Dictionary if raw_value is Dictionary else {}
	if raw.is_empty(): return {}
	var damage_weights: Dictionary = {}
	for pair: Array in [
		["body", "bodyDamagePerRank"], ["martial", "martialDamagePerRank"],
		["technique", "techniqueDamagePerRank"], ["cursed_energy", "cursedEnergyDamagePerRank"],
		["control", "controlDamagePerRank"], ["efficiency", "efficiencyDamagePerRank"],
		["talent", "talentDamagePerRank"]
	]:
		if raw.has(pair[1]): damage_weights[pair[0]] = float(raw.get(pair[1], 0.0))
	var damage_channel: Dictionary = {"weights": damage_weights}
	var result: Dictionary = {"damage": damage_channel}
	for channel_pair: Array in [["healing", "talentHealingPerRank"], ["guard", "talentBlockPerRank"], ["ce_damage", "ceDamageControlPerRank"], ["stability_damage", "stabilityDamageControlPerRank"], ["domain_load", "domainLoadEfficiencyPerRank"], ["domain_pressure", "domainPressureControlPerRank"]]:
		var weights: Dictionary = {}
		if raw.has(channel_pair[1]):
			var dimension: String = "talent" if str(channel_pair[0]) in ["healing", "guard"] else "control" if str(channel_pair[0]) in ["ce_damage", "stability_damage", "domain_pressure"] else "efficiency"
			weights[dimension] = float(raw.get(channel_pair[1], 0.0))
		result[str(channel_pair[0])] = {"weights": weights}
	if raw.has("sourceDamageMin"): damage_channel["minimum"] = float(raw.get("sourceDamageMin", 0.0))
	if raw.has("sourceDamageMax"): damage_channel["maximum"] = float(raw.get("sourceDamageMax", 3.0))
	for field: String in ["baseDamageMultiplier", "highCeThreshold", "highCeDamageMultiplier", "efficiencyCostPerRank", "efficiencyCostMin", "efficiencyCostMax", "controlAccuracyBase", "controlAccuracyPerRank", "martialEvasionPerRank", "accuracyMin", "accuracyMax", "bodyResistanceBase", "bodyResistancePerRank", "bodyResistanceMin", "bodyResistanceMax"]:
		if raw.has(field): result[field] = raw[field]
	return result

static func _atomic_effects(effect: Dictionary) -> Array:
	var special: Dictionary = effect.get("special", {}) as Dictionary if effect.get("special", {}) is Dictionary else {}
	var raw: Variant = special.get("atomicEffects", [])
	if raw is Array: return (raw as Array).duplicate(true)
	if raw is Dictionary: return [raw]
	return []

static func _category(card: Dictionary) -> String:
	var type: String = str(card.get("type", "basic")).to_lower()
	if type in ["technique", "spell", "术式"]: return "technique"
	if type in ["domain", "领域"]: return "domain"
	return "basic"

