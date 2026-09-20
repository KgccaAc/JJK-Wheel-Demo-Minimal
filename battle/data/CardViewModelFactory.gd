class_name CardViewModelFactory
extends RefCounted

const DOMAIN_TAGS: Array[String] = ["domain", "领域", "domain_expand", "domain_activation", "domain_maintenance", "domain_response", "domain_control"]
const TECHNIQUE_TAGS: Array[String] = ["术式", "technique", "特色手札", "特殊手札"]

func build_card_view_model(card: Dictionary, profile: Dictionary, availability: Variant) -> BattleCardViewModel:
	var view_model: BattleCardViewModel = BattleCardViewModel.new()
	var cost: Dictionary = card.get("cost", {}) as Dictionary
	view_model.card_id = str(card.get("id", ""))
	view_model.action_id = str(card.get("actionId", view_model.card_id))
	view_model.display_name = str(card.get("name", view_model.card_id))
	view_model.summary = str(card.get("summary", card.get("description", "")))
	view_model.display_category = classify(card, profile)
	var effect: Dictionary = card.get("effect", {}) as Dictionary
	view_model.attack_value = float(card.get("attack", effect.get("damage", 0.0)))
	view_model.defence_value = float(card.get("defence", card.get("defense", float(effect.get("block", 0.0)) + float(effect.get("shield", 0.0)))))
	view_model.ce_cost = float(cost.get("ce", card.get("ceCost", 0.0)))
	view_model.risk = str(card.get("risk", ""))
	view_model.tags = _string_tags(card.get("tags", []))
	view_model.availability = availability
	_apply_resolution_preview(view_model, availability)
	if availability is CardAvailabilityResult and not (availability as CardAvailabilityResult).resolved_values.is_empty():
		view_model.attack_value = float((availability as CardAvailabilityResult).resolved_values.get("damage", view_model.attack_value))
		view_model.defence_value = float((availability as CardAvailabilityResult).resolved_values.get("block", view_model.defence_value)) + float((availability as CardAvailabilityResult).resolved_values.get("shield", 0.0))
	elif availability is Dictionary and (availability as Dictionary).has("resolved_values"):
		var resolved: Dictionary = (availability as Dictionary).get("resolved_values", {}) as Dictionary
		view_model.attack_value = float(resolved.get("damage", view_model.attack_value))
		view_model.defence_value = float(resolved.get("block", view_model.defence_value)) + float(resolved.get("shield", 0.0))
	view_model.source_card = card.duplicate(true)
	if availability is CardAvailabilityResult:
		view_model.ce_cost = float((availability as CardAvailabilityResult).ce_cost)
	elif availability is Dictionary and (availability as Dictionary).has("ce_cost"):
		view_model.ce_cost = float((availability as Dictionary).get("ce_cost", view_model.ce_cost))
	return view_model

func _apply_resolution_preview(view_model: BattleCardViewModel, availability: Variant) -> void:
	var resolved: Dictionary = {}
	var mitigation: Dictionary = {}
	if availability is CardAvailabilityResult:
		resolved = (availability as CardAvailabilityResult).resolved_values.duplicate(true)
	elif availability is Dictionary:
		var payload: Dictionary = availability as Dictionary
		resolved = (payload.get("resolved_values", {}) as Dictionary).duplicate(true)
		mitigation = (payload.get("mitigation", {}) as Dictionary).duplicate(true)
	view_model.resolved_values = resolved
	view_model.mitigation = mitigation
	view_model.raw_damage = float(resolved.get("raw_damage", resolved.get("damage", 0.0)))
	view_model.scaled_damage = float(resolved.get("scaled_damage", resolved.get("damage", 0.0)))
	view_model.post_modifier_damage = float(mitigation.get("post_defense_damage", mitigation.get("post_modifier_damage", resolved.get("damage", 0.0))))
	view_model.defense_absorbed = float(mitigation.get("defense_absorbed", 0.0))
	view_model.guard_absorbed = float(mitigation.get("guard_absorbed", 0.0))
	view_model.shield_absorbed = float(mitigation.get("shield_absorbed", 0.0))
	view_model.hp_damage = float(mitigation.get("hp_damage", 0.0))

func classify(card: Dictionary, profile: Dictionary) -> StringName:
	var tags: Array[String] = _string_tags(card.get("tags", []))
	# “领域相关”不等于“领域展开牌”：术式可以拥有领域控制/领域对抗标签。
	# 只有实际的领域槽牌才使用领域牌面和领域分区。
	if _is_domain_slot_card(card, tags): return &"domain"
	if not str(card.get("sourceTechniqueFamily", "")).is_empty(): return &"technique"
	if _contains_any(tags, TECHNIQUE_TAGS): return &"technique"
	var families: Array[String] = _string_tags(profile.get("techniqueFamilies", []))
	if _contains_any(tags, families): return &"technique"
	# Cards without a technique marker are rendered as basic cards. This is a
	# deliberate legacy-data fallback; eligibility still decides whether they
	# may enter the actual hand.
	return &"basic"

func _is_domain_slot_card(card: Dictionary, tags: Array[String]) -> bool:
	var card_type: String = str(card.get("type", card.get("cardType", ""))).to_lower()
	if card_type == "domain" or card_type == "领域": return true
	var action_id: String = str(card.get("actionId", card.get("action_id", "")))
	var card_id: String = str(card.get("id", ""))
	return action_id == "domain_expand" or card_id == "card_domain_expand" or tags.has("domain_expand")

func _string_tags(values: Array) -> Array[String]:
	var result: Array[String] = []
	for value: Variant in values: result.append(str(value))
	return result

func _contains_any(values: Array[String], expected: Array[String]) -> bool:
	for value: String in values:
		if expected.has(value): return true
	return false

