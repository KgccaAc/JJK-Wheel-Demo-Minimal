class_name ActionIntentV3
extends RefCounted

var actor_index: int = -1
var card_instance_ids: Array[String] = []
var domain_instance_ids: Array[String] = []
var strategy_id: StringName = &"default"
var initiative_commitment: int = 0

static func from_dictionary(input: Dictionary) -> ActionIntentV3:
	var intent: ActionIntentV3 = ActionIntentV3.new()
	intent.actor_index = int(input.get("actor_index", -1))
	for raw_id: Variant in input.get("card_instance_ids", []) as Array:
		intent.card_instance_ids.append(str(raw_id))
	for raw_id: Variant in input.get("domain_instance_ids", []) as Array:
		intent.domain_instance_ids.append(str(raw_id))
	intent.strategy_id = StringName(str(input.get("strategy_id", "default")))
	intent.initiative_commitment = int(input.get("initiative_commitment", 0))
	return intent

func to_dictionary() -> Dictionary:
	return {
		"actor_index": actor_index,
		"card_instance_ids": card_instance_ids.duplicate(),
		"domain_instance_ids": domain_instance_ids.duplicate(),
		"strategy_id": String(strategy_id),
		"initiative_commitment": initiative_commitment
	}

