class_name OnlineClient
extends Node

signal response_received(request_id: String, body: Dictionary)
signal request_failed(record: Dictionary)

var endpoint: String = "http://127.0.0.1:8787"
var timeout_seconds: float = 12.0
var _pending: Dictionary = {}

func configure(url: String) -> void:
	endpoint = url.trim_suffix("/")

func request(operation: String, payload: Dictionary = {}, request_id: String = "") -> String:
	var id := request_id if not request_id.is_empty() else _new_id()
	if _pending.has(id): return id # idempotent duplicate submission
	var trace := id
	var packet := JjkProtocol.envelope(operation, payload, id, trace)
	var http := HTTPRequest.new()
	http.timeout = timeout_seconds
	add_child(http)
	_pending[id] = http
	http.request_completed.connect(_on_completed.bind(id, http))
	var error := http.request(endpoint, ["Content-Type: application/json", "X-Request-Id: %s" % id, "X-Trace-Id: %s" % trace], HTTPClient.METHOD_POST, JSON.stringify(packet))
	if error != OK:
		_fail(id, "NETWORK_REQUEST_START_FAILED", "NETWORK", error_string(error))
	return id

func _on_completed(result: int, code: int, _headers: PackedStringArray, body: PackedByteArray, id: String, http: HTTPRequest) -> void:
	_pending.erase(id)
	if is_instance_valid(http): http.queue_free()
	if result != HTTPRequest.RESULT_SUCCESS or code >= 400:
		_fail(id, "NETWORK_HTTP_FAILED", "NETWORK", "HTTP %s" % code)
		return
	var parsed: Variant = JSON.parse_string(body.get_string_from_utf8())
	if not parsed is Dictionary:
		_fail(id, "INVALID_RESPONSE", "NETWORK", "response is not an object")
		return
	response_received.emit(id, parsed as Dictionary)

func _fail(id: String, code: String, category: String, message: String) -> void:
	_pending.erase(id)
	var record := {"code": code, "category": category, "message": message, "request_id": id, "trace_id": id, "recoverable": true, "retryable": true}
	request_failed.emit(record)
	if has_node("/root/ErrorService"):
		get_node("/root/ErrorService").report(code, category, message, "网络请求失败，请重试。", {"request_id": id, "trace_id": id, "operation": "request"})

func _new_id() -> String:
	return "%s-%s" % [Time.get_unix_time_from_system(), randi()]
