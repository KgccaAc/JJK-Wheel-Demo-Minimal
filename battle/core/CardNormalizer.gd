class_name CardNormalizer
extends RefCounted

func normalize_direct_card(raw: Dictionary) -> Dictionary:
	var card: Dictionary = raw.duplicate(true)
	var card_id: String = str(card.get("id", ""))
	if str(card.get("actionId", "")).is_empty():
		# Source authoritative hands identify direct cards by the full card id
		# (for example card_spatial_red_reversal), not the legacy trimmed alias.
		card["actionId"] = card_id
	card["source_kind"] = "direct_card"
	if not card.has("cost") or not card.get("cost") is Dictionary:
		card["cost"] = {}
	if not card.has("effect") or not card.get("effect") is Dictionary:
		card["effect"] = {}
	return card

func normalize_runtime_template(raw: Dictionary) -> Dictionary:
	var template: Dictionary = raw.duplicate(true)
	var action_id: String = str(template.get("id", template.get("actionId", "")))
	var explicit_cost: Dictionary = template.get("cost", {}) as Dictionary
	var effects: Dictionary = template.get("effects", {}) as Dictionary
	return {
		"id": "runtime_" + action_id,
		"actionId": action_id,
		"name": str(template.get("label", action_id)),
		"type": _card_type(template),
		"tags": template.get("tags", []),
		"contexts": ["normal"],
		"cost": {
			"ce": float(template.get("ceCost", explicit_cost.get("ce", explicit_cost.get("minCe", 0.0))))
		},
		"effect": {
			"damage": float(template.get("damage", template.get("baseDamage", 0.0))),
			"ceDamage": float(template.get("baseCeDamage", 0.0)),
			"block": float(template.get("block", 0.0)),
			"shield": float(template.get("baseShield", 0.0)),
			"stabilityDamage": float(template.get("baseStabilityDamage", 0.0)),
			"domainLoad": float(template.get("baseDomainLoadDelta", template.get("domainLoadDelta", 0.0))),
			"special": {"atomicEffects": []}
		},
		"runtime_effects": effects,
		"source_kind": "runtime_template",
		"source_template": template
	}

func _card_type(template: Dictionary) -> String:
	var card_type: String = str(template.get("cardType", template.get("type", "support"))).to_lower()
	if card_type.contains("domain"):
		return "domain"
	if card_type == "attack" or card_type == "melee" or card_type == "technique":
		return "attack"
	return "support"

