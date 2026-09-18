class_name CardWeightScorer
extends RefCounted

func score(card: Dictionary, profile: Dictionary) -> float:
	var result: float = maxf(float(card.get("weight", 1.0)), 0.0)
	var tags: Dictionary = profile.get("tag_set", {})
	for tag: Variant in card.get("matchTags", []):
		if tags.has(str(tag)): result += 2.0
	for tag: Variant in card.get("tags", []):
		if tags.has(str(tag)): result += 0.25
	return result

