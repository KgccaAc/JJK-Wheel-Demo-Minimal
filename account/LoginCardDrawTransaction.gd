class_name LoginCardDrawTransaction
extends RefCounted

## 源项目比赛卡抽取事务的 Godot 侧状态机。
## 转盘记录在 grade_pending_store 后必须由玩家明确“保存角色”或“放弃”；不能自动覆盖卡内角色。
const SCHEMA: String = "competition-draw-transaction-v1"
const ACTIVE_STATES: Array[String] = ["drawing", "grade_pending_store", "storing"]

static func transition(current: Dictionary, event: String, data: Dictionary = {}) -> Dictionary:
	var state: Dictionary = current.duplicate(true)
	var now: int = int(data.get("now", Time.get_unix_time_from_system()))
	if event == "start":
		if not state.is_empty() and ACTIVE_STATES.has(str(state.get("state", ""))): return _reject("DRAW_IN_PROGRESS", state)
		var draw_id: String = str(data.get("draw_id", "")).strip_edges()
		if draw_id.is_empty(): return _reject("DRAW_ID_REQUIRED", state)
		return _accept({"schema":SCHEMA, "card_id":str(data.get("card_id", "")), "draw_id":draw_id, "draft_key":str(data.get("draft_key", "")), "state":"drawing", "character_id":"", "updated_at":now})
	if state.is_empty(): return _reject("DRAW_TRANSACTION_MISSING", state)
	if event == "grade_ready":
		if str(state.get("state", "")) != "drawing": return _reject("DRAW_GRADE_NOT_ALLOWED", state)
		state["state"] = "grade_pending_store"
	elif event == "save_started":
		if str(state.get("state", "")) != "grade_pending_store": return _reject("DRAW_STORE_NOT_ALLOWED", state)
		state["state"] = "storing"
	elif event == "save_confirmed":
		if str(state.get("state", "")) != "storing": return _reject("DRAW_STORE_NOT_ALLOWED", state)
		var character_id: String = str(data.get("character_id", "")).strip_edges()
		if character_id.is_empty(): return _reject("CHARACTER_ID_REQUIRED", state)
		state["state"] = "stored"
		state["character_id"] = character_id
	elif event == "save_failed":
		if not ["storing", "grade_pending_store"].has(str(state.get("state", ""))): return _reject("DRAW_STORE_NOT_ALLOWED", state)
		state["state"] = "grade_pending_store"
		state["last_error_code"] = str(data.get("error_code", "DRAW_STORE_FAILED"))
	elif event == "abandon_confirmed":
		if str(state.get("state", "")) != "grade_pending_store" or not str(state.get("character_id", "")).is_empty(): return _reject("DRAW_ABANDON_NOT_ALLOWED", state)
		state["state"] = "abandoned"
	else:
		return _reject("DRAW_EVENT_UNKNOWN", state)
	state["updated_at"] = now
	return _accept(state)

static func _accept(transaction: Dictionary) -> Dictionary:
	return {"ok":true, "transaction":transaction}

static func _reject(code: String, transaction: Dictionary) -> Dictionary:
	return {"ok":false, "code":code, "transaction":transaction}

