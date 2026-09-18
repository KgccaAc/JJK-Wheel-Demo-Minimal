class_name CharacterProfileBuilder
extends RefCounted

const DataRepositoryScript: Script = preload("res://battle/data/BattleDataRepository.gd")
var _data: RefCounted = DataRepositoryScript.new()

func build(character_id: String) -> Dictionary:
	for raw: Dictionary in _data.characters():
		if str(raw.get("id", "")) == character_id:
			var profile: Dictionary = raw.duplicate(true)
			var rule: Dictionary = _character_rule(character_id)
			_apply_rule(profile, rule)
			profile["tag_set"] = _tag_set(profile)
			return profile
	return {}

func _character_rule(character_id: String) -> Dictionary:
	var data: Dictionary = _data.runtime("character-card-rules.json")
	var rules: Dictionary = data.get("characters", data.get("characterRules", {})) as Dictionary
	return rules.get(character_id, {}) as Dictionary

func _apply_rule(profile: Dictionary, rule: Dictionary) -> void:
	var archetype_data: Dictionary = _data.runtime("character-card-rules.json").get("archetypes", {}) as Dictionary
	for field: String in ["archetypes", "techniqueFamilies", "variants", "forceAllowTags", "forceAllowSourceActionIds", "forceDenySourceActionIds", "denyTags", "denyCardTypes", "specialHandTags"]:
		profile[field] = _combined_values(profile.get(field, []), rule.get(field, []), (rule.get("rules", {}) as Dictionary).get(field, []))
	var flags: Dictionary = (profile.get("flags", {}) as Dictionary).duplicate(true)
	for archetype: String in _string_values(profile.get("archetypes", [])):
		var archetype_rule: Dictionary = archetype_data.get(archetype, {}) as Dictionary
		_merge_flags(flags, archetype_rule.get("profilePatch", {}) as Dictionary)
		profile["forceAllowTags"] = _combined_values(profile.get("forceAllowTags", []), archetype_rule.get("allowTags", []))
		profile["forceAllowSourceActionIds"] = _combined_values(profile.get("forceAllowSourceActionIds", []), archetype_rule.get("forceAllowSourceActionIds", []))
		profile["forceDenySourceActionIds"] = _combined_values(profile.get("forceDenySourceActionIds", []), archetype_rule.get("forceDenySourceActionIds", []))
		profile["denyTags"] = _combined_values(profile.get("denyTags", []), archetype_rule.get("denyTags", []))
		profile["denyCardTypes"] = _combined_values(profile.get("denyCardTypes", []), archetype_rule.get("denyCardTypes", []))
	_merge_flags(flags, rule.get("profilePatch", {}) as Dictionary)
	profile["flags"] = flags

func _merge_flags(target: Dictionary, patch: Dictionary) -> void:
	for key: String in patch: target[key] = patch[key]

func _combined_values(first: Array, second: Array, third: Array = []) -> Array[String]:
	var result: Array[String] = []
	for source: Array in [first, second, third]:
		for value: Variant in source:
			var text: String = str(value)
			if not result.has(text): result.append(text)
	return result

func _string_values(values: Array) -> Array[String]:
	return _combined_values(values, [])

func _tag_set(profile: Dictionary) -> Dictionary:
	var result: Dictionary = {}
	for tag: Variant in profile.get("traits", []): result[str(tag)] = true
	for tag: Variant in profile.get("cardTags", []): result[str(tag)] = true
	for tag: Variant in profile.get("archetypes", []): result[str(tag)] = true
	for tag: Variant in profile.get("techniqueFamilies", []): result[str(tag)] = true
	for tag: Variant in profile.get("variants", []): result[str(tag)] = true
	for tag: Variant in profile.get("forceAllowTags", []): result[str(tag)] = true
	return result

