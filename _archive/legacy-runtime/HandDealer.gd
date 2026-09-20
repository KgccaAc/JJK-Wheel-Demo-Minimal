class_name HandDealer
extends RefCounted

const NORMAL_HAND_LIMIT: int = 8
const DOMAIN_HAND_LIMIT: int = 3
const DATA_ROOT: String = "res://data/battle/source/"

var _eligibility: BattleEligibility = BattleEligibility.new()
const DataRepositoryScript: Script = preload("res://battle/data/BattleDataRepository.gd")
const CardViewModelFactoryScript: Script = preload("res://battle/data/CardViewModelFactory.gd")
var _data: RefCounted = DataRepositoryScript.new()
var _card_view_models: RefCounted = CardViewModelFactoryScript.new()

func deal_for_test(character_id: String, seed_value: int) -> Dictionary:
	var profile: Dictionary = _eligibility.build_profile(character_id)
	return deal(profile, seed_value)

func deal(profile: Dictionary, seed_value: int) -> Dictionary:
	var filter_report: Dictionary = _eligibility.filter_report(profile, "normal")
	var candidates: Array[Dictionary] = _normal_candidates(filter_report.get("eligible", []) as Array[Dictionary])
	var basic_candidate_count: int = _basic_candidate_count(candidates, profile)
	var rng: RandomNumberGenerator = RandomNumberGenerator.new()
	rng.seed = seed_value
	var injected: Array[Dictionary] = _injected_cards(profile, candidates, rng)
	var normal_hand: Array[Dictionary] = injected.duplicate(true)
	var used_ids: Dictionary = {}
	for card: Dictionary in normal_hand: used_ids[str(card.get("id", ""))] = true
	var drawn: Array[Dictionary] = _weighted_draw(candidates, _normal_draw_count() - normal_hand.size(), profile, rng, used_ids)
	normal_hand.append_array(drawn)
	var domain_hand: Array[Dictionary] = _deal_domain(profile)
	normal_hand = _assign_instance_ids(normal_hand, str(profile.get("id", "")), "normal", seed_value)
	domain_hand = _assign_instance_ids(domain_hand, str(profile.get("id", "")), "domain", seed_value)
	return {
		"seed": seed_value,
		"character_id": str(profile.get("id", "")),
		"candidate_count": candidates.size(),
		"filtered_count": (filter_report.get("filtered_reasons", {}) as Dictionary).size(),
		"retired_excluded": int(filter_report.get("retired_excluded", 0)),
		"filtered_reasons": filter_report.get("filtered_reasons", {}),
		"normal_hand": normal_hand,
		"domain_hand": domain_hand,
		"draw_round": 1,
		"rules_version": _rules_version(),
		"injected_count": injected.size(),
		"shortage": max(0, _normal_limit() - normal_hand.size()),
		"basic_pool_diagnostic": {
			"eligible_basic_count": basic_candidate_count,
			"dealt_basic_count": _basic_candidate_count(normal_hand, profile),
			"availability": "available" if basic_candidate_count > 0 else "no_legal_basic_card_in_profile_pool",
			"template_boundary": "public_template_materialized" if basic_candidate_count > 0 else "template_not_deck_card"
		}
	}

func _basic_candidate_count(cards: Array[Dictionary], profile: Dictionary) -> int:
	var count: int = 0
	for card: Dictionary in cards:
		if _card_view_models.call("classify", card, profile) == &"basic":
			count += 1
	return count

func _normal_candidates(candidates: Array[Dictionary]) -> Array[Dictionary]:
	var result: Array[Dictionary] = []
	for card: Dictionary in candidates:
		if str(card.get("type", "")) != "domain": result.append(card)
	return result

func _weighted_draw(candidates: Array[Dictionary], limit: int, profile: Dictionary, rng: RandomNumberGenerator, excluded_ids: Dictionary = {}) -> Array[Dictionary]:
	# Draw without replacement inside one deal. A later round receives fresh
	# instance IDs in _assign_instance_ids, so the same template can reappear
	# as a different physical card without duplicating an existing instance.
	var pool: Array[Dictionary] = candidates.duplicate()
	pool = pool.filter(func(card: Dictionary) -> bool: return not excluded_ids.has(str(card.get("id", ""))))
	var result: Array[Dictionary] = []
	while result.size() < limit and not pool.is_empty():
		var total_weight: float = 0.0
		for card: Dictionary in pool: total_weight += _eligibility.score_card(card, profile)
		if total_weight <= 0.0: break
		var roll: float = rng.randf_range(0.0, total_weight)
		var selected_index: int = pool.size() - 1
		for index: int in pool.size():
			roll -= _eligibility.score_card(pool[index], profile)
			if roll <= 0.0:
				selected_index = index
				break
		result.append(pool[selected_index])
		pool.remove_at(selected_index)
	return result

func _deal_domain(profile: Dictionary) -> Array[Dictionary]:
	var result: Array[Dictionary] = []
	# The initial domain slot is drawn from normal-context domain activation cards.
	var candidates: Array[Dictionary] = _eligibility.eligible_cards(profile, "normal")
	for card: Dictionary in candidates:
		var action_id: String = str(card.get("actionId", ""))
		var card_id: String = str(card.get("id", ""))
		var tags: Array = card.get("tags", [])
		if action_id == "domain_expand" or card_id == "card_domain_expand" or "domain_expand" in tags:
			result.append(card)
			break
	return result

func _normal_limit() -> int:
	var hand_rules: Dictionary = _hand_rules()
	return min(NORMAL_HAND_LIMIT, int(hand_rules.get("maxHandSize", NORMAL_HAND_LIMIT)))

func _normal_draw_count() -> int:
	var configured: int = int(_hand_rules().get("drawPerTurn", 5))
	return min(_normal_limit(), configured)

func _hand_rules() -> Dictionary:
	var rules: Dictionary = _data.runtime("hand-rules.json")
	return rules.get("hand", {}) as Dictionary

func domain_hand_limit() -> int:
	return DOMAIN_HAND_LIMIT

func _assign_instance_ids(cards: Array[Dictionary], character_id: String, zone: String, seed_value: int) -> Array[Dictionary]:
	var result: Array[Dictionary] = []
	for index: int in cards.size():
		var card: Dictionary = cards[index].duplicate(true)
		if str(card.get("instance_id", "")).is_empty():
			var card_id: String = str(card.get("id", card.get("actionId", "card")))
			card["instance_id"] = "%s:%s:%s:%d:%d" % [character_id, zone, card_id, seed_value, index]
		result.append(card)
	return result

func _injected_cards(profile: Dictionary, candidates: Array[Dictionary], rng: RandomNumberGenerator) -> Array[Dictionary]:
	var result: Array[Dictionary] = []
	var character_rules: Dictionary = _data.runtime("character-card-rules.json")
	var rules_by_character: Dictionary = character_rules.get("characters", character_rules.get("characterRules", {}))
	var entry: Dictionary = rules_by_character.get(str(profile.get("id", "")), {})
	var rules: Dictionary = entry.get("rules", {})
	for injection: Dictionary in rules.get("fixedHandInjections", []):
		_append_action_card(result, candidates, str(injection.get("actionId", "")), injection)
	for injection: Dictionary in rules.get("randomHandInjections", []):
		if rng.randf() <= float(injection.get("probability", 0.0)):
			_append_action_card(result, candidates, str(injection.get("actionId", "")), injection)
	for candidate: Dictionary in candidates:
		if not bool(candidate.get("guaranteedPerTurn", false)): continue
		if str(candidate.get("handSource", "")).begins_with("public-baseline-"):
			var copy: Dictionary = candidate.duplicate(true)
			copy["fixedHandInjection"] = true
			copy["handSource"] = str(candidate.get("handSource", "guaranteed-per-turn"))
			if not _contains_id(result, str(copy.get("id", ""))): result.append(copy)
	# Runtime template injections are data-only card surfaces. Add only when their tags match the profile.
	var template_data: Dictionary = _data.runtime("hand-injections.json")
	var profile_tags: Dictionary = profile.get("tag_set", {})
	for template: Dictionary in (template_data.get("templates", {}) as Dictionary).values():
		var special_tags: Array = template.get("specialHandTags", [])
		if special_tags.is_empty(): continue
		var matched: bool = false
		for tag: Variant in special_tags:
			if profile_tags.has(str(tag)): matched = true; break
		if matched and bool(template.get("guaranteedPerTurn", false)):
			var materialized: Dictionary = _materialize_template(template)
			if not _contains_id(result, str(materialized.get("id", ""))): result.append(materialized)
	return result

func _append_action_card(result: Array[Dictionary], candidates: Array[Dictionary], action_id: String, injection: Dictionary) -> void:
	for candidate: Dictionary in candidates:
		if str(candidate.get("actionId", "")) == action_id:
			var copy: Dictionary = candidate.duplicate(true)
			copy["handSource"] = str(injection.get("handSource", "character_rule"))
			if not _contains_id(result, str(copy.get("id", ""))): result.append(copy)
			return

func _materialize_template(template: Dictionary) -> Dictionary:
	return {"id": str(template.get("id", "")), "actionId": str(template.get("actionId", "")), "name": str(template.get("name", "特殊手札")), "type": str(template.get("cardType", "support")), "tags": template.get("tags", []), "weight": float(template.get("weight", 1.0)), "handSource": str(template.get("handSource", "runtime_template")), "cost": {"ce": float(template.get("ceCost", 0.0))}, "effect": {"block": float(template.get("block", 0.0)), "stabilityDamage": 0.0}}

func _contains_id(cards: Array[Dictionary], card_id: String) -> bool:
	for card: Dictionary in cards:
		if str(card.get("id", "")) == card_id: return true
	return false

func _rules_version() -> int:
	var file: FileAccess = FileAccess.open(DATA_ROOT + "rules.json", FileAccess.READ)
	if file == null: return 0
	var data: Variant = JSON.parse_string(file.get_as_text())
	return int(data.get("version", 0)) if data is Dictionary else 0

