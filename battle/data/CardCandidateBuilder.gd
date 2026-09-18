class_name CardCandidateBuilder
extends RefCounted

const DataRepositoryScript: Script = preload("res://battle/data/BattleDataRepository.gd")
const CardTemplateRuntimeScript: Script = preload("res://battle/data/CardTemplateRuntime.gd")
var _data: RefCounted = DataRepositoryScript.new()
var _templates: RefCounted = CardTemplateRuntimeScript.new()

func eligible(profile: Dictionary, context: String = "normal") -> Array[Dictionary]:
	return filter_report(profile, context).get("eligible", []) as Array[Dictionary]

func filter_report(profile: Dictionary, context: String = "normal") -> Dictionary:
	var result: Array[Dictionary] = []
	var filtered_reasons: Dictionary = {}
	var retired_excluded: int = 0
	var tag_set: Dictionary = profile.get("tag_set", {})
	var sources: Array = _data.cards().duplicate(true)
	for custom_card: Variant in profile.get("customHandCards", []) as Array:
		if custom_card is Dictionary: sources.append(custom_card)
	for card: Dictionary in sources:
		var reason: String = _filter_reason(card, profile, tag_set, context)
		if reason.is_empty():
			result.append(card)
		else:
			filtered_reasons[str(card.get("id", ""))] = reason
			if reason == "retired_or_unplayable": retired_excluded += 1
	for action: Dictionary in _templates.public_playable_actions(context):
		var action_id: String = str(action.get("actionId", ""))
		if action_id.is_empty() or _contains_action_id(result, action_id): continue
		result.append(action)
	return {"eligible": result, "filtered_reasons": filtered_reasons, "retired_excluded": retired_excluded}

func _contains_action_id(cards: Array[Dictionary], action_id: String) -> bool:
	for card: Dictionary in cards:
		if str(card.get("actionId", card.get("id", ""))) == action_id: return true
	return false

func _filter_reason(card: Dictionary, profile: Dictionary, tag_set: Dictionary, context: String) -> String:
	if bool(card.get("retired", false)) or card.get("playableInHandBeta", true) == false: return "retired_or_unplayable"
	var contexts: Array = card.get("contexts", ["normal"]) as Array
	# 领域展开牌在源数据中属于 normal context；它进入独立领域槽时
	# 由 card id/tag 识别，而不是把所有带 domain context 的牌都塞进去。
	if not contexts.has(context) and not (context == "domain" and is_domain_expansion(card) and contexts.has("normal")):
		return "wrong_context"
	if (profile.get("denyCardTypes", []) as Array).has(str(card.get("type", ""))): return "denied_card_type"
	if _has_any_tag(card, _string_values(profile.get("denyTags", []))): return "denied_tag"
	var action_id: String = _action_id(card)
	if _string_values(profile.get("forceDenySourceActionIds", [])).has(action_id): return "force_denied_action"
	var flags: Dictionary = profile.get("flags", {})
	if (card.get("tags", []) as Array).has("zero_ce") and not bool(flags.get("isZeroCe", false)): return "requires_zero_ce"
	if str(card.get("type", "")) == "domain" and not bool(flags.get("hasDomainAccess", false)): return "requires_domain_access"
	if _has_any_tag(card, ["术式", "technique"]) and not bool(flags.get("hasInnateTechnique", false)): return "requires_innate_technique"
	if _has_any_tag(card, ["cursed_tool", "cursed_tool_user", "咒具"]) and not bool(flags.get("usesCursedTools", false)): return "requires_cursed_tool"
	var exclusive: Dictionary = card.get("exclusive", {})
	if not _matches_exclusive(exclusive, profile): return "exclusive_mismatch"
	var technique_family: String = str(card.get("sourceTechniqueFamily", ""))
	if not technique_family.is_empty() and not _string_values(profile.get("techniqueFamilies", [])).has(technique_family): return "technique_family_mismatch"
	var match_tags: Array[String] = _string_values(card.get("matchTags", []))
	var matches_tag: bool = _matches_tags(match_tags, tag_set, flags)
	if not match_tags.is_empty() and not matches_tag and not _force_allowed(card, profile): return "match_tag_mismatch"
	if _is_special_hand(card) and not (matches_tag or _matches_exclusive(exclusive, profile) or not technique_family.is_empty() or _force_allowed(card, profile)):
		return "unowned_special_hand"
	return ""

func _matches_exclusive(exclusive: Dictionary, profile: Dictionary) -> bool:
	var characters: Array[String] = _string_values(exclusive.get("characters", []))
	var archetypes: Array[String] = _string_values(exclusive.get("archetypes", []))
	var variants: Array[String] = _string_values(exclusive.get("variants", []))
	if not characters.is_empty() and not characters.has(str(profile.get("id", ""))): return false
	if not archetypes.is_empty() and not _arrays_overlap(archetypes, _string_values(profile.get("archetypes", []))): return false
	if not variants.is_empty() and not _arrays_overlap(variants, _string_values(profile.get("variants", []))): return false
	return true

func _matches_tags(tags: Array[String], tag_set: Dictionary, flags: Dictionary) -> bool:
	for tag: String in tags:
		if tag_set.has(tag): return true
		if tag == "domain_access" and bool(flags.get("hasDomainAccess", false)): return true
	return false

func _force_allowed(card: Dictionary, profile: Dictionary) -> bool:
	if _string_values(profile.get("forceAllowSourceActionIds", [])).has(_action_id(card)): return true
	return _has_any_tag(card, _string_values(profile.get("forceAllowTags", [])))

func _is_special_hand(card: Dictionary) -> bool:
	return _has_any_tag(card, ["特色手札", "特殊手札", "rika", "yuta", "ten_shadows", "shrine", "limitless", "cursed_tool_user"])

func is_domain_expansion(card: Dictionary) -> bool:
	var card_id: String = str(card.get("id", ""))
	var action_id: String = str(card.get("actionId", card.get("action_id", "")))
	var tags: Array = card.get("tags", []) as Array
	var domain: Dictionary = card.get("domain", {}) as Dictionary
	return card_id == "card_domain_expand" or action_id == "domain_expand" or tags.has("domain_expand") or str(domain.get("action", "")) == "expand"

func _action_id(card: Dictionary) -> String:
	var action_id: String = str(card.get("actionId", ""))
	return action_id if not action_id.is_empty() else str(card.get("id", "")).trim_prefix("card_")

func _has_any_tag(card: Dictionary, expected: Array[String]) -> bool:
	for tag: Variant in card.get("tags", []):
		if expected.has(str(tag)): return true
	return false

func _arrays_overlap(first: Array[String], second: Array[String]) -> bool:
	for value: String in first:
		if second.has(value): return true
	return false

func _string_values(values: Array) -> Array[String]:
	var result: Array[String] = []
	for value: Variant in values: result.append(str(value))
	return result

