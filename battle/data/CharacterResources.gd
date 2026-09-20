class_name CharacterResources
extends RefCounted

## 将直接角色表的六维评级映射到镜像 resource-rules 的资源公式。
## fixture 自带的显式 hp/ce 始终优先，避免回放时重新推导快照。
const GRADES: Array[String] = ["E", "D", "C", "B", "A", "S", "SS", "SSS", "EX"]
const Repository: Script = preload("res://battle/data/BattleDataRepository.gd")

## 源项目的 createDuelCounterView 会在首次读取时创建这些非零资源。
## Godot 的可用性检查发生在发牌前，因此必须在角色快照创建时完成同样的
## 初始化，不能等待某张牌实际结算后再补值。
const COUNTER_SEEDS: Array[Dictionary] = [
	{
		# 赤血操术的血量是角色入场资源，不能等待第一张术式牌结算后才出现。
		"owner_tags": ["blood_manipulation", "赤血操术"],
		# 源 duel-counter-pipeline：blood/pierce 均以 0 开局，最大值分别为 8/6。
		"counters": {"blood_manipulation": {"blood": 0.0, "pierce": 0.0}},
		"labels": {"blood_manipulation.blood": "血", "blood_manipulation.pierce": "穿"}
	},
	{
		"owner_tags": ["black_rope"],
		"counters": {"black_rope": {"length": 5.0}},
		"labels": {"black_rope.length": "黑绳长度"}
	},
	{
		"owner_tags": ["black_bird_manipulation"],
		"counters": {"black_bird_manipulation": {"feathers": 16.0, "_initial_feathers": 16.0}},
		"labels": {"black_bird_manipulation.feathers": "乌羽"}
	},
	{
		"owner_tags": ["star_rage"],
		"counters": {"star_rage": {"virtual_mass": 1.0, "_base": 1.0, "_round": 1.0, "_auto_progress": 0.0, "_single_card_bonus_round": 0.0}},
		"labels": {"star_rage.virtual_mass": "虚拟质量"}
	},
	{
		"owner_tags": ["projection_sorcery"],
		"counters": {"projection_sorcery": {"projectionFrame": 10.0, "_base": 10.0, "_round": 1.0, "projectionFrameLockUntil": 0.0, "_turn_damage": 0.0, "_turn_damage_round": 0.0, "_settled_round": 0.0, "_overdrive_round": 0.0, "_overdrive_damage_threshold": 200.0, "_overdrive_frame_gain": 3.0}},
		"labels": {"projection_sorcery.projectionFrame": "帧率"}
	}
]

func apply(profile: Dictionary) -> Dictionary:
	var result: Dictionary = profile.duplicate(true)
	var rules: Dictionary = Repository.new().runtime("resource-rules.json")
	var stats: Dictionary = profile.get("stats", {})
	var hp_rule: Dictionary = rules.get("hp", {})
	var ce_rule: Dictionary = rules.get("ce", {})
	var regen_rule: Dictionary = rules.get("regen", {})
	var zero_ce: bool = (profile.get("flags", {}) as Dictionary).get("isZeroCe", false)
	# Match source duel-resource.js: canonical profiles carry numeric raw/axis
	# scores plus visible grade and combat unit. Falling back to rank scores keeps
	# the compact built-in table valid, while custom snapshots retain their source
	# values instead of being visibly underpowered.
	var raw: Dictionary = profile.get("raw", {}) as Dictionary
	var axes: Dictionary = profile.get("axes", {}) as Dictionary
	var body_score: float = _source_score(raw.get("bodyScore", axes.get("body", stats.get("body", "B"))))
	var martial_score: float = _source_score(raw.get("martialScore", axes.get("body", stats.get("martial", "B"))))
	var cursed_energy_score: float = _source_score(raw.get("cursedEnergyScore", profile.get("cursedEnergyScore", stats.get("cursedEnergy", "B"))))
	var control_score: float = _source_score(raw.get("controlScore", stats.get("control", "B")))
	var efficiency_score: float = _source_score(raw.get("efficiencyScore", stats.get("efficiency", "B")))
	var talent_score: float = _source_score(raw.get("talentScore", axes.get("insight", stats.get("talent", "B"))))
	var visible_rank: float = _visible_grade_score(profile)
	var combat_unit: float = float((profile.get("combatPowerUnit", {}) as Dictionary).get("value", 0.0))
	var hp: float = float(hp_rule.get("base", 118.0)) + body_score * float(hp_rule.get("bodyScale", 15.5)) + martial_score * float(hp_rule.get("martialScale", 10.5)) + visible_rank * float(hp_rule.get("visibleGradeScale", 18.0)) + sqrt(maxf(combat_unit, 0.0)) * float(hp_rule.get("combatUnitScale", 0.012))
	if zero_ce: hp += float(hp_rule.get("zeroCeBodyBonus", 22.0))
	hp = roundf(clampf(hp, float(hp_rule.get("min", 80.0)), float(hp_rule.get("max", 460.0))))
	var ce: float = float(ce_rule.get("base", 82.0)) + cursed_energy_score * float(ce_rule.get("cursedEnergyScale", 20.0)) + score(profile.get("techniquePower", "B")) * float(ce_rule.get("techniqueScale", 9.0)) + visible_rank * float(ce_rule.get("visibleGradeScale", 22.0)) + float(axes.get("jujutsu", 0.0)) * float(ce_rule.get("jujutsuAxisScale", 7.5))
	ce = 0.0 if zero_ce else roundf(clampf(ce, float(ce_rule.get("min", 36.0)), float(ce_rule.get("max", 560.0))))
	var ratio: float = float(regen_rule.get("baseRatio", 0.04)) + control_score * float(regen_rule.get("controlScale", 0.0025)) + efficiency_score * float(regen_rule.get("efficiencyScale", 0.0035)) + talent_score * float(regen_rule.get("talentScale", 0.0015))
	ratio = clampf(ratio, float(regen_rule.get("minRatio", 0.025)), float(regen_rule.get("maxRatio", 0.12)))
	result["max_hp"] = float(profile.get("max_hp", profile.get("hp", hp)))
	result["hp"] = float(profile.get("hp", result.max_hp))
	result["max_ce"] = float(profile.get("max_ce", profile.get("ce", ce)))
	result["ce"] = float(profile.get("ce", result.max_ce))
	result["ce_regen"] = float(profile.get("ce_regen", snappedf(float(result.max_ce) * ratio, 0.1)))
	# 这些资源不是卡牌效果临时创建的计数器，而是角色进入战斗时就应
	# 存在的装备/术式存量。键名与源项目 duel-counter-pipeline.js 保持一致。
	result["initial_counters"] = _initial_counters(profile)
	result["initial_counter_labels"] = _initial_counter_labels(profile)
	return result

func _initial_counters(profile: Dictionary) -> Dictionary:
	var counters: Dictionary = (profile.get("initial_counters", {}) as Dictionary).duplicate(true)
	for seed: Dictionary in _matching_counter_seeds(profile):
		_merge_missing_counter_values(counters, seed.get("counters", {}) as Dictionary)
	return counters

func _initial_counter_labels(profile: Dictionary) -> Dictionary:
	var labels: Dictionary = (profile.get("initial_counter_labels", {}) as Dictionary).duplicate(true)
	for seed: Dictionary in _matching_counter_seeds(profile):
		for raw_id: Variant in (seed.get("labels", {}) as Dictionary):
			var id: String = str(raw_id)
			if not labels.has(id): labels[id] = str((seed.get("labels", {}) as Dictionary).get(raw_id, id))
	return labels

func _matching_counter_seeds(profile: Dictionary) -> Array[Dictionary]:
	var tags: Dictionary = {}
	for key: String in ["id", "characterId"]:
		var value: String = str(profile.get(key, "")).strip_edges().to_lower()
		if not value.is_empty(): tags[value] = true
	for key: String in ["traits", "cardTags", "techniqueFamilies", "specialHandTags"]:
		for raw_tag: Variant in profile.get(key, []) as Array:
			var tag: String = str(raw_tag).strip_edges().to_lower()
			if not tag.is_empty(): tags[tag] = true
	var matches: Array[Dictionary] = []
	for seed: Dictionary in COUNTER_SEEDS:
		for raw_tag: Variant in seed.get("owner_tags", []) as Array:
			if tags.has(str(raw_tag).to_lower()):
				matches.append(seed)
				break
	return matches

func _merge_missing_counter_values(destination: Dictionary, additions: Dictionary) -> void:
	for raw_namespace: Variant in additions:
		var namespace_id: String = str(raw_namespace)
		var source_values: Dictionary = additions.get(raw_namespace, {}) as Dictionary
		var current_values: Dictionary = destination.get(namespace_id, {}) as Dictionary
		for raw_counter_id: Variant in source_values:
			var counter_id: String = str(raw_counter_id)
			if not current_values.has(counter_id): current_values[counter_id] = source_values.get(raw_counter_id)
		destination[namespace_id] = current_values

static func score(value: Variant) -> float:
	if value is float or value is int: return maxf(0.0, float(value))
	var grade: String = str(value).to_upper()
	var rank: int = GRADES.find(grade.trim_suffix("+").trim_suffix("-"))
	if rank < 0: return 0.0
	return maxf(0.0, float(rank + 1) + (0.25 if grade.ends_with("+") else -0.25 if grade.ends_with("-") else 0.0))

static func _source_score(value: Variant) -> float:
	if value is float or value is int: return maxf(0.0, float(value))
	return score(value)

static func _visible_grade_score(profile: Dictionary) -> float:
	var known: Dictionary = {"support":0.0, "grade4":1.0, "grade3":2.0, "grade2":3.0, "semigrade1":3.5, "grade1":4.0, "semispecialgrade1":4.5, "specialgradelow":5.5, "specialgrade":6.0, "specialgradehigh":6.5, "specialgradecurse":5.5, "canonceiling":6.5, "postcanonceiling":6.5, "postcanonexception":6.5}
	for raw_value: Variant in [profile.get("visibleGrade", ""), profile.get("officialGrade", ""), profile.get("grade", ""), profile.get("powerTier", "")]:
		var value: String = str(raw_value).strip_edges().to_lower().replace("_", "")
		if known.has(value): return float(known[value])
		if value.contains("特级") or value.contains("specialgrade"): return 6.0
		if value.contains("一级") or value.contains("grade1"): return 4.0
		if value.contains("二级") or value.contains("grade2"): return 3.0
		if value.contains("三级") or value.contains("grade3"): return 2.0
		if value.contains("四级") or value.contains("grade4"): return 1.0
	return 0.0

