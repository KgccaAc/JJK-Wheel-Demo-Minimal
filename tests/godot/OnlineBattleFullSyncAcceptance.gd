extends SceneTree

const TRANSPORT_SCRIPT: Script = preload("res://battle/online/RemoteOnlineRoomTransport.gd")
const ENDPOINT := "https://119.91.224.223/preview-room-api"

func _initialize() -> void:
	var suffix := "%d-%d" % [Time.get_unix_time_from_system(), randi()]
	var host_profile := _profile("godot-sync-host-" + suffix)
	var guest_profile := _profile("godot-sync-guest-" + suffix)
	var host: RefCounted = TRANSPORT_SCRIPT.new(ENDPOINT, {"identityId":"godot-sync-host-" + suffix, "guest":true}, true)
	var guest: RefCounted = TRANSPORT_SCRIPT.new(ENDPOINT, {"identityId":"godot-sync-guest-" + suffix, "guest":true}, true)
	var created := _request(host, "createRoom", {"character_id":host_profile.id, "character_snapshot":host_profile})
	var room: Dictionary = created.get("room", {}) as Dictionary
	var room_id := str(room.get("roomId", ""))
	var joined := _request(guest, "joinRoom", {"room_id":room_id, "character_id":guest_profile.id, "character_snapshot":guest_profile})
	var host_lock := _request(host, "lockCharacter", {"room_id":room_id, "character_id":host_profile.id, "character_snapshot":host_profile, "locked":true})
	var guest_lock := _request(guest, "lockCharacter", {"room_id":room_id, "character_id":guest_profile.id, "character_snapshot":guest_profile, "locked":true})
	var host_bootstrap := _request(host, "getBattleBootstrap", {"room_id":room_id})
	var guest_bootstrap := _request(guest, "getBattleBootstrap", {"room_id":room_id})
	var host_socket := host.call("connect_room_socket", room_id) as Dictionary
	var guest_socket := guest.call("connect_room_socket", room_id) as Dictionary
	var initial_events := await _wait_for_socket_events([host, guest], "", 6000)
	var host_strategy := _request(host, "submitStageInput", {"room_id":room_id, "battle_revision":int(host_bootstrap.get("battle_revision", 0)), "stage":"strategy", "data":{"id":"SteadyButton"}})
	var guest_strategy := _request(guest, "submitStageInput", {"room_id":room_id, "battle_revision":int(guest_bootstrap.get("battle_revision", 0)), "stage":"strategy", "data":{"id":"SteadyButton"}})
	var strategy_events := await _wait_for_socket_events([host, guest], "DISCARD", 6000)
	if strategy_events.size() != 2:
		print("SYNC_STAGE_DEBUG strategy_events=", strategy_events, " host_strategy=", host_strategy, " guest_strategy=", guest_strategy, " host_socket_state=", host.call("socket_state"), " guest_socket_state=", guest.call("socket_state"))
		quit(1)
	var host_discard_ids := _hand_ids(strategy_events.get("0", {}) as Dictionary, 0)
	var guest_discard_ids := _hand_ids(strategy_events.get("1", {}) as Dictionary, 1)
	var host_discard := _request(host, "submitStageInput", {"room_id":room_id, "battle_revision":int((strategy_events.get("0", {}) as Dictionary).get("battleRevision", 0)), "stage":"discard", "data":{"ids":host_discard_ids.slice(0, 2)}})
	var guest_discard := _request(guest, "submitStageInput", {"room_id":room_id, "battle_revision":int((strategy_events.get("1", {}) as Dictionary).get("battleRevision", 0)), "stage":"discard", "data":{"ids":guest_discard_ids.slice(0, 2)}})
	var discard_events := await _wait_for_socket_events([host, guest], "INITIATIVE", 6000)
	if discard_events.size() != 2:
		print("SYNC_STAGE_DEBUG discard_events=", discard_events, " host_discard=", host_discard, " guest_discard=", guest_discard)
		quit(1)
	var host_initiative := _request(host, "submitStageInput", {"room_id":room_id, "battle_revision":int((discard_events.get("0", {}) as Dictionary).get("battleRevision", 0)), "stage":"initiative", "data":{"investment":0}})
	var guest_initiative := _request(guest, "submitStageInput", {"room_id":room_id, "battle_revision":int((discard_events.get("1", {}) as Dictionary).get("battleRevision", 0)), "stage":"initiative", "data":{"investment":0}})
	var initiative_events := await _wait_for_socket_events([host, guest], "PLAY", 6000)
	if initiative_events.size() != 2:
		print("SYNC_STAGE_DEBUG initiative_events=", initiative_events, " host_initiative=", host_initiative, " guest_initiative=", guest_initiative)
		quit(1)
	var host_play_ids := _hand_ids(initiative_events.get("0", {}) as Dictionary, 0)
	var guest_play_ids := _hand_ids(initiative_events.get("1", {}) as Dictionary, 1)
	var host_play := _request(host, "submitStageInput", {"room_id":room_id, "battle_revision":int((initiative_events.get("0", {}) as Dictionary).get("battleRevision", 0)), "stage":"play", "data":{"cards":[host_play_ids[0]], "domain":""}})
	var guest_play := _request(guest, "submitStageInput", {"room_id":room_id, "battle_revision":int((initiative_events.get("1", {}) as Dictionary).get("battleRevision", 0)), "stage":"play", "data":{"cards":[guest_play_ids[0]], "domain":""}})
	var finished_events := await _wait_for_socket_events([host, guest], "FINISHED", 6000)
	if finished_events.size() != 2:
		print("SYNC_STAGE_DEBUG finished_events=", finished_events, " host_play=", host_play, " guest_play=", guest_play)
		quit(1)
	var host_finished := finished_events.get("0", {}) as Dictionary
	var guest_finished := finished_events.get("1", {}) as Dictionary
	var host_state := host_finished.get("visible_state", {}) as Dictionary
	var guest_state := guest_finished.get("visible_state", {}) as Dictionary
	var passed := bool(created.get("ok", false)) and bool(joined.get("ok", false)) and bool(host_lock.get("ok", false)) and bool(guest_lock.get("ok", false))
	passed = passed and bool(host_socket.get("ok", false)) and bool(guest_socket.get("ok", false)) and not initial_events.is_empty()
	passed = passed and bool(host_strategy.get("ok", false)) and bool(guest_strategy.get("ok", false)) and str(host_state.get("phase", "")) == "FINISHED" and str(guest_state.get("phase", "")) == "FINISHED"
	passed = passed and int(host_finished.get("battleRevision", -1)) == int(guest_finished.get("battleRevision", -2))
	passed = passed and str(host_state.get("winner", "")) == str(guest_state.get("winner", "")) and not str(host_state.get("winner", "")).is_empty()
	print("ONLINE_BATTLE_FULL_SYNC_ACCEPTANCE %s room=%s winner=%s" % ["PASS" if passed else "FAIL", room_id, str(host_state.get("winner", ""))])
	if not passed:
		print("ONLINE_SYNC_DEBUG created=", created, " joined=", joined, " host_lock=", host_lock, " guest_lock=", guest_lock, " initial=", initial_events, " finished_host=", host_finished, " finished_guest=", guest_finished)
	host.call("disconnect_room_socket")
	guest.call("disconnect_room_socket")
	quit(0 if passed else 1)

func _request(transport: RefCounted, operation: String, payload: Dictionary) -> Dictionary:
	var request_id := "godot-sync-%d-%d" % [Time.get_ticks_msec(), randi()]
	return transport.call("request_online_room", {"operation":operation, "request_id":request_id, "trace_id":request_id, "payload":payload}) as Dictionary

func _wait_for_socket_events(transports: Array, expected_phase: String, timeout_ms: int) -> Dictionary:
	var latest: Dictionary = {}
	var deadline := Time.get_ticks_msec() + timeout_ms
	while Time.get_ticks_msec() < deadline:
		for index: int in transports.size():
			var pumped: Array[Dictionary] = (transports[index] as RefCounted).call("pump_socket") as Array[Dictionary]
			for event: Dictionary in pumped:
				var visible := event.get("visible_state", {}) as Dictionary
				var phase := str(visible.get("phase", ""))
				if event.get("type", "") in ["stage_result", "round_result", "battle_bootstrap"] and (expected_phase.is_empty() or phase == expected_phase):
					latest[str(index)] = event
		if latest.size() == transports.size(): return latest
		await create_timer(0.05).timeout
	return latest

func _hand_ids(event: Dictionary, side: int) -> Array[String]:
	var visible := event.get("visible_state", {}) as Dictionary
	var actors := visible.get("actors", []) as Array
	if side >= actors.size(): return []
	var actor := actors[side] as Dictionary
	var hand := ((actor.get("zones", {}) as Dictionary).get("hand", []) as Array)
	var ids: Array[String] = []
	for card: Variant in hand:
		if card is Dictionary and not str((card as Dictionary).get("instance_id", "")).is_empty(): ids.append(str((card as Dictionary).get("instance_id", "")))
	return ids

func _profile(character_id: String) -> Dictionary:
	var cards: Array[Dictionary] = []
	for index: int in 10:
		cards.append({"id":"%s-finisher-%d" % [character_id, index], "name":"终结牌", "type":"action", "tags":[], "effect":{"damage":100000, "target":"opponent"}, "cost":{"ce":0}})
	return {"id":character_id, "displayName":character_id, "stats":{"body":"B", "martial":"B", "cursed_energy":"B", "control":"B", "efficiency":"B", "talent":"B"}, "cards":cards}
