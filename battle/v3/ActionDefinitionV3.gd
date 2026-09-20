class_name ActionDefinitionV3
extends RefCounted

var id: String = ""
var category: String = "basic"
var cost: Dictionary = {}
var base_values: Dictionary = {}
var scaling_profile: Dictionary = {}
var accuracy_profile: Dictionary = {}
var target_policy: Dictionary = {}
var dsl_effects: Array = []
var tags: Array = []

func to_dictionary() -> Dictionary:
	return {
		"id": id,
		"category": category,
		"cost": cost.duplicate(true),
		"base_values": base_values.duplicate(true),
		"scaling_profile": scaling_profile.duplicate(true),
		"accuracy_profile": accuracy_profile.duplicate(true),
		"target_policy": target_policy.duplicate(true),
		"dsl_effects": dsl_effects.duplicate(true),
		"tags": tags.duplicate(true)
	}

