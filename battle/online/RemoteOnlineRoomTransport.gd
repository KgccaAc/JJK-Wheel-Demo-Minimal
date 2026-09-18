class_name RemoteOnlineRoomTransport
extends RefCounted

## Production adapter for the authoritative online-battle-v3 room service.
## The room service receives the selected player's complete snapshot on room
## creation/join, immediately returns it for the peer preview, and freezes that
## same snapshot on lock. PNG bytes and local paths stay outside this contract.
const DEFAULT_BASE_URL: String = "https://119.91.224.223/preview-room-api"
const CONNECT_TIMEOUT_MS: int = 900
const RESPONSE_TIMEOUT_MS: int = 3000
const SOCKET_SCRIPT: Script = preload("res://battle/online/RemoteOnlineRoomSocket.gd")

var _base_url: String
var _identity: Dictionary
var _room_revisions: Dictionary = {}
var _battle_revisions: Dictionary = {}
var _force_production_endpoint: bool = false
var _socket: RefCounted

func _init(base_url: String = DEFAULT_BASE_URL, identity: Dictionary = {}, force_production_endpoint: bool = false) -> void:
	_force_production_endpoint = force_production_endpoint
	_base_url = DEFAULT_BASE_URL if force_production_endpoint and base_url == DEFAULT_BASE_URL else (_local_browser_endpoint() if base_url == DEFAULT_BASE_URL else base_url.rstrip("/"))
	_identity = identity.duplicate(true)
	_socket = SOCKET_SCRIPT.new()

func connect_room_socket(room_id: String) -> Dictionary:
	if _socket == null: _socket = SOCKET_SCRIPT.new()
	var result: Dictionary = _socket.call("connect_room_socket", _base_url, room_id, _identity) as Dictionary
	if bool(result.get("ok", false)):
		var request_id := "socket-sub-%d-%d" % [Time.get_ticks_msec(), randi()]
		_socket.call("subscribe_room", request_id, request_id, int(_room_revisions.get(room_id, 0)), int(_battle_revisions.get(room_id, 0)))
	return result

func pump_socket() -> Array[Dictionary]:
	if _socket == null: return []
	return _socket.call("pump_socket") as Array[Dictionary]

func socket_state() -> StringName:
	if _socket == null: return &"CLOSED"
	return StringName(_socket.call("state"))

func disconnect_room_socket() -> void:
	if _socket != null: _socket.call("disconnect_room_socket")

## Local browser previews use the static preview server as a same-origin reverse
## proxy.  Published builds retain the HTTPS production endpoint, so browser CORS
## never weakens the public deployment configuration.
func _local_browser_endpoint() -> String:
	if not OS.has_feature("web"):
		return DEFAULT_BASE_URL
	var origin: Variant = JavaScriptBridge.eval("window.location.origin", true)
	var hostname: Variant = JavaScriptBridge.eval("window.location.hostname", true)
	if hostname is String and str(hostname) in ["127.0.0.1", "localhost"] and origin is String:
		return str(origin).rstrip("/") + "/preview-room-api"
	return DEFAULT_BASE_URL

func request_online_room(packet: Dictionary) -> Dictionary:
	var operation: String = str(packet.get("operation", ""))
	var payload: Dictionary = packet.get("payload", {}) as Dictionary
	var mapped: Dictionary = _map_operation(operation, payload)
	if not bool(mapped.get("ok", false)):
		return {"ok":false, "error":str(mapped.get("error", "unsupported_online_room_operation"))}
	if bool(mapped.get("client_only", false)):
		return {"ok":true, "servers":mapped.get("servers", [])}
	var target: Dictionary = _target()
	if target.is_empty(): return {"ok":false, "error":"preview_room_invalid_url"}
	var room_id: String = str(mapped.get("room_id", ""))
	var request_packet: Dictionary = {
		"protocolVersion":"online-battle-v3",
		"requestId":str(packet.get("request_id", "")),
		"traceId":str(packet.get("trace_id", packet.get("request_id", ""))),
		"identity":_identity.duplicate(true),
		"operation":str(mapped.operation),
		"payload":mapped.get("payload", {}) as Dictionary,
	}
	# The API table keeps room revision and battle revision separate.  Do not
	# send even a null expectedRoomRevision on battle operations.
	if str(mapped.operation) in ["join_room", "leave_room", "delete_room", "set_spectator_policy", "lock_character"] and not room_id.is_empty():
		request_packet["expectedRoomRevision"] = _room_revisions.get(room_id, 0)
	if OS.has_feature("web"):
		var web_response: Dictionary = _request_web(request_packet, room_id)
		_record_battle_revision(room_id, web_response)
		return web_response
	var client := HTTPClient.new()
	var tls: TLSOptions = TLSOptions.client() if bool(target.get("secure", false)) else null
	if client.connect_to_host(str(target.host), int(target.port), tls) != OK: return {"ok":false, "error":"preview_room_connect_failed"}
	if not _wait(client, [HTTPClient.STATUS_CONNECTED], CONNECT_TIMEOUT_MS): return {"ok":false, "error":"preview_room_unavailable"}
	var path: String = str(target.path) + "/api/rooms"
	if client.request(HTTPClient.METHOD_POST, path, ["Content-Type: application/json", "Accept: application/json"], JSON.stringify(request_packet)) != OK: return {"ok":false, "error":"preview_room_request_failed"}
	if not _wait(client, [HTTPClient.STATUS_BODY, HTTPClient.STATUS_CONNECTED], RESPONSE_TIMEOUT_MS): return {"ok":false, "error":"preview_room_timeout"}
	var bytes := PackedByteArray()
	var deadline: int = Time.get_ticks_msec() + RESPONSE_TIMEOUT_MS
	while Time.get_ticks_msec() < deadline:
		client.poll()
		bytes.append_array(client.read_response_body_chunk())
		if client.get_status() == HTTPClient.STATUS_CONNECTED: break
		OS.delay_msec(5)
	var parsed: Variant = JSON.parse_string(bytes.get_string_from_utf8())
	if not parsed is Dictionary: return {"ok":false, "error":"preview_room_invalid_response"}
	var response: Dictionary = parsed as Dictionary
	var data: Dictionary = response.get("data", {}) as Dictionary
	var room: Dictionary = data.get("room", {}) as Dictionary
	if not room.is_empty(): _room_revisions[str(room.get("roomId", ""))] = int(room.get("revision", 0))
	var normalized: Dictionary = _normalize_response(response)
	_record_battle_revision(room_id, normalized)
	return normalized

func _record_battle_revision(room_id: String, response: Dictionary) -> void:
	if room_id.is_empty() or not bool(response.get("ok", false)): return
	var revision: Variant = response.get("battle_revision", response.get("battleRevision", null))
	if revision != null: _battle_revisions[room_id] = int(revision)

## Web exports must not spin HTTPClient/OS.delay_msec on the browser main thread.
## The deployed endpoint explicitly supplies CORS headers; local preview is same-origin
## through /preview-room-api.  Both paths use one browser request boundary.
func _request_web(request_packet: Dictionary, room_id: String) -> Dictionary:
	var url_literal: String = JSON.stringify(_base_url.rstrip("/") + "/api/rooms")
	var body_literal: String = JSON.stringify(JSON.stringify(request_packet))
	var script: String = """(() => {
  try {
    const xhr = new XMLHttpRequest();
    xhr.timeout = 3500;
    xhr.open('POST', %s, false);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.setRequestHeader('Accept', 'application/json');
    xhr.send(%s);
    return xhr.responseText || JSON.stringify({ok:false, error:{code:'preview_room_empty_response'}});
  } catch (error) {
    return JSON.stringify({ok:false, error:{code: error && error.name === 'TimeoutError' ? 'preview_room_timeout' : 'preview_room_browser_request_failed'}});
  }
})()""" % [url_literal, body_literal]
	var parsed: Variant = JSON.parse_string(str(JavaScriptBridge.eval(script, true)))
	if not parsed is Dictionary: return {"ok":false, "error":"preview_room_invalid_response"}
	var response: Dictionary = parsed as Dictionary
	var data: Dictionary = response.get("data", {}) as Dictionary
	var room: Dictionary = data.get("room", {}) as Dictionary
	if not room.is_empty(): _room_revisions[str(room.get("roomId", room_id))] = int(room.get("revision", 0))
	return _normalize_response(response)

func _normalize_response(response: Dictionary) -> Dictionary:
	var normalized: Dictionary = response.duplicate(true)
	var data: Dictionary = normalized.get("data", {}) as Dictionary
	for key: String in ["room", "battle", "score", "rating", "battleRevision", "visible_state", "projection", "type", "nextStage", "peerSubmission", "accepted", "mySubmission"]:
		if data.has(key): normalized[key] = data[key]
	if data.has("battleRevision"): normalized["battle_revision"] = int(data.get("battleRevision", 0))
	if data.has("nextStage"): normalized["next_stage"] = str(data.get("nextStage", ""))
	if data.has("peerSubmission"): normalized["peer_submission"] = str(data.get("peerSubmission", ""))
	if data.has("mySubmission"): normalized["my_submission"] = str(data.get("mySubmission", ""))
	if normalized.get("battle", null) is Dictionary:
		var battle: Dictionary = (normalized.get("battle", {}) as Dictionary).duplicate(true)
		if battle.has("revealAcks"): battle["reveal_acks"] = battle.get("revealAcks", {})
		if battle.has("revealedInputs"): battle["revealed_inputs"] = battle.get("revealedInputs", {})
		normalized["battle"] = battle
	# Preserve the public V3 error object.  Pages and diagnostic bundles need the
	# code/message/requestId/traceId together; reducing it to a string makes
	# INVALID_REQUEST indistinguishable from a transport failure.
	if not bool(normalized.get("ok", false)) and normalized.get("error", null) is Dictionary:
		var error: Dictionary = (normalized.get("error", {}) as Dictionary).duplicate(true)
		error["request_id"] = str(normalized.get("requestId", ""))
		error["trace_id"] = str(normalized.get("traceId", ""))
		normalized["error"] = error
	return normalized

func _map_operation(operation: String, payload: Dictionary) -> Dictionary:
	var room_id: String = str(payload.get("room_id", ""))
	match operation:
		"createRoom":
			return {"ok":true, "operation":"create_room", "payload":{"mode":"private_1v1", "spectatorPolicy":"read_only" if bool(payload.get("spectator_allowed", true)) else "disabled", "characterId":str(payload.get("character_id", "")), "characterSnapshot":payload.get("character_snapshot", {})}}
		"joinRoom": return {"ok":true, "operation":"join_room", "room_id":room_id, "payload":{"roomId":room_id, "characterId":str(payload.get("character_id", "")), "characterSnapshot":payload.get("character_snapshot", {})}}
		"getRoom": return {"ok":true, "operation":"get_room", "room_id":room_id, "payload":{"roomId":room_id}}
		"getBattleBootstrap": return {"ok":true, "operation":"get_battle_bootstrap", "room_id":room_id, "payload":{"roomId":room_id}}
		"submitStageInput": return {"ok":true, "operation":"submit_stage_input", "room_id":room_id, "payload":{"roomId":room_id, "battleRevision":int(payload.get("battle_revision", 0)), "stage":str(payload.get("stage", "")), "data":payload.get("data", {})}}
		"resyncBattle": return {"ok":true, "operation":"resync_battle", "room_id":room_id, "payload":{"roomId":room_id, "lastBattleRevision":int(payload.get("battle_revision", 0))}}
		"leaveRoom": return {"ok":true, "operation":"leave_room", "room_id":room_id, "payload":{"roomId":room_id}}
		"deleteRoom": return {"ok":true, "operation":"delete_room", "room_id":room_id, "payload":{"roomId":room_id}}
		"setSpectatorPolicy": return {"ok":true, "operation":"set_spectator_policy", "room_id":room_id, "payload":{"roomId":room_id, "spectatorPolicy":"read_only" if bool(payload.get("allowed", true)) else "disabled"}}
		"lockCharacter":
			var selected: Dictionary = _character_lock_payload(str(payload.get("character_id", "")), payload.get("character_snapshot", {}) as Dictionary)
			if selected.is_empty(): return {"ok":false, "error":"character_snapshot_missing"}
			selected["roomId"] = room_id
			selected["locked"] = bool(payload.get("locked", true))
			return {"ok":true, "operation":"lock_character", "room_id":room_id, "payload":selected}
		"getPlayerScore": return {"ok":true, "operation":"get_player_score", "payload":{}}
		"listServers": return {"ok":true, "client_only":true, "servers":["本地 Mock", "官方联机服务器"]}
		"queueMatch": return {"ok":true, "operation":"queue_match", "payload":{"mode":"ranked_1v1", "characterId":str(payload.get("character_id", "")), "characterSnapshot":payload.get("character_snapshot", {})}}
		"cancelMatch": return {"ok":true, "operation":"cancel_match", "payload":{}}
		_: return {"ok":false, "error":"unsupported_online_room_operation"}

func _character_lock_payload(character_id: String, uploaded_snapshot: Dictionary) -> Dictionary:
	# The selected snapshot is authoritative for this room session. It may be an
	# official built-in character or a custom login-card character; neither case
	# requires the remote service to query an official character database.
	if character_id.strip_edges().is_empty() or uploaded_snapshot.is_empty():
		return {}
	var snapshot: Dictionary = uploaded_snapshot.duplicate(true)
	var snapshot_hash: String = str(snapshot.get("snapshotHash", snapshot.get("snapshot_hash", ""))).strip_edges()
	return {"characterId":character_id, "snapshotHash":snapshot_hash, "characterSnapshot":snapshot}

func _target() -> Dictionary:
	var secure: bool = _base_url.begins_with("https://")
	if not secure and not _base_url.begins_with("http://"): return {}
	var remainder: String = _base_url.trim_prefix("https://") if secure else _base_url.trim_prefix("http://")
	var slash: int = remainder.find("/")
	var authority: String = remainder if slash < 0 else remainder.left(slash)
	var path: String = "" if slash < 0 else remainder.substr(slash)
	var parts: PackedStringArray = authority.split(":", false)
	if parts.is_empty() or parts[0].is_empty(): return {}
	return {"host":parts[0], "port":int(parts[1]) if parts.size() > 1 else (443 if secure else 80), "secure":secure, "path":path.rstrip("/")}

func _wait(client: HTTPClient, accepted: Array[HTTPClient.Status], timeout_ms: int) -> bool:
	var deadline: int = Time.get_ticks_msec() + timeout_ms
	while Time.get_ticks_msec() < deadline:
		client.poll()
		if accepted.has(client.get_status()): return true
		if client.get_status() in [HTTPClient.STATUS_CANT_CONNECT, HTTPClient.STATUS_CONNECTION_ERROR, HTTPClient.STATUS_TLS_HANDSHAKE_ERROR]: return false
		OS.delay_msec(5)
	return false

