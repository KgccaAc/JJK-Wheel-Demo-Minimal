class_name CardSchemaValidator
extends RefCounted

func validate(card: Dictionary) -> Array[String]:
	var errors: Array[String] = []
	if str(card.get("id", "")).is_empty():
		errors.append("missing_id")
	if str(card.get("actionId", "")).is_empty():
		errors.append("missing_action_id")
	if str(card.get("name", "")).is_empty():
		errors.append("missing_name")
	if not card.get("cost", {}) is Dictionary:
		errors.append("invalid_cost")
	if not card.get("effect", {}) is Dictionary:
		errors.append("invalid_effect")
	return errors

