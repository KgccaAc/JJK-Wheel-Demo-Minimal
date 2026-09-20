class_name LoginCardCharacterCache
extends RefCounted

## 当前登录卡的完整角色快照缓存；内置角色表只读，缓存仅作为运行时覆盖层。
static var _path: String = "user://login-card-characters.json"
const ProjectorScript: Script = preload("res://account/LoginCardCharacterProjector.gd")

static func use_test_path(path: String) -> void:
	_path = path

static func replace_active_card(card_id: String, characters: Array) -> bool:
	var normalized: Array[Dictionary] = []
	for raw: Variant in characters:
		if raw is Dictionary:
			var snapshot: Dictionary = ProjectorScript.call("project", raw as Dictionary) as Dictionary
			if not str(snapshot.get("id", "")).is_empty(): normalized.append(snapshot)
	var file := FileAccess.open(_path, FileAccess.WRITE)
	if file == null: return false
	file.store_string(JSON.stringify({"version":1, "card_id":card_id, "characters":normalized}))
	return true

static func clear_active_card() -> bool:
	return replace_active_card("", [])

static func active_characters() -> Array[Dictionary]:
	var file := FileAccess.open(_path, FileAccess.READ)
	if file == null: return []
	var parsed: Variant = JSON.parse_string(file.get_as_text())
	if not parsed is Dictionary: return []
	var result: Array[Dictionary] = []
	for raw: Variant in (parsed as Dictionary).get("characters", []) as Array:
		if raw is Dictionary: result.append((raw as Dictionary).duplicate(true))
	return result

