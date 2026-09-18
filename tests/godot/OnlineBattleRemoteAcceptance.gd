extends SceneTree

const TRANSPORT_SCRIPT: Script = preload("res://battle/online/RemoteOnlineRoomTransport.gd")
const ENDPOINT := "https://119.91.224.223/preview-room-api"

func _initialize() -> void:
	var suffix := "%d-%d" % [Time.get_unix_time_from_system(), randi()]
	var host_id := "accept-host-" + suffix
	var guest_id := "accept-guest-" + suffix
	var host: RefCounted = TRANSPORT_SCRIPT.new(ENDPOINT, {"identityId":host_id, "guest":true}, true)
	var guest: RefCounted = TRANSPORT_SCRIPT.new(ENDPOINT, {"identityId":guest_id, "guest":true}, true)
	var host_profile := _profile("accept-host-character-" + suffix)
	var guest_profile := _profile("accept-guest-character-" + suffix)
	var matchmaking_mapping: Dictionary = host.call("_map_operation", "queueMatch", {"character_id":host_profile.id, "character_snapshot":host_profile}) as Dictionary

	var created: Dictionary = _request(host, "createRoom", {"character_id":host_profile.id, "character_snapshot":host_profile})
	var room: Dictionary = created.get("room", {}) as Dictionary
	var room_id := str(room.get("roomId", ""))
	var joined: Dictionary = _request(guest, "joinRoom", {"room_id":room_id, "character_id":guest_profile.id, "character_snapshot":guest_profile})
	var host_locked: Dictionary = _request(host, "lockCharacter", {"room_id":room_id, "character_id":host_profile.id, "character_snapshot":host_profile, "locked":true})
	var guest_locked: Dictionary = _request(guest, "lockCharacter", {"room_id":room_id, "character_id":guest_profile.id, "character_snapshot":guest_profile, "locked":true})
	var host_bootstrap: Dictionary = _request(host, "getBattleBootstrap", {"room_id":room_id})
	var guest_bootstrap: Dictionary = _request(guest, "getBattleBootstrap", {"room_id":room_id})
	var host_strategy: Dictionary = _request(host, "submitStageInput", {"room_id":room_id, "battle_revision":int(host_bootstrap.get("battle_revision", 0)), "stage":"strategy", "data":{"id":"SteadyButton"}})
	var guest_strategy: Dictionary = _request(guest, "submitStageInput", {"room_id":room_id, "battle_revision":int(guest_bootstrap.get("battle_revision", 0)), "stage":"strategy", "data":{"id":"SteadyButton"}})

	var ready_room: Dictionary = guest_locked.get("room", {}) as Dictionary
	var host_state: Dictionary = host_bootstrap.get("visible_state", {}) as Dictionary
	var guest_state: Dictionary = guest_bootstrap.get("visible_state", {}) as Dictionary
	var result_state: Dictionary = guest_strategy.get("visible_state", {}) as Dictionary
	var ok := bool(matchmaking_mapping.get("ok", false)) and str(matchmaking_mapping.get("operation", "")) == "queue_match"
	ok = ok and bool(created.get("ok", false)) and not room_id.is_empty() and bool(joined.get("ok", false))
	ok = ok and bool(host_locked.get("ok", false)) and bool(guest_locked.get("ok", false)) and str(ready_room.get("state", "")) == "READY"
	ok = ok and bool(host_bootstrap.get("ok", false)) and bool(guest_bootstrap.get("ok", false)) and not host_state.is_empty() and not guest_state.is_empty()
	ok = ok and bool(host_strategy.get("ok", false)) and bool(guest_strategy.get("ok", false)) and str(result_state.get("phase", "")) == "DISCARD"
	print("[%-4s] remote room reaches two-player strategy resolution" % ("PASS" if ok else "FAIL"))
	if not ok:
		print("ONLINE_REMOTE_DEBUG created=", created, " joined=", joined, " host_lock=", host_locked, " guest_lock=", guest_locked, " host_bootstrap=", host_bootstrap, " guest_bootstrap=", guest_bootstrap, " host_strategy=", host_strategy, " guest_strategy=", guest_strategy)
	print("ONLINE_BATTLE_REMOTE_ACCEPTANCE %s" % ("PASS" if ok else "FAIL"))
	quit(0 if ok else 1)

func _request(transport: RefCounted, operation: String, payload: Dictionary) -> Dictionary:
	var request_id := "remote-accept-%d-%d" % [Time.get_ticks_msec(), randi()]
	return transport.call("request_online_room", {"operation":operation, "request_id":request_id, "trace_id":request_id, "payload":payload}) as Dictionary

func _profile(character_id: String) -> Dictionary:
	var cards: Array[Dictionary] = []
	for index: int in 10:
		cards.append({"id":"%s-card-%d" % [character_id, index], "name":"验收术式牌", "type":"action", "tags":[], "effect":{"damage":1}, "cost":{"ce":0}})
	return {"id":character_id, "displayName":character_id, "stats":{"body":"B", "martial":"B", "cursed_energy":"B", "control":"B", "efficiency":"B", "talent":"B"}, "cards":cards}
