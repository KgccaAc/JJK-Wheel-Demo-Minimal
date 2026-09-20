class_name DefenseResolverV3
extends RefCounted

## 只计算吸收结果，不修改传入对象。

func resolve(target: Dictionary, incoming_damage: float, block_ignore_ratio: float = 0.0) -> Dictionary:
	var damage: float = maxf(0.0, incoming_damage)
	var ignore: float = clampf(block_ignore_ratio, 0.0, 1.0)
	var defense: float = maxf(0.0, float(target.get("defense", 0.0)))
	var defense_multiplier: float = 100.0 / (100.0 + defense)
	var post_defense: float = damage * defense_multiplier
	var guard_before: float = maxf(0.0, float(target.get("guard", 0.0)))
	var guard_available: float = guard_before * (1.0 - ignore)
	var guard_absorbed: float = minf(guard_available, post_defense)
	var shield_before: float = maxf(0.0, float(target.get("shield", 0.0)))
	var shield_absorbed: float = minf(shield_before, post_defense - guard_absorbed)
	var hp_damage: float = maxf(0.0, post_defense - guard_absorbed - shield_absorbed)
	return {
		"incoming_damage": damage,
		"defense_multiplier": defense_multiplier,
		"post_defense_damage": post_defense,
		"guard_before": guard_before,
		"guard_absorbed": guard_absorbed,
		"shield_before": shield_before,
		"shield_absorbed": shield_absorbed,
		"hp_damage": hp_damage,
		"target_defeated": float(target.get("hp", 0.0)) - hp_damage <= 0.0
	}

