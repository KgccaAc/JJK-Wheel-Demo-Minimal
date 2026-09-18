class_name JjkProtocol
extends RefCounted

const VERSION: String = "online-battle-v3"

static func envelope(operation: String, payload: Dictionary, request_id: String, trace_id: String = "") -> Dictionary:
	return {"protocol_version": VERSION, "operation": operation, "request_id": request_id, "trace_id": trace_id if not trace_id.is_empty() else request_id, "payload": payload.duplicate(true)}

static func is_compatible(packet: Dictionary) -> bool:
	return str(packet.get("protocol_version", "")) == VERSION and not str(packet.get("request_id", "")).is_empty()
