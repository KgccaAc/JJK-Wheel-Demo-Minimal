class_name RemoteOnlineRoomSocket
extends RefCounted

signal event_received(event: Dictionary)
signal state_changed(state: StringName)

var _peer: WebSocketPeer
var _endpoint: String = ""
var _room_id: String = ""
var _identity: Dictionary = {}
var _state: StringName = &"CLOSED"
var _pending_subscribe: Dictionary = {}
var _last_received_ms: int = 0
var _last_heartbeat_ms: int = 0
const HEARTBEAT_INTERVAL_MS: int = 20000


func state() -> StringName:
	return _state
func connect_room_socket(endpoint: String, room_id: String, identity: Dictionary) -> Dictionary:
	if _peer != null and _endpoint == endpoint.rstrip("/") and _room_id == room_id.strip_edges() and _identity == identity and _state in [&"CONNECTING", &"OPEN"]:
		return {"ok":true, "reused":true}
	disconnect_room_socket()
	_endpoint = endpoint.rstrip("/")
	_room_id = room_id.strip_edges()
	_identity = identity.duplicate(true)
	if _endpoint.is_empty() or _room_id.is_empty() or str(_identity.get("identityId", "")).strip_edges().is_empty():
		return {"ok":false, "error":{"code":"INVALID_SOCKET_CONTEXT"}}
	var scheme := "wss" if _endpoint.begins_with("https://") else "ws"
	var authority_path := _endpoint.trim_prefix("https://") if _endpoint.begins_with("https://") else _endpoint.trim_prefix("http://")
	_peer = WebSocketPeer.new()
	var error: Error = _peer.connect_to_url("%s://%s/api/rooms/socket?roomId=%s" % [scheme, authority_path, _room_id.uri_encode()])
	if error != OK:
		_peer = null
		_set_state(&"CLOSED")
		return {"ok":false, "error":{"code":"SOCKET_CONNECT_FAILED", "detail":error}}
	_set_state(&"CONNECTING")
	_last_received_ms = Time.get_ticks_msec()
	_last_heartbeat_ms = _last_received_ms
	return {"ok":true}

func disconnect_room_socket() -> void:
	if _peer != null: _peer.close()
	_peer = null
	_pending_subscribe.clear()
	_last_received_ms = 0
	_last_heartbeat_ms = 0
	_set_state(&"CLOSED")

func pump_socket() -> Array[Dictionary]:
	if _peer == null: return []
	_peer.poll()
	var next_state := _state_for_peer(_peer.get_ready_state())
	if next_state != _state: _set_state(next_state)
	if _peer.get_ready_state() != WebSocketPeer.STATE_OPEN: return []
	if Time.get_ticks_msec() - _last_heartbeat_ms >= HEARTBEAT_INTERVAL_MS:
		var heartbeat_id := "socket-ping-%d" % Time.get_ticks_msec()
		send_packet({"protocolVersion":"online-battle-v3", "requestId":heartbeat_id, "traceId":heartbeat_id, "type":"ping"})
		_last_heartbeat_ms = Time.get_ticks_msec()
	if not _pending_subscribe.is_empty():
		var pending := _pending_subscribe
		var sent: Dictionary = send_packet(pending)
		# Keep the subscription queued until the WebSocketPeer confirms that the
		# frame was accepted.  On Web builds the first OPEN poll can race the
		# browser's underlying socket; dropping it here leaves an OPEN socket that
		# never receives room broadcasts.
		if bool(sent.get("ok", false)):
			_pending_subscribe.clear()
	var result: Array[Dictionary] = []
	while _peer.get_available_packet_count() > 0:
		var parsed: Variant = JSON.parse_string(_peer.get_packet().get_string_from_utf8())
		if parsed is Dictionary:
			_last_received_ms = Time.get_ticks_msec()
			result.append(parsed as Dictionary)
			event_received.emit(parsed as Dictionary)
	return result

func send_packet(packet: Dictionary) -> Dictionary:
	if _peer == null or _peer.get_ready_state() != WebSocketPeer.STATE_OPEN:
		return {"ok":false, "error":{"code":"SOCKET_NOT_OPEN"}}
	_peer.send_text(JSON.stringify(packet))
	return {"ok":true}

func subscribe_room(request_id: String, trace_id: String = "", last_room_revision: int = 0, last_battle_revision: int = 0) -> Dictionary:
	var packet := {"protocolVersion":"online-battle-v3", "requestId":request_id, "traceId":trace_id if not trace_id.is_empty() else request_id, "identity":_identity.duplicate(true), "type":"subscribe_room", "payload":{"roomId":_room_id, "lastRoomRevision":last_room_revision, "lastBattleRevision":last_battle_revision}}
	if _peer == null or _peer.get_ready_state() != WebSocketPeer.STATE_OPEN:
		_pending_subscribe = packet
		return {"ok":true, "queued":true}
	return send_packet(packet)

func _state_for_peer(value: WebSocketPeer.State) -> StringName:
	match value:
		WebSocketPeer.STATE_CONNECTING: return &"CONNECTING"
		WebSocketPeer.STATE_OPEN: return &"OPEN"
		WebSocketPeer.STATE_CLOSING: return &"CLOSING"
		_: return &"CLOSED"

func _set_state(next: StringName) -> void:
	if _state == next: return
	_state = next
	state_changed.emit(_state)
