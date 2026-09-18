class_name BattleIntent
extends RefCounted

var actor_id: String = ""
var strategy_id: String = ""
var discard_instance_ids: Array[String] = []
var initiative_commitment: Dictionary = {}
var card_instance_ids: Array[String] = []
var domain_instance_ids: Array[String] = []
var request_id: String = ""

static func from_dict(value: Dictionary) -> BattleIntent:
	var intent := BattleIntent.new()
	intent.actor_id = str(value.get("actor_id", ""))
	intent.strategy_id = str(value.get("strategy_id", ""))
	intent.discard_instance_ids = _string_array(value.get("discard_instance_ids", []))
	intent.initiative_commitment = (value.get("initiative_commitment", {}) as Dictionary).duplicate(true)
	intent.card_instance_ids = _string_array(value.get("card_instance_ids", []))
	intent.domain_instance_ids = _string_array(value.get("domain_instance_ids", []))
	intent.request_id = str(value.get("request_id", ""))
	return intent

func validate() -> Dictionary:
	if actor_id.is_empty(): return {"ok": false, "code": "INVALID_REQUEST", "message": "actor_id is required"}
	if request_id.is_empty(): return {"ok": false, "code": "INVALID_REQUEST", "message": "request_id is required"}
	return {"ok": true}

func to_dict() -> Dictionary:
	return {"actor_id": actor_id, "strategy_id": strategy_id, "discard_instance_ids": discard_instance_ids.duplicate(), "initiative_commitment": initiative_commitment.duplicate(true), "card_instance_ids": card_instance_ids.duplicate(), "domain_instance_ids": domain_instance_ids.duplicate(), "request_id": request_id}

static func _string_array(value: Variant) -> Array[String]:
	var output: Array[String] = []
	if value is Array:
		for item: Variant in value as Array: output.append(str(item))
	return output
