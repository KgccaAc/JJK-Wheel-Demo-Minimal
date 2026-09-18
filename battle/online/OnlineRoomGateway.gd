class_name OnlineRoomGateway
extends RefCounted

## 对齐源项目 /online-room 的客户端接口；不保存认证资料，也不创建本地伪房间。
const VERSION: StringName = &"online-battle-v3"
## 联机战斗只允许提交本方阶段意图与读取服务端投影。最终结算 receipt
## 是 Worker 的输出，客户端没有写入入口。
const OPERATIONS: Array[StringName] = [&"createRoom", &"joinRoom", &"getRoom", &"watchRoom", &"leaveRoom", &"deleteRoom", &"setRoomMode", &"setSpectatorPolicy", &"lockCharacter", &"queueMatch", &"cancelMatch", &"listServers", &"getPlayerScore", &"getBattleBootstrap", &"submitStageInput", &"resyncBattle"]

var _transport: RefCounted

func set_transport(transport: RefCounted) -> void:
	_transport = transport

func connect_room_socket(room_id: String) -> Dictionary:
	if _transport == null or not _transport.has_method("connect_room_socket"):
		return {"ok":false, "error":{"code":"SOCKET_TRANSPORT_UNAVAILABLE"}}
	return _transport.call("connect_room_socket", room_id) as Dictionary

func disconnect_room_socket() -> void:
	if _transport != null and _transport.has_method("disconnect_room_socket"): _transport.call("disconnect_room_socket")

func pump_socket() -> Array[Dictionary]:
	if _transport == null or not _transport.has_method("pump_socket"): return []
	return _transport.call("pump_socket") as Array[Dictionary]

func socket_state() -> StringName:
	if _transport != null and _transport.has_method("socket_state"):
		return StringName(_transport.call("socket_state"))
	return &"CLOSED"

func socket_event(event: Dictionary) -> Dictionary:
	return event.duplicate(true)

func build_request(operation: StringName, payload: Dictionary, request_id: String = "") -> Dictionary:
	var id := request_id if not request_id.is_empty() else _new_request_id()
	return {"protocol_version":String(VERSION), "operation":String(operation), "request_id":id, "trace_id":id, "payload":payload.duplicate(true)}

func request(operation: StringName, payload: Dictionary) -> Dictionary:
	if not OPERATIONS.has(operation): return {"ok":false, "error":"unsupported_online_room_operation", "operation":String(operation)}
	var packet: Dictionary = build_request(operation, payload)
	if _transport == null: return {"ok":false, "error":"online_service_unavailable", "packet":packet}
	if not _transport.has_method("request_online_room"):
		return {"ok":false, "error":"transport_adapter_contract_pending", "packet":packet}
	var response: Variant = _transport.call("request_online_room", packet)
	return response as Dictionary if response is Dictionary else {"ok":false, "error":"invalid_online_room_response", "packet":packet}

## 服务端实现可用此表生成路由白名单，客户端不会把隐写登录卡或访问令牌写入 payload。
func supported_operations() -> Array[StringName]:
	return OPERATIONS.duplicate()

func _new_request_id() -> String:
	return "room-%d-%d" % [Time.get_ticks_msec(), randi()]

