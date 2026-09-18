extends RefCounted

## 跨 Room → Fight 的短生命周期交接。它只保存联机身份与房间快照，绝不保存
## 登录卡文件或把角色数据写回账户；Fight 读取后会由玩家输入协议驱动。
static var _active: Dictionary = {}

static func activate(room: Dictionary, local_player_id: String, endpoint: String = "http://127.0.0.1:8789", transport_kind: String = "remote", auth_identity: Dictionary = {}) -> void:
	var snapshot: Dictionary = room.duplicate(true)
	var players: Array = snapshot.get("players", []) as Array
	var player_identity: String = local_player_id.strip_edges()
	print("[online-context] activate room=%s local=%s players=%s" % [str(snapshot.get("room_id", "")), player_identity, JSON.stringify(players)])
	_active = {"room": snapshot, "local_player_id": player_identity, "endpoint": endpoint.rstrip("/"), "transport_kind":transport_kind, "identity":auth_identity.duplicate(true)}

static func is_active() -> bool:
	return not _active.is_empty() and not str(_active.get("local_player_id", "")).is_empty()

static func snapshot() -> Dictionary:
	return _active.duplicate(true)

static func clear() -> void:
	_active.clear()

