class_name ExecutableCardDefinition
extends RefCounted

var card: Dictionary = {}
var source_kind: StringName = &""
var coverage: StringName = &"unsupported"
var required_fields: Array[String] = []
var required_tools: Array[String] = []
var errors: Array[String] = []

func to_report_entry() -> Dictionary:
	return {
		"id": str(card.get("id", "")),
		"action_id": str(card.get("actionId", "")),
		"name": str(card.get("name", "")),
		"source_kind": String(source_kind),
		"coverage": String(coverage),
		"official_playable": coverage == &"complete",
		"required_fields": required_fields.duplicate(),
		"required_tools": required_tools.duplicate(),
		"errors": errors.duplicate()
	}

