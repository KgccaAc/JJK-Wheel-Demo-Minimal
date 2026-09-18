extends RefCounted
class_name GrowthRuleEngine
static func apply(base: Dictionary, delta: Dictionary) -> Dictionary:
    var result := base.duplicate(true)
    for key in delta.get("stats", {}).keys(): result[key] = clampi(int(result.get(key, 0)) + int(delta.stats[key]), 0, 100)
    return result
