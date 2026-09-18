class_name OnlineRoomOpponentCache
extends RefCounted

## 仅保存当前联机房间对手的运行时快照，不写入登录卡，也不会覆盖玩家自己的卡内角色。
const ProjectorScript: Script = preload("res://account/LoginCardCharacterProjector.gd")
static var _opponent: Dictionary = {}

static func set_snapshot(raw: Dictionary) -> void:
	var projected: Dictionary = ProjectorScript.call("project", raw) as Dictionary
	_opponent = projected if not str(projected.get("id", "")).is_empty() else {}

static func clear() -> void:
	_opponent = {}

static func active_characters() -> Array[Dictionary]:
	var result: Array[Dictionary] = []
	if not _opponent.is_empty(): result.append(_opponent.duplicate(true))
	return result

