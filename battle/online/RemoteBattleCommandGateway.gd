class_name RemoteBattleCommandGateway
extends BattleCommandGateway

const TransportPayloadsScript: Script = preload("res://battle/online/BattleTransportPayloads.gd")

## 真实 HTTP/WebSocket 接入点。网络适配器注入后只需实现同名 transport 方法；
## 未配置时明确失败，避免客户端悄悄降级为伪联机或泄露本地状态。
var _transport: RefCounted

func configure(_session: RefCounted, room_id: String, players: Array) -> Dictionary:
	if _transport == null: return {"ok":false, "error":"online_service_unavailable", "room_id":room_id, "players":players.duplicate(true)}
	return {"ok":true}

func submit(player_id: String, command: Dictionary) -> Dictionary:
	if _transport == null: return {"ok":false, "error":"online_service_unavailable", "player_id":player_id, "packet":TransportPayloadsScript.call("command_envelope", command)}
	return {"ok":false, "error":"transport_adapter_contract_pending"}

func request_resync(player_id: String, last_revision: int) -> Dictionary:
	return {"ok":false, "error":"online_service_unavailable", "player_id":player_id, "last_revision":last_revision}

