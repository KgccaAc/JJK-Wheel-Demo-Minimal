class_name LocalHttpOnlineRoomTransport
extends RefCounted

## Local-only adapter for the online-battle-v3 contract. It adds a stable player
## id; the local mock receives the same frozen character snapshot that the room
## handoff already owns, never a PNG login card or an authentication secret.
const DEFAULT_BASE_URL: String = "http://127.0.0.1:8787"
const CONNECT_TIMEOUT_MS: int = 350
const RESPONSE_TIMEOUT_MS: int = 1200

var _base_url: String = DEFAULT_BASE_URL
var _player_id: String = "local-player"

func _init(base_url: String = DEFAULT_BASE_URL, player_id: String = "local-player") -> void:
	_base_url = base_url.rstrip("/")
	_player_id = player_id.strip_edges() if not player_id.strip_edges().is_empty() else "local-player"

func request_online_room(packet: Dictionary) -> Dictionary:
	var request_packet: Dictionary = packet.duplicate(true)
	var payload: Dictionary = request_packet.get("payload", {}) as Dictionary
	if not payload.has("player_id"):
		payload["player_id"] = _player_id
	request_packet["payload"] = payload
	var target: Dictionary = _parse_target()
	if target.is_empty():
		return {"ok":false, "error":"local_worker_invalid_url", "request_payload":payload}
	if OS.has_feature("web"):
		return _request_web_same_origin(request_packet, payload, target)
	var client := HTTPClient.new()
	var connect_error: Error = client.connect_to_host(str(target.host), int(target.port))
	if connect_error != OK:
		return {"ok":false, "error":"local_worker_connect_failed", "request_payload":payload}
	if not _wait_for_status(client, [HTTPClient.STATUS_CONNECTED], CONNECT_TIMEOUT_MS):
		return {"ok":false, "error":"local_worker_unavailable", "request_payload":payload}
	var headers: PackedStringArray = ["Content-Type: application/json", "Accept: application/json"]
	var request_error: Error = client.request(HTTPClient.METHOD_POST, str(target.path) + "/online-room", headers, JSON.stringify(request_packet))
	if request_error != OK:
		return {"ok":false, "error":"local_worker_request_failed", "request_payload":payload}
	if not _wait_for_status(client, [HTTPClient.STATUS_BODY, HTTPClient.STATUS_CONNECTED], RESPONSE_TIMEOUT_MS):
		return {"ok":false, "error":"local_worker_timeout", "request_payload":payload}
	var body := PackedByteArray()
	var deadline: int = Time.get_ticks_msec() + RESPONSE_TIMEOUT_MS
	while Time.get_ticks_msec() < deadline:
		client.poll()
		var chunk: PackedByteArray = client.read_response_body_chunk()
		if not chunk.is_empty():
			body.append_array(chunk)
		if client.get_status() == HTTPClient.STATUS_CONNECTED:
			break
		OS.delay_msec(5)
	if body.is_empty():
		return {"ok":false, "error":"local_worker_empty_response", "request_payload":payload}
	var parsed: Variant = JSON.parse_string(body.get_string_from_utf8())
	if parsed is Dictionary:
		var response: Dictionary = parsed as Dictionary
		response["request_payload"] = payload
		return response
	return {"ok":false, "error":"local_worker_invalid_response", "request_payload":payload}

## Browser HTTPClient polling blocks the page event loop while this synchronous
## lobby contract is waiting.  Local Mock uses a same-origin, synchronous XHR
## only for development; the production room adapter remains HTTP/TLS based.
func _request_web_same_origin(request_packet: Dictionary, payload: Dictionary, target: Dictionary) -> Dictionary:
	var route_literal: String = JSON.stringify(str(target.path) + "/online-room")
	var body_literal: String = JSON.stringify(JSON.stringify(request_packet))
	var script: String = """(() => {
  try {
    const xhr = new XMLHttpRequest();
    xhr.timeout = 1500;
    xhr.open('POST', %s, false);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.setRequestHeader('Accept', 'application/json');
    xhr.send(%s);
    return xhr.responseText || JSON.stringify({ok:false, error:'local_worker_empty_response'});
  } catch (error) {
    return JSON.stringify({ok:false, error: error && error.name === 'TimeoutError' ? 'local_worker_timeout' : 'local_worker_browser_request_failed'});
  }
})()""" % [route_literal, body_literal]
	var raw: Variant = JavaScriptBridge.eval(script, true)
	var parsed: Variant = JSON.parse_string(str(raw))
	if parsed is Dictionary:
		var response: Dictionary = parsed as Dictionary
		response["request_payload"] = payload
		return response
	return {"ok":false, "error":"local_worker_invalid_response", "request_payload":payload}

func _parse_target() -> Dictionary:
	var normalized: String = _base_url
	if not normalized.begins_with("http://"):
		return {}
	var remainder: String = normalized.trim_prefix("http://")
	var slash: int = remainder.find("/")
	var authority: String = remainder if slash < 0 else remainder.left(slash)
	var path: String = "" if slash < 0 else remainder.substr(slash).rstrip("/")
	var parts: PackedStringArray = authority.split(":", false)
	var host: String = parts[0].strip_edges()
	if host.is_empty():
		return {}
	var port: int = 80
	if parts.size() > 1:
		port = int(parts[1])
	if port <= 0 or port > 65535:
		return {}
	return {"host":host, "port":port, "path":path}

func _wait_for_status(client: HTTPClient, accepted: Array[HTTPClient.Status], timeout_ms: int) -> bool:
	var deadline: int = Time.get_ticks_msec() + timeout_ms
	while Time.get_ticks_msec() < deadline:
		client.poll()
		if accepted.has(client.get_status()):
			return true
		if client.get_status() == HTTPClient.STATUS_CANT_CONNECT or client.get_status() == HTTPClient.STATUS_CONNECTION_ERROR or client.get_status() == HTTPClient.STATUS_TLS_HANDSHAKE_ERROR:
			return false
		OS.delay_msec(5)
	return false

