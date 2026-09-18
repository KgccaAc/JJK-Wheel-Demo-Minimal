class_name RoundResult
extends RefCounted

var round: int = 0
var before_state: Dictionary = {}
var after_state: Dictionary = {}
var actions: Array[Dictionary] = []
var events: Array[Dictionary] = []
var trace: Dictionary = {}
var winner: String = ""
var end_reason: String = ""

static func from_dict(value: Dictionary) -> RoundResult:
	var result := RoundResult.new()
	result.round = int(value.get("round", 0))
	result.before_state = (value.get("before_state", {}) as Dictionary).duplicate(true)
	result.after_state = (value.get("after_state", {}) as Dictionary).duplicate(true)
	result.actions = _dict_array(value.get("actions", []))
	result.events = _dict_array(value.get("events", []))
	result.trace = (value.get("trace", {}) as Dictionary).duplicate(true)
	result.winner = str(value.get("winner", ""))
	result.end_reason = str(value.get("end_reason", ""))
	return result

func to_dict() -> Dictionary:
	return {"round": round, "before_state": before_state.duplicate(true), "after_state": after_state.duplicate(true), "actions": actions.duplicate(true), "events": events.duplicate(true), "trace": trace.duplicate(true), "winner": winner, "end_reason": end_reason}

static func _dict_array(value: Variant) -> Array[Dictionary]:
	var output: Array[Dictionary] = []
	if value is Array:
		for item: Variant in value as Array:
			if item is Dictionary: output.append((item as Dictionary).duplicate(true))
	return output
