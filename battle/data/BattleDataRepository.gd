class_name BattleDataRepository
extends RefCounted

## 唯一的数据读取入口。战斗规则只读取镜像到项目内的 JSON，不依赖网页运行时。
const DATA_ROOT: String = "res://data/battle/source/"
const LoginCardCharacterCacheScript: Script = preload("res://account/LoginCardCharacterCache.gd")
const OnlineRoomOpponentCacheScript: Script = preload("res://account/OnlineRoomOpponentCache.gd")

func load_json(relative_path: String) -> Dictionary:
	var file: FileAccess = FileAccess.open(DATA_ROOT + relative_path, FileAccess.READ)
	if file == null:
		push_error("Battle data not found: " + relative_path)
		return {}
	var parsed: Variant = JSON.parse_string(file.get_as_text())
	return parsed if parsed is Dictionary else {}

func characters() -> Array:
	var result: Array = (load_json("characters.json").get("characters", []) as Array).duplicate(true)
	var positions: Dictionary = {}
	for index: int in result.size():
		if result[index] is Dictionary: positions[str((result[index] as Dictionary).get("id", ""))] = index
	for snapshot: Dictionary in LoginCardCharacterCacheScript.call("active_characters") as Array:
		var id: String = str(snapshot.get("id", ""))
		if id.is_empty(): continue
		if positions.has(id): result[int(positions[id])] = snapshot
		else: result.append(snapshot)
	# 联机对手快照是独立的短生命周期缓存；绝不写入或替换当前登录卡。
	for snapshot: Dictionary in OnlineRoomOpponentCacheScript.call("active_characters") as Array:
		var opponent_id: String = str(snapshot.get("id", ""))
		if opponent_id.is_empty(): continue
		if positions.has(opponent_id): result[int(positions[opponent_id])] = snapshot
		else: result.append(snapshot)
	return result

func cards() -> Array:
	return load_json("cards.json").get("cards", [])

func domains() -> Array:
	return load_json("domains.json").get("domains", [])

func runtime(relative_path: String) -> Dictionary:
	return load_json("runtime/" + relative_path)

