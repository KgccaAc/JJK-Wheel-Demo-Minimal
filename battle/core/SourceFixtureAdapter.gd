class_name SourceFixtureAdapter
extends RefCounted

const RULESET_VERSION: StringName = &"godot-battle-rules-v1"
const BattleStateScript: Script = preload("res://battle/rules/BattleState.gd")
const DataRepositoryScript: Script = preload("res://battle/data/BattleDataRepository.gd")

var _data: RefCounted = DataRepositoryScript.new()

func load_opening_fixture(path: String) -> Dictionary:
	var text: String = FileAccess.get_file_as_string(path)
	if text.is_empty():
		return {"ok": false, "error": "fixture_file_missing"}
	var parsed: Variant = JSON.parse_string(text)
	if not parsed is Dictionary:
		return {"ok": false, "error": "fixture_json_invalid"}
	var fixture: Dictionary = parsed as Dictionary
	if str(fixture.get("schema", "")) != "godot-source-duel-fixture-v1":
		return {"ok": false, "error": "fixture_schema_invalid"}
	if str(fixture.get("ruleset_version", "")) != str(RULESET_VERSION):
		return {"ok": false, "error": "fixture_ruleset_invalid"}
	var left: Dictionary = fixture.get("left", {}) as Dictionary
	var right: Dictionary = fixture.get("right", {}) as Dictionary
	if left.is_empty() or right.is_empty():
		return {"ok": false, "error": "fixture_actors_missing"}
	var state: Variant = BattleStateScript.new()
	state.initialize(
		str(fixture.get("ruleset_version", "")),
		_seed_as_int(str(fixture.get("seed", ""))),
		_profile_from_fixture(left),
		_profile_from_fixture(right)
	)
	state.round = int(fixture.get("round", 1))
	state.set_zone_cards(0, "hand", _cards(left.get("normal_hand", [])))
	state.set_zone_cards(1, "hand", _cards(right.get("normal_hand", [])))
	state.set_zone_cards(0, "domain", _cards(left.get("domain_hand", [])))
	state.set_zone_cards(1, "domain", _cards(right.get("domain_hand", [])))
	return {
		"ok": true,
		"state": state,
		"fixture": fixture,
		"source_state_hash": str(fixture.get("state_hash", ""))
	}

func _profile_from_fixture(actor: Dictionary) -> Dictionary:
	var character_id: String = str(actor.get("character_id", ""))
	var profile: Dictionary = _character_profile(character_id)
	profile.merge({
		"id": character_id,
		"hp": float(actor.get("hp", 0.0)),
		"max_hp": float(actor.get("max_hp", 0.0)),
		"ce": float(actor.get("ce", 0.0)),
		"max_ce": float(actor.get("max_ce", 0.0)),
		"normal_hand_capacity": int(actor.get("normal_hand_capacity", 8)),
		"domain_hand_capacity": int(actor.get("domain_hand_capacity", 3))
	}, true)
	return profile

func _character_profile(character_id: String) -> Dictionary:
	for raw_profile: Variant in _data.call("characters") as Array:
		if raw_profile is Dictionary and str((raw_profile as Dictionary).get("id", "")) == character_id:
			return (raw_profile as Dictionary).duplicate(true)
	return {}

func _cards(raw_cards: Variant) -> Array:
	var cards: Array = []
	for raw_card: Variant in raw_cards as Array:
		if raw_card is Dictionary:
			var card: Dictionary = (raw_card as Dictionary).duplicate(true)
			var definition: Dictionary = _definition_for_action(str(card.get("action_id", "")))
			if not definition.is_empty():
				card["effect"] = (definition.get("effect", {}) as Dictionary).duplicate(true)
				card["type"] = str(definition.get("type", card.get("type", "")))
				card["source_definition_id"] = str(definition.get("id", ""))
				if definition.has("accuracy"):
					card["accuracy"] = (definition.get("accuracy", {}) as Dictionary).duplicate(true)
			card["cost"] = {"ce": float(card.get("ce_cost", 0.0))}
			cards.append(card)
	return cards

func _definition_for_action(action_id: String) -> Dictionary:
	if action_id == "reverse_cursed_technique_output":
		return {
			"id": "generated_reverse_cursed_technique_output",
			"type": "healing",
			"effect": {"damage": 0.0, "ceDamage": 0.0, "healing": 0.0, "block": 0.0, "shield": 0.0, "domainLoad": 0.0, "stabilityDamage": 0.0, "special": {"atomicEffects": []}}
		}
	for raw_card: Dictionary in _data.call("cards") as Array:
		var card_id: String = str(raw_card.get("id", ""))
		if card_id == action_id:
			return raw_card.duplicate(true)
		var aliases: Array = raw_card.get("aliases", []) as Array
		var tags: Array = raw_card.get("tags", []) as Array
		if aliases.has(action_id) or tags.has(action_id) or card_id.trim_prefix("card_") == action_id:
			return raw_card.duplicate(true)
	for template: Dictionary in (_data.call("runtime", "action-templates.json") as Dictionary).get("templates", []) as Array:
		if str(template.get("id", "")) == action_id:
			return _template_definition(template)
	return {}

func _template_definition(template: Dictionary) -> Dictionary:
	return {
		"id": "runtime_" + str(template.get("id", "")),
		"type": str(template.get("type", "support")),
		"effect": {
			"damage": float(template.get("damage", template.get("baseDamage", 0.0))),
			"ceDamage": float(template.get("baseCeDamage", 0.0)),
			"healing": 0.0,
			"block": float(template.get("block", 0.0)),
			"shield": float(template.get("baseShield", 0.0)),
			"domainLoad": float(template.get("baseDomainLoadDelta", 0.0)),
			"stabilityDamage": float(template.get("baseStabilityDamage", 0.0)),
			"special": {"atomicEffects": []}
		}
	}

func _seed_as_int(value: String) -> int:
	return int(value.sha256_text().substr(0, 8).hex_to_int())

