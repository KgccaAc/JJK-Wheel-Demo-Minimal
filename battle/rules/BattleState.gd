class_name BattleState
extends RefCounted

const ZONE_NAMES: Array[String] = ["deck", "draw", "hand", "selected", "discard", "exile", "domain"]
const MAX_RETAINED_EVENTS: int = 128

var ruleset_version: StringName = &""
var seed: int = 0
var round: int = 1
var active_actor: int = 0
var revision: int = 0
var phase: StringName = &"OPENING_STRATEGY"
var finished: bool = false
var winner: String = ""
var finish_reason: String = ""
var strategy_snapshot: Array[Dictionary] = []
var initiative: Dictionary = {}
var pending_discard_count: int = 0
var pending_play: Dictionary = {}
var actors: Array[Dictionary] = []
var events: Array[Dictionary] = []
var event_sequence: int = 0

func initialize(next_ruleset_version: String, next_seed: int, player_profile: Dictionary, opponent_profile: Dictionary) -> void:
	ruleset_version = StringName(next_ruleset_version)
	seed = next_seed
	round = 1
	active_actor = 0
	revision = 0
	phase = &"OPENING_STRATEGY"
	finished = false
	winner = ""
	finish_reason = ""
	events.clear()
	event_sequence = 0
	strategy_snapshot = [{}, {}]
	initiative = {}
	pending_discard_count = 0
	pending_play = {}
	actors = [_new_actor(player_profile), _new_actor(opponent_profile)]

func set_zone_cards(actor_index: int, zone_name: String, cards: Array) -> void:
	if actor_index < 0 or actor_index >= actors.size():
		push_error("invalid actor index")
		return
	if not ZONE_NAMES.has(zone_name):
		push_error("invalid card zone: " + zone_name)
		return
	var actor: Dictionary = actors[actor_index]
	var zones: Dictionary = actor.get("zones", {}) as Dictionary
	zones[zone_name] = cards.duplicate(true)
	actor["zones"] = zones
	revision += 1

func append_event(event_type: String, payload: Dictionary = {}) -> void:
	events.append({"sequence": event_sequence, "type": event_type, "payload": payload.duplicate(true)})
	event_sequence += 1
	if events.size() > MAX_RETAINED_EVENTS:
		events.pop_front()
	revision += 1

func canonical_snapshot() -> Dictionary:
	var snapshot: Dictionary = {
		"ruleset_version": String(ruleset_version),
		"seed": seed,
		"round": round,
		"active_actor": active_actor,
		"revision": revision,
		"phase": String(phase),
		"finished": finished,
		"winner": winner,
		"finish_reason": finish_reason,
		"strategy_snapshot": strategy_snapshot.duplicate(true),
		"initiative": initiative.duplicate(true),
		"pending_discard_count": pending_discard_count,
		"pending_play": pending_play.duplicate(true),
		"actors": actors.duplicate(true),
		"events": events.duplicate(true)
		,"event_sequence": event_sequence
	}
	var encoded: String = JSON.stringify(_canonicalize(snapshot))
	snapshot["state_hash"] = encoded.sha256_text()
	return snapshot

func restore_canonical_snapshot(snapshot: Dictionary) -> void:
	ruleset_version = StringName(str(snapshot.get("ruleset_version", "")))
	seed = int(snapshot.get("seed", 0))
	round = int(snapshot.get("round", 1))
	active_actor = int(snapshot.get("active_actor", 0))
	revision = int(snapshot.get("revision", 0))
	phase = StringName(str(snapshot.get("phase", "OPENING_STRATEGY")))
	finished = bool(snapshot.get("finished", false))
	winner = str(snapshot.get("winner", ""))
	finish_reason = str(snapshot.get("finish_reason", ""))
	# HTTP/JSON and JavaScriptBridge both deserialize arrays as untyped `Array`.
	# Never assign those containers directly to Godot's Array[Dictionary] fields:
	# rebuild the typed boundary one dictionary at a time.
	strategy_snapshot = _dictionary_array(snapshot.get("strategy_snapshot", [{}, {}]))
	initiative = (snapshot.get("initiative", {}) as Dictionary).duplicate(true)
	pending_discard_count = int(snapshot.get("pending_discard_count", 0))
	pending_play = (snapshot.get("pending_play", {}) as Dictionary).duplicate(true)
	actors = _dictionary_array(snapshot.get("actors", []))
	events = _dictionary_array(snapshot.get("events", []))
	event_sequence = int(snapshot.get("event_sequence", events.size()))

func _dictionary_array(value: Variant) -> Array[Dictionary]:
	var typed: Array[Dictionary] = []
	if not value is Array:
		return typed
	for item: Variant in value as Array:
		if item is Dictionary:
			typed.append((item as Dictionary).duplicate(true))
	return typed

func _new_actor(profile: Dictionary) -> Dictionary:
	var zones: Dictionary = {}
	for zone_name: String in ZONE_NAMES:
		zones[zone_name] = []
	var initial_counters: Dictionary = (profile.get("initial_counters", {}) as Dictionary).duplicate(true)
	var initial_counter_labels: Dictionary = (profile.get("initial_counter_labels", {}) as Dictionary).duplicate(true)
	return {
		"id": str(profile.get("id", "")),
		"profile": profile.duplicate(true),
		"hp": float(profile.get("hp", profile.get("max_hp", 0.0))),
		"max_hp": float(profile.get("max_hp", profile.get("hp", 0.0))),
		"ce": float(profile.get("ce", profile.get("max_ce", 0.0))),
		"max_ce": float(profile.get("max_ce", profile.get("ce", 0.0))),
		"statuses": {},
		"counters": initial_counters,
		"counter_labels": initial_counter_labels,
		"domain_state": {},
		"zones": zones
	}

func _canonicalize(value: Variant) -> Variant:
	if value is Dictionary:
		var source: Dictionary = value as Dictionary
		var keys: Array[String] = []
		for key: Variant in source.keys():
			keys.append(str(key))
		keys.sort()
		var result: Dictionary = {}
		for key: String in keys:
			result[key] = _canonicalize(source.get(key))
		return result
	if value is Array:
		var result_array: Array = []
		for item: Variant in value as Array:
			result_array.append(_canonicalize(item))
		return result_array
	return value
