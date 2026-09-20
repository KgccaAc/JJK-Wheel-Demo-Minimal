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
	var action_summaries: Dictionary = _action_summaries(package)
	for side: int in 2:
		var prefix: String = "我方" if side == 0 else "对方"
		lines.append("%s攻击\t%s" % [prefix, _attack_result(package, side, action_summaries)])
		var intent: String = str(action_summaries.get(side, {}).get("intent", "未读取"))
		lines.append("%s意图\t%s" % [prefix, intent])
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
		var source: String = str(action_summaries.get(1 - side, {}).get("source", "未读取"))
		lines.append("%s承受伤害\t%s（减伤%s）" % [prefix, _number(damage), _number(blocked)])
		lines.append("伤害来源\t%s → %s%s" % [source, prefix, _number(damage)])
		lines.append("%s异常\t%s" % [prefix, _status_text(new_actor)])
	return {"title": "上一回合纪要 · R%d" % round_number, "body": "\n".join(lines)}

static func _attack_result(package: Dictionary, actor_index: int, summaries: Dictionary = {}) -> String:
	if summaries.has(actor_index):
		return str((summaries[actor_index] as Dictionary).get("result", "已行动"))
	for raw_event: Variant in package.get("events", []) as Array:
		if not raw_event is Dictionary or str((raw_event as Dictionary).get("type", "")) != "actions_resolved": continue
		var payload: Dictionary = (raw_event as Dictionary).get("payload", {}) as Dictionary
		if int(payload.get("actor_index", -1)) != actor_index: continue
		for raw_trace: Variant in payload.get("trace", []) as Array:
			if raw_trace is Dictionary and str((raw_trace as Dictionary).get("tool", "")) == "evasion":
				return "未命中" if bool(((raw_trace as Dictionary).get("evasion", {}) as Dictionary).get("evaded", false)) else "命中"
		return "已行动"
	return "未行动"

## V3 round_package 将可读的行动结果放在 actions[*].result；旧 V1/离线封包
## 仍可能只有 actions_resolved event。两者都投影为玩家能理解的意图和来源。
static func _action_summaries(package: Dictionary) -> Dictionary:
	var result: Dictionary = {}
	var inputs: Dictionary = package.get("inputs", {}) as Dictionary
	var action_sources: Dictionary = package.get("action_sources", {}) as Dictionary
	for raw_action: Variant in package.get("actions", []) as Array:
		if not raw_action is Dictionary: continue
		var action: Dictionary = raw_action as Dictionary
		var side: int = int(action.get("actor_index", -1))
		if side < 0 or side > 1: continue
		var resolved: Dictionary = action.get("result", {}) as Dictionary
		var action_id: String = str(resolved.get("action_id", action.get("action_id", ""))).strip_edges()
		if action_sources.has(side): action_id = str(action_sources[side])
		if action_id.is_empty():
			var submitted: Dictionary = inputs.get(str(side), {}) as Dictionary
			var submitted_ids: Array = submitted.get("card_instance_ids", []) as Array
			if not submitted_ids.is_empty(): action_id = str(submitted_ids[0])
		if action_id.is_empty(): action_id = "未出牌" if not bool(action.get("ok", false)) else "已行动"
		var outcome: Dictionary = resolved.get("outcome", {}) as Dictionary
		var mitigation: Dictionary = resolved.get("mitigation", {}) as Dictionary
		var hp_damage: float = float(outcome.get("hp_damage", 0.0))
		var absorbed: float = float(mitigation.get("guard_absorbed", 0.0))
		var hit: bool = bool(outcome.get("hit", hp_damage > 0.0))
		var nested_actions: Array = resolved.get("actions", []) as Array
		if not nested_actions.is_empty():
			hp_damage = 0.0
			absorbed = 0.0
			hit = false
			for raw_nested: Variant in nested_actions:
				if not raw_nested is Dictionary: continue
				var nested: Dictionary = raw_nested as Dictionary
				var nested_outcome: Dictionary = nested.get("outcome", {}) as Dictionary
				hp_damage += float(nested_outcome.get("hp_damage", 0.0))
				var nested_mitigation: Dictionary = nested.get("mitigation", {}) as Dictionary
				absorbed += float(nested_mitigation.get("guard_absorbed", 0.0))
				hit = hit or bool(nested_outcome.get("hit", false))
		var result_text: String = "命中" if hit else "未命中"
		if not bool(action.get("ok", false)): result_text = "未行动（%s）" % str(action.get("cancelled_reason", "已取消"))
		var source: String = "%s（%s）" % [action_id, result_text]
		if hp_damage > 0.0: source += "，造成%s伤害" % _number(hp_damage)
		if absorbed > 0.0: source += "，护盾吸收%s" % _number(absorbed)
		result[side] = {"intent": action_id + " · " + result_text, "source": source, "result": result_text, "damage": hp_damage}
	return result

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

