class_name BattleEligibility
extends RefCounted

const ProfileBuilderScript: Script = preload("res://battle/data/CharacterProfileBuilder.gd")
const CandidateBuilderScript: Script = preload("res://battle/data/CardCandidateBuilder.gd")
const WeightScorerScript: Script = preload("res://battle/data/CardWeightScorer.gd")
var _profiles: RefCounted = ProfileBuilderScript.new()
var _candidates: RefCounted = CandidateBuilderScript.new()
var _weights: RefCounted = WeightScorerScript.new()

func build_test_profiles() -> Dictionary:
	var gojo: Dictionary = build_profile("gojo_satoru_shinjuku")
	var sukuna: Dictionary = build_profile("sukuna_heian_or_shinjuku")
	var gojo_cards: Array[Dictionary] = eligible_cards(gojo)
	var sukuna_cards: Array[Dictionary] = eligible_cards(sukuna)
	var gojo_limitless: int = _count_tag(gojo_cards, "limitless")
	var sukuna_shrine: int = _count_tag(sukuna_cards, "shrine")
	var gojo_zero_ce: int = _count_tag(gojo_cards, "zero_ce")
	var sukuna_zero_ce: int = _count_tag(sukuna_cards, "zero_ce")
	var weighted_positive: int = 0
	for card: Dictionary in gojo_cards + sukuna_cards:
		if score_card(card, gojo if gojo_cards.has(card) else sukuna) > 0.0: weighted_positive += 1
	return {"gojo_limitless": gojo_limitless, "sukuna_shrine": sukuna_shrine, "gojo_zero_ce": gojo_zero_ce, "sukuna_zero_ce": sukuna_zero_ce, "weighted_positive": weighted_positive}

func build_profile(character_id: String) -> Dictionary:
	return _profiles.build(character_id)

func eligible_cards(profile: Dictionary, context: String = "normal") -> Array[Dictionary]:
	return _candidates.eligible(profile, context)

func filter_report(profile: Dictionary, context: String = "normal") -> Dictionary:
	return _candidates.filter_report(profile, context)

func score_card(card: Dictionary, profile: Dictionary) -> float:
	return _weights.score(card, profile)

func _count_tag(cards: Array[Dictionary], tag: String) -> int:
	var count: int = 0
	for card: Dictionary in cards:
		if tag in card.get("tags", []): count += 1
	return count

