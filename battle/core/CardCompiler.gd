class_name CardCompiler
extends RefCounted

const RULESET_VERSION: StringName = &"godot-battle-rules-v1"
const DataRepositoryScript: Script = preload("res://battle/data/BattleDataRepository.gd")
const EligibilityScript: Script = preload("res://battle/data/BattleEligibility.gd")
const NormalizerScript: Script = preload("res://battle/core/CardNormalizer.gd")
const ValidatorScript: Script = preload("res://battle/core/CardSchemaValidator.gd")
const DefinitionScript: Script = preload("res://battle/core/ExecutableCardDefinition.gd")

var _data: RefCounted = DataRepositoryScript.new()
var _eligibility: RefCounted = EligibilityScript.new()
var _normalizer: RefCounted = NormalizerScript.new()
var _validator: RefCounted = ValidatorScript.new()

func compile_for_character(character_id: String) -> Dictionary:
	var profile: Dictionary = _eligibility.call("build_profile", character_id) as Dictionary
	if profile.is_empty():
		return {"ruleset_version": String(RULESET_VERSION), "entries": [], "errors": ["character_not_found"]}
	var entries: Array[Dictionary] = []
	for raw_card: Dictionary in _eligibility.call("eligible_cards", profile, "normal") as Array:
		if str(raw_card.get("type", "")) == "domain":
			continue
		entries.append(_compile_direct_card(raw_card))
	for domain_response: Dictionary in _domain_response_cards():
		entries.append(_compile_direct_card(domain_response))
	if _profile_has_reverse_output(profile):
		entries.append(_compile_generated_reverse_output())
	for template: Dictionary in (_data.call("runtime", "action-templates.json") as Dictionary).get("templates", []) as Array:
		entries.append(_compile_runtime_template(template))
	return {
		"ruleset_version": String(RULESET_VERSION),
		"character_id": character_id,
		"entries": entries,
		"complete_count": _count_coverage(entries, "complete"),
		"partial_count": _count_coverage(entries, "partial"),
		"unsupported_count": _count_coverage(entries, "unsupported")
	}

func _domain_response_cards() -> Array[Dictionary]:
	var responses: Array[Dictionary] = []
	for raw_card: Dictionary in _data.call("cards") as Array:
		var card_id: String = str(raw_card.get("id", ""))
		if card_id not in ["card_simple_domain_guard", "card_hollow_wicker_basket_guard"]:
			continue
		var response: Dictionary = raw_card.duplicate(true)
		response["actionId"] = card_id.trim_prefix("card_")
		response["source_kind"] = "domain_response_card"
		responses.append(response)
	return responses

func _profile_has_reverse_output(profile: Dictionary) -> bool:
	if bool((profile.get("flags", {}) as Dictionary).get("hasRctOutputAccess", false)):
		return true
	for source: Variant in [profile.get("traits", []), profile.get("cardTags", []), profile.get("specialHandTags", [])]:
		for value: Variant in source as Array:
			if str(value).contains("反转术式外放") or str(value) == "reverse_output":
				return true
	return false

func _compile_generated_reverse_output() -> Dictionary:
	var generated: Dictionary = {
		"id": "generated_reverse_cursed_technique_output",
		"actionId": "reverse_cursed_technique_output",
		"name": "反转术式外放",
		"type": "healing",
		"cost": {"ce": 0.0},
		"effect": {"damage": 0.0, "ceDamage": 0.0, "healing": 0.0, "block": 0.0, "shield": 0.0, "stabilityDamage": 0.0, "domainLoad": 0.0, "special": {"atomicEffects": []}},
		"source_kind": "generated_special_ability"
	}
	return _compile_direct_card(generated)

func _compile_direct_card(raw_card: Dictionary) -> Dictionary:
	var definition: Variant = DefinitionScript.new()
	definition.card = _normalizer.call("normalize_direct_card", raw_card) as Dictionary
	definition.source_kind = &"direct_card"
	definition.errors = _validator.call("validate", definition.card) as Array[String]
	definition.required_tools = _atomic_tools(definition.card)
	definition.required_fields = _direct_required_fields(definition.card, definition.required_tools)
	definition.coverage = &"partial" if definition.errors.is_empty() else &"unsupported"
	return definition.to_report_entry()

func _compile_runtime_template(raw_template: Dictionary) -> Dictionary:
	var definition: Variant = DefinitionScript.new()
	definition.card = _normalizer.call("normalize_runtime_template", raw_template) as Dictionary
	definition.source_kind = &"runtime_template"
	definition.errors = _validator.call("validate", definition.card) as Array[String]
	definition.required_fields = _runtime_required_fields(raw_template)
	definition.coverage = &"partial" if definition.errors.is_empty() else &"unsupported"
	return definition.to_report_entry()

func _atomic_tools(card: Dictionary) -> Array[String]:
	var tools: Array[String] = []
	var card_effect: Dictionary = card.get("effect", {}) as Dictionary
	var raw_special: Variant = card_effect.get("special", {})
	var special: Dictionary = raw_special as Dictionary if raw_special is Dictionary else {}
	var raw_effects: Variant = special.get("atomicEffects", [])
	var effects: Array = raw_effects if raw_effects is Array else [raw_effects]
	for effect: Variant in effects:
		if effect is Dictionary:
			var tool: String = str((effect as Dictionary).get("tool", ""))
			if not tool.is_empty() and not tools.has(tool):
				tools.append(tool)
	return tools

func _direct_required_fields(card: Dictionary, tools: Array[String]) -> Array[String]:
	var fields: Array[String] = []
	for tool: String in tools:
		fields.append("atomic." + tool)
	var effect: Dictionary = card.get("effect", {}) as Dictionary
	for field: String in ["damage", "ceDamage", "healing", "block", "shield", "domainLoad", "stabilityDamage"]:
		if effect.has(field):
			fields.append("effect." + field)
	var scaling: Dictionary = card.get("scaling", {}) as Dictionary
	for key: String in ["baseDamageMultiplier", "martialDamagePerRank", "bodyDamagePerRank", "techniqueDamagePerRank", "cursedEnergyDamagePerRank", "sourceDamageMin", "sourceDamageMax", "controlAccuracyBase", "controlAccuracyPerRank", "martialEvasionPerRank", "accuracyMin", "accuracyMax", "talentDamagePerRank", "highCeThreshold", "highCeDamageMultiplier", "efficiencyCostPerRank", "efficiencyCostMin", "efficiencyCostMax", "efficiencyRecoveryPerRank", "bodyResistanceBase", "bodyResistancePerRank", "bodyResistanceMin", "bodyResistanceMax", "talentBlockPerRank", "talentHealingPerRank", "ceDamageMultiplier", "ceDamageControlPerRank", "stabilityDamageMultiplier", "stabilityDamageControlPerRank", "domainLoadMultiplier", "domainLoadEfficiencyPerRank", "domainPressureMultiplier", "domainPressureControlPerRank"]:
		if scaling.has(key):
			fields.append("scaling." + key)
	return fields

func _runtime_required_fields(template: Dictionary) -> Array[String]:
	var fields: Array[String] = []
	for key: String in (template.get("effects", {}) as Dictionary).keys():
		fields.append("effects." + key)
	return fields

func _count_coverage(entries: Array[Dictionary], coverage: String) -> int:
	var count: int = 0
	for entry: Dictionary in entries:
		if str(entry.get("coverage", "")) == coverage:
			count += 1
	return count

