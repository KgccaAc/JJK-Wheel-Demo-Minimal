class_name BattleRulesV3
extends RefCounted

## battle-rules-v3 的无状态规则表。
## 角色只在进入战斗时派生一次 CombatantStats，动作解析器不再重复解释评级。
## A 是七维中性基准，相邻评级的 delta 固定相差 0.4。这里不提前截断，
## 每个效果通道通过自己的 minimum/maximum 控制最终倍率，保留高评级差异。

const RULESET_VERSION: StringName = &"battle-rules-v3"
const RANK_SCORES: Dictionary = {
	"E-": 0.0, "E": 1.0, "D": 2.0, "C": 3.0, "B": 4.0,
	"A": 5.0, "S": 6.0, "SS": 7.0, "SSS": 8.0, "EX-": 9.0, "EX": 10.0
}
const BASE_HP: float = 260.0
const BASE_CE: float = 240.0
const BASE_REGEN: float = 18.0
const BASE_DEFENSE: float = 20.0
const NEUTRAL_RANK_SCORE: float = 5.0
const DELTA_PER_RANK: float = 0.4

func rank_score(value: Variant) -> float:
	if value is int or value is float:
		return float(value)
	var rank: String = str(value).strip_edges().to_upper()
	return float(RANK_SCORES.get(rank, RANK_SCORES["S"]))

func rank_delta(value: Variant) -> float:
	return (rank_score(value) - NEUTRAL_RANK_SCORE) * DELTA_PER_RANK

func dimension_deltas(profile: Dictionary) -> Dictionary:
	var stats: Dictionary = profile.get("stats", {}) as Dictionary
	var axes: Dictionary = profile.get("axes", {}) as Dictionary
	var raw: Dictionary = profile.get("raw", {}) as Dictionary
	return {
		"body": _delta_from_sources(profile, stats, axes, raw, "body", ["bodyScore", "body"]),
		"martial": _delta_from_sources(profile, stats, axes, raw, "martial", ["martialScore", "martial"]),
		"technique": _delta_from_sources(profile, stats, axes, raw, "technique", ["techniqueScore", "technique"]),
		"cursed_energy": _delta_from_sources(profile, stats, axes, raw, "cursed_energy", ["cursedEnergyScore", "cursedEnergy"]),
		"control": _delta_from_sources(profile, stats, axes, raw, "control", ["controlScore", "control"]),
		"efficiency": _delta_from_sources(profile, stats, axes, raw, "efficiency", ["efficiencyScore", "efficiency"]),
		"talent": _delta_from_sources(profile, stats, axes, raw, "talent", ["talentScore", "talent"])
	}

func derive_combatant_stats(profile: Dictionary) -> Dictionary:
	var deltas: Dictionary = dimension_deltas(profile)
	var derived_hp: float = BASE_HP + float(deltas.body) * 42.0 + float(deltas.martial) * 28.0 + float(deltas.talent) * 12.0
	var derived_ce: float = BASE_CE + float(deltas.cursed_energy) * 110.0 + float(deltas.technique) * 70.0 + float(deltas.control) * 25.0
	var derived_regen: float = BASE_REGEN + float(deltas.efficiency) * 16.0 + float(deltas.control) * 10.0 + float(deltas.talent) * 6.0
	var derived_defense: float = BASE_DEFENSE + float(deltas.body) * 22.0 + float(deltas.martial) * 12.0
	var explicit_max_hp: float = float(profile.get("max_hp", profile.get("hp", derived_hp)))
	var explicit_max_ce: float = float(profile.get("max_ce", profile.get("ce", derived_ce)))
	var explicit_regen: float = float(profile.get("ce_regen", derived_regen))
	var zero_ce: bool = bool((profile.get("flags", {}) as Dictionary).get("isZeroCe", false))
	var max_ce: float = 0.0 if zero_ce else maxf(0.0, explicit_max_ce)
	var ce: float = clampf(float(profile.get("ce", max_ce)), 0.0, max_ce)
	return {
		"max_hp": maxf(1.0, explicit_max_hp),
		"hp": clampf(float(profile.get("hp", explicit_max_hp)), 0.0, maxf(1.0, explicit_max_hp)),
		"max_ce": max_ce,
		"ce": ce,
		"ce_regen": maxf(0.0, explicit_regen),
		"stability": clampf(float(profile.get("stability", 100.0)), 0.0, 100.0),
		"defense": maxf(0.0, float(profile.get("defense", derived_defense))),
		"guard": maxf(0.0, float(profile.get("guard", 0.0))),
		"outgoing_damage_multiplier": maxf(0.0, float(profile.get("outgoing_damage_multiplier", 1.0))),
		"incoming_damage_multiplier": maxf(0.0, float(profile.get("incoming_damage_multiplier", 1.0))),
		"damage_resistance": clampf(float(profile.get("damage_resistance", 0.0)), 0.0, 0.95),
		"accuracy_bonus": float(profile.get("accuracy_bonus", 0.0)),
		"evasion_bonus": float(profile.get("evasion_bonus", 0.0)),
		"ce_cost_multiplier": maxf(0.0, float(profile.get("ce_cost_multiplier", 1.0))),
		"ce_regen_multiplier": maxf(0.0, float(profile.get("ce_regen_multiplier", 1.0))),
		"domain_state": (profile.get("domain_state", {}) as Dictionary).duplicate(true),
		"dimension_deltas": deltas.duplicate(true)
	}

func channel_multiplier(weights: Dictionary, deltas: Dictionary, minimum: float = 0.0, maximum: float = 3.0) -> float:
	var result: float = 1.0
	for dimension: Variant in weights.keys():
		result += float(weights.get(dimension, 0.0)) * float(deltas.get(str(dimension), 0.0))
	return clampf(result, minimum, maximum)

func _delta_from_sources(profile: Dictionary, stats: Dictionary, axes: Dictionary, raw: Dictionary, key: String, raw_keys: Array[String]) -> float:
	for raw_key: String in raw_keys:
		if raw.has(raw_key): return rank_delta(raw.get(raw_key))
	if stats.has(key): return rank_delta(stats.get(key))
	if axes.has(key): return rank_delta(axes.get(key))
	if key == "cursed_energy" and profile.has("cursedEnergyScore"): return rank_delta(profile.get("cursedEnergyScore"))
	return 0.0

