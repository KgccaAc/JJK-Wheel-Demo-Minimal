class_name HttpLoginCardSyncGateway
extends RefCounted

## Read-only server sync adapter for the preview login-card endpoint. It keeps the
## raw card snapshot in the response; AccountState decides whether to merge it.
const API_VERSION: String = "jjk.login-card.v2"
const CONNECT_TIMEOUT_MS: int = 500
const RESPONSE_TIMEOUT_MS: int = 2000
var _base_url: String = "http://127.0.0.1:8788"

func _init(base_url: String = "http://127.0.0.1:8788") -> void:
	_base_url = base_url.rstrip("/")

func fetch_card(card_id: String) -> Dictionary:
	if card_id.strip_edges().is_empty(): return {"ok":false, "code":"card_id_missing"}
	var target: Dictionary = _target()
	if target.is_empty(): return {"ok":false, "code":"invalid_endpoint"}
	var client := HTTPClient.new()
	var tls: TLSOptions = TLSOptions.client() if bool(target.get("secure", false)) else null
	if client.connect_to_host(str(target.host), int(target.port), tls) != OK: return {"ok":false, "code":"server_unavailable"}
	if not _wait(client, [HTTPClient.STATUS_CONNECTED], CONNECT_TIMEOUT_MS): return {"ok":false, "code":"server_unavailable"}
	if client.request(HTTPClient.METHOD_GET, "/api/login-cards/" + card_id.uri_encode(), ["Accept: application/json"]) != OK: return {"ok":false, "code":"request_failed"}
	if not _wait(client, [HTTPClient.STATUS_BODY, HTTPClient.STATUS_CONNECTED], RESPONSE_TIMEOUT_MS): return {"ok":false, "code":"request_timeout"}
	var bytes := PackedByteArray()
	var deadline: int = Time.get_ticks_msec() + RESPONSE_TIMEOUT_MS
	while Time.get_ticks_msec() < deadline:
		client.poll()
		bytes.append_array(client.read_response_body_chunk())
		if client.get_status() == HTTPClient.STATUS_CONNECTED: break
		OS.delay_msec(5)
	var parsed: Variant = JSON.parse_string(bytes.get_string_from_utf8())
	return parsed as Dictionary if parsed is Dictionary else {"ok":false, "code":"invalid_response"}

func _target() -> Dictionary:
	var secure: bool = _base_url.begins_with("https://")
	if not secure and not _base_url.begins_with("http://"): return {}
	var authority: String = (_base_url.trim_prefix("https://") if secure else _base_url.trim_prefix("http://")).split("/", false)[0]
	var parts: PackedStringArray = authority.split(":", false)
	if parts.is_empty() or parts[0].is_empty(): return {}
	return {"host":parts[0], "port":int(parts[1]) if parts.size() > 1 else (443 if secure else 80), "secure":secure}

func _wait(client: HTTPClient, accepted: Array[HTTPClient.Status], timeout_ms: int) -> bool:
	var deadline: int = Time.get_ticks_msec() + timeout_ms
	while Time.get_ticks_msec() < deadline:
		client.poll()
		if accepted.has(client.get_status()): return true
		if client.get_status() in [HTTPClient.STATUS_CANT_CONNECT, HTTPClient.STATUS_CONNECTION_ERROR, HTTPClient.STATUS_TLS_HANDSHAKE_ERROR]: return false
		OS.delay_msec(5)
	return false

