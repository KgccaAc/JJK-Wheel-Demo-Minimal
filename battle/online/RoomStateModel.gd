class_name RoomStateModel
extends RefCounted

## 房间协议的纯数据边界：把本地 V1 和正式 V2 都规范为 room_id / players。
## 本类不持有场景节点、不发网络请求，也不负责显示文案。
static func normalize(raw: Dictionary) -> Dictionary:
	if raw.is_empty(): return {}
	if not raw.has("members"):
		var v1: Dictionary = raw.duplicate(true)
		v1["room_id"] = str(raw.get("room_id", raw.get("roomId", "")))
		return v1
	var v2: Dictionary = raw.duplicate(true)
	v2["room_id"] = str(raw.get("roomId", raw.get("room_id", "")))
	v2["state"] = "battle_ready" if str(raw.get("state", "")) == "READY" else raw.get("state", "")
	var players: Array[Dictionary] = []
	for entry: Variant in raw.get("members", []) as Array:
		if not entry is Dictionary: continue
		var member: Dictionary = entry as Dictionary
		if str(member.get("role", "player")) != "player": continue
		var player: Dictionary = {
			"player_id":str(member.get("identityId", member.get("player_id", ""))),
			"character_id":str(member.get("characterId", member.get("character_id", ""))),
			"locked":bool(member.get("locked", false))
		}
		# Formal V2 responses may carry the private snapshot in the member
		# envelope. Preserve it through normalization so Fight can build each
		# side from the exchanged data rather than a local-cache fallback.
		if member.get("character_snapshot", null) is Dictionary:
			player["character_snapshot"] = (member.get("character_snapshot", {}) as Dictionary).duplicate(true)
		elif member.get("characterSnapshot", null) is Dictionary:
			player["character_snapshot"] = (member.get("characterSnapshot", {}) as Dictionary).duplicate(true)
		players.append(player)
	v2["players"] = players
	return v2

static func opponent_for(room: Dictionary, local_player_id: String) -> Dictionary:
	for raw: Variant in room.get("players", []) as Array:
		if raw is Dictionary and str((raw as Dictionary).get("player_id", "")) != local_player_id:
			return (raw as Dictionary).duplicate(true)
	return {}

static func is_battle_ready(room: Dictionary) -> bool:
	var players: Array = room.get("players", []) as Array
	if players.size() != 2: return false
	for raw: Variant in players:
		if not raw is Dictionary or not bool((raw as Dictionary).get("locked", false)): return false
	return str(room.get("state", "")) in ["battle_ready", "READY"]

