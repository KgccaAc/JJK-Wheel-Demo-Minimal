extends SceneTree

## Runs against the temporary local authority started by the PowerShell wrapper.
## This is the player-facing matchmaking path: both clients queue, lock, then
## enter an authoritative battle together.
const TRANSPORT_SCRIPT: Script = preload("res://battle/online/RemoteOnlineRoomTransport.gd")

func _initialize() -> void:
	var endpoint := OS.get_environment("ONLINE_MATCHMAKING_ENDPOINT").strip_edges()
	if endpoint.is_empty():
		push_error("ONLINE_MATCHMAKING_ENDPOINT is required for this local authority acceptance")
		quit(2)
		return
	var suffix := "%d-%d" % [Time.get_unix_time_from_system(), randi()]
	var host_profile := _profile("match-host-" + suffix)
	var guest_profile := _profile("match-guest-" + suffix)
	var host: RefCounted = TRANSPORT_SCRIPT.new(endpoint, {"identityId":"match-host-" + suffix, "guest":true}, false)
	var guest: RefCounted = TRANSPORT_SCRIPT.new(endpoint, {"identityId":"match-guest-" + suffix, "guest":true}, false)

	var host_queued := _request(host, "queueMatch", {"character_id":host_profile.id, "character_snapshot":host_profile})
	var guest_queued := _request(guest, "queueMatch", {"character_id":guest_profile.id, "character_snapshot":guest_profile})
	var room: Dictionary = guest_queued.get("room", {}) as Dictionary
	var room_id := str(room.get("roomId", ""))
	var host_room := _request(host, "getRoom", {"room_id":room_id})
	var host_lock := _request(host, "lockCharacter", {"room_id":room_id, "character_id":host_profile.id, "character_snapshot":host_profile, "locked":true})
	var guest_lock := _request(guest, "lockCharacter", {"room_id":room_id, "character_id":guest_profile.id, "character_snapshot":guest_profile, "locked":true})
	var host_bootstrap := _request(host, "getBattleBootstrap", {"room_id":room_id})
	var guest_bootstrap := _request(guest, "getBattleBootstrap", {"room_id":room_id})
	var host_strategy := _request(host, "submitStageInput", {"room_id":room_id, "battle_revision":int(host_bootstrap.get("battle_revision", 0)), "stage":"strategy", "data":{"id":"SteadyButton"}})
	var guest_strategy := _request(guest, "submitStageInput", {"room_id":room_id, "battle_revision":int(guest_bootstrap.get("battle_revision", 0)), "stage":"strategy", "data":{"id":"SteadyButton"}})

	var host_room_state: Dictionary = host_room.get("room", {}) as Dictionary
	var ready_room: Dictionary = guest_lock.get("room", {}) as Dictionary
	var result_state: Dictionary = guest_strategy.get("visible_state", {}) as Dictionary
	var passed := bool(host_queued.get("ok", false))
	passed = passed and bool(guest_queued.get("ok", false)) and room_id != "" and str(room.get("state", "")) == "LOBBY"
	passed = passed and str(host_room_state.get("state", "")) == "LOBBY" and (host_room_state.get("members", []) as Array).size() == 2
	passed = passed and bool(host_lock.get("ok", false)) and bool(guest_lock.get("ok", false)) and str(ready_room.get("state", "")) == "READY"
	passed = passed and bool(host_bootstrap.get("ok", false)) and bool(guest_bootstrap.get("ok", false))
	passed = passed and bool(host_strategy.get("ok", false)) and bool(guest_strategy.get("ok", false)) and str(result_state.get("phase", "")) == "DISCARD"
	print("ONLINE_MATCHMAKING_CLIENT_ACCEPTANCE %s" % ("PASS" if passed else "FAIL"))
	if not passed:
		print("ONLINE_MATCHMAKING_DEBUG host_queue=", host_queued, " guest_queue=", guest_queued, " host_room=", host_room, " host_lock=", host_lock, " guest_lock=", guest_lock, " host_bootstrap=", host_bootstrap, " guest_bootstrap=", guest_bootstrap, " host_strategy=", host_strategy, " guest_strategy=", guest_strategy)
	quit(0 if passed else 1)

func _request(transport: RefCounted, operation: String, payload: Dictionary) -> Dictionary:
	var request_id := "match-client-%d-%d" % [Time.get_ticks_msec(), randi()]
	return transport.call("request_online_room", {"operation":operation, "request_id":request_id, "trace_id":request_id, "payload":payload}) as Dictionary

func _profile(character_id: String) -> Dictionary:
	var cards: Array[Dictionary] = []
	for index: int in 10:
		cards.append({"id":"%s-card-%d" % [character_id, index], "name":"验收术式牌", "type":"action", "tags":[], "effect":{"damage":1}, "cost":{"ce":0}})
	return {"id":character_id, "displayName":character_id, "stats":{"body":"B", "martial":"B", "cursed_energy":"B", "control":"B", "efficiency":"B", "talent":"B"}, "cards":cards}
