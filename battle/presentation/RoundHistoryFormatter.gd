class_name RoundHistoryFormatter
extends RefCounted

## 将已提交的 RoundPackage 转为 UI 文本。这里绝不执行规则或读取活跃 BattleState，
## 因而回放、保存和未来服务端下发的同一封包都会得到相同的纪要。

static func format(package: Dictionary) -> Dictionary:
	var round_number: int = int(package.get("round", 1))
	var before: Array = package.get("round_history_before", []) as Array
	var after_state: Dictionary = package.get("after_state", {}) as Dictionary
	var after: Array = after_state.get("actors", []) as Array
	var lines: Array[String] = []
	for side: int in 2:
		var prefix: String = "我方" if side == 0 else "对方"
		lines.append("%s攻击\t%s" % [prefix, _attack_result(package, side)])
	for side: int in 2:
		var prefix: String = "我方" if side == 0 else "对方"
		var old_actor: Dictionary = before[side] as Dictionary if side < before.size() else {}
		var new_actor: Dictionary = after[side] as Dictionary if side < after.size() else {}
		lines.append("%s\t体力%s，咒力%s，护盾%s" % [prefix, _signed_delta(float(new_actor.get("hp", 0.0)) - float(old_actor.get("hp", 0.0))), _signed_delta(float(new_actor.get("ce", 0.0)) - float(old_actor.get("ce", 0.0))), _signed_delta(float(new_actor.get("guard", 0.0)) - float(old_actor.get("guard", 0.0)))])
	for side: int in 2:
		var prefix: String = "我方" if side == 0 else "对方"
		var old_actor: Dictionary = before[side] as Dictionary if side < before.size() else {}
		var new_actor: Dictionary = after[side] as Dictionary if side < after.size() else {}
		var damage: float = maxf(0.0, float(old_actor.get("hp", 0.0)) - float(new_actor.get("hp", 0.0)))
		var blocked: float = _blocked_damage(package, 1 - side)
		lines.append("%s承受伤害\t%s（减伤%s）" % [prefix, _number(damage), _number(blocked)])
		lines.append("%s异常\t%s" % [prefix, _status_text(new_actor)])
	return {"title": "上一回合纪要 · R%d" % round_number, "body": "\n".join(lines)}

static func _attack_result(package: Dictionary, actor_index: int) -> String:
	for raw_event: Variant in package.get("events", []) as Array:
		if not raw_event is Dictionary or str((raw_event as Dictionary).get("type", "")) != "actions_resolved": continue
		var payload: Dictionary = (raw_event as Dictionary).get("payload", {}) as Dictionary
		if int(payload.get("actor_index", -1)) != actor_index: continue
		for raw_trace: Variant in payload.get("trace", []) as Array:
			if raw_trace is Dictionary and str((raw_trace as Dictionary).get("tool", "")) == "evasion":
				return "未命中" if bool(((raw_trace as Dictionary).get("evasion", {}) as Dictionary).get("evaded", false)) else "命中"
		return "已行动"
	return "未行动"

static func _blocked_damage(package: Dictionary, actor_index: int) -> float:
	var blocked: float = 0.0
	for raw_event: Variant in package.get("events", []) as Array:
		if not raw_event is Dictionary or str((raw_event as Dictionary).get("type", "")) != "actions_resolved": continue
		var payload: Dictionary = (raw_event as Dictionary).get("payload", {}) as Dictionary
		if int(payload.get("actor_index", -1)) != actor_index: continue
		for raw_trace: Variant in payload.get("trace", []) as Array:
			if raw_trace is Dictionary and str((raw_trace as Dictionary).get("tool", "")) == "base_action": blocked += float((raw_trace as Dictionary).get("absorbed", 0.0))
	return blocked

static func _status_text(actor: Dictionary) -> String:
	var statuses: Dictionary = actor.get("statuses", {}) as Dictionary
	if statuses.is_empty(): return "无"
	var labels: Array[String] = []
	for key: Variant in statuses.keys(): labels.append(str(key))
	labels.sort()
	return "、".join(labels)

static func _signed_delta(value: float) -> String:
	return ("+" if value >= 0.0 else "") + _number(value)

static func _number(value: float) -> String:
	return String.num(value, 1)

