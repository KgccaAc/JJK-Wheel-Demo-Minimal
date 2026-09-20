class_name ActionResolutionV3
extends RefCounted

var ok: bool = false
var error: String = ""
var action_id: String = ""
var actor_index: int = -1
var target_index: int = -1
var cost: Dictionary = {}
var values: Dictionary = {}
var mitigation: Dictionary = {}
var outcome: Dictionary = {}
var mutations: Array[Dictionary] = []
var trace: Array[Dictionary] = []

func to_dictionary() -> Dictionary:
	return {
		"ok": ok,
		"error": error,
		"action_id": action_id,
		"actor_index": actor_index,
		"target_index": target_index,
		"cost": cost.duplicate(true),
		"values": values.duplicate(true),
		"mitigation": mitigation.duplicate(true),
		"outcome": outcome.duplicate(true),
		"mutations": mutations.duplicate(true),
		"trace": trace.duplicate(true)
	}

