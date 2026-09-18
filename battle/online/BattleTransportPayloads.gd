class_name BattleTransportPayloads
extends RefCounted

## 服务端传输封装：只放可验证、可重放的公开元数据，绝不发送本地路径、私有手牌或令牌。
const VERSION: StringName = &"battle-transport-v1"
const PRIVATE_STATE_KEYS: Array[String] = ["hand", "deck", "draw", "selected", "discard", "exile", "domain", "card_face_path", "access_token", "refresh_token", "client_secret", "app_secret"]

static func command_envelope(command: Dictionary) -> Dictionary:
	return {"packet_version":String(VERSION), "kind":"battle_command", "request_id":str(command.get("request_id", "")), "room_id":str(command.get("room_id", "")), "expected_revision":int(command.get("expected_revision", 0)), "expected_state_hash":str(command.get("expected_state_hash", "")), "body":command.duplicate(true)}

static func authoritative_envelope(update: Dictionary) -> Dictionary:
	var snapshot: Dictionary = update.get("authoritative_snapshot", {}) as Dictionary
	return {"packet_version":String(VERSION), "kind":"authoritative_update", "room_id":str(update.get("room_id", "")), "revision":int(update.get("authoritative_revision", 0)), "state_hash":str(update.get("authoritative_state_hash", "")), "body":{"phase":str(update.get("phase", "")), "terminal":bool(update.get("terminal", false)), "snapshot":public_snapshot(snapshot), "round_package":public_round_package(update.get("round_package", {}) as Dictionary)}}

static func public_snapshot(snapshot: Dictionary) -> Dictionary:
	var result: Dictionary = snapshot.duplicate(true)
	var actors: Array = result.get("actors", []) as Array
	for index: int in actors.size():
		if not actors[index] is Dictionary: continue
		var actor: Dictionary = actors[index] as Dictionary
		var zones: Dictionary = actor.get("zones", {}) as Dictionary
		for key: String in PRIVATE_STATE_KEYS: zones.erase(key)
		actor["zones"] = zones
		actors[index] = actor
	result["actors"] = actors
	for key: String in PRIVATE_STATE_KEYS: result.erase(key)
	return result

static func public_round_package(package: Dictionary) -> Dictionary:
	var result: Dictionary = package.duplicate(true)
	result.erase("inputs")
	result["after_state"] = public_snapshot(result.get("after_state", {}) as Dictionary)
	return result

