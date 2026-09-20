class_name CardTemplateRuntime
extends RefCounted

const DataRepositoryScript: Script = preload("res://battle/data/BattleDataRepository.gd")
var _data: RefCounted = DataRepositoryScript.new()

func public_playable_actions(context: String = "normal") -> Array[Dictionary]:
	var result: Array[Dictionary] = []
	var templates: Array = _data.runtime("card-templates.json").get("cards", []) as Array
	for raw: Variant in templates:
		if not raw is Dictionary: continue
		var template: Dictionary = raw as Dictionary
		if not _is_public_playable(template, context): continue
		result.append(_to_action(template))
	return result

func _is_public_playable(template: Dictionary, context: String) -> bool:
	if str(template.get("actionId", "")).is_empty(): return false
	if bool(template.get("futureTemplate", false)) or template.get("playableInHandBeta", false) != true: return false
	if not (template.get("contexts", ["normal"]) as Array).has(context): return false
	# runtime/card-templates.json 的 publicTemplatePolicy 已保证这里仅保留
	# 无角色归属的公共基础牌。较早的模板没有 handSource 字段，不能因此
	# 被错误排除并让手牌少于十张。
	var source: String = str(template.get("handSource", ""))
	if not source.is_empty() and not source.begins_with("public-baseline-"):
		return false
	return true

func _to_action(template: Dictionary) -> Dictionary:
	var action_id: String = str(template.get("actionId", ""))
	var card_id: String = str(template.get("cardId", "card_" + action_id))
	var damage: float = float(template.get("damage", 0.0))
	var block: float = float(template.get("block", 0.0))
	var atomic_effects: Array[Dictionary] = []
	if bool(template.get("exclusiveHandSelection", false)):
		# 源模板以 exclusiveHandSelection 描述单独使用；活跃战斗流程只
		# 消费 atomicEffects，因此在这里编译为统一的选择规则。
		atomic_effects.append({"tool":"selection_rule", "trigger":"availability", "target":"self", "params":{"mode":"solo", "reason":"限制使用", "detail":str(template.get("selectionLockReason", "必须单独使用"))}})
	return {
		"id": card_id,
		"actionId": action_id,
		"cardId": card_id,
		"name": str(template.get("name", action_id)),
		"type": str(template.get("cardType", "basic")),
		"cardType": str(template.get("cardType", "basic")),
		"summary": str(template.get("effectSummary", "")),
		"tags": template.get("tags", []),
		"weight": float(template.get("weight", 1.0)),
		"contexts": template.get("contexts", ["normal"]),
		"handSource": str(template.get("handSource", "public-baseline-normal-draw")),
		"playableInHandBeta": true,
		"guaranteedPerTurn": bool(template.get("guaranteedPerTurn", false)),
		"doesNotCountTowardHandLimit": bool(template.get("doesNotCountTowardHandLimit", false)),
		"ignoreHandSizeLimit": bool(template.get("ignoreHandSizeLimit", false)),
		"cost": {"ce": float(template.get("ceCost", 0.0))},
		"effect": {"damage": damage, "damageType": str(template.get("damageType", "none")), "block": block, "special":{"atomicEffects":atomic_effects}},
		"damage": damage,
		"block": block,
		"damageType": str(template.get("damageType", "none")),
		"scaling": {"source": str(template.get("scalingProfile", "physical"))},
		"scalingProfile": str(template.get("scalingProfile", "physical")),
		"accuracyProfile": str(template.get("accuracyProfile", "none")),
		"evasionAllowed": bool(template.get("evasionAllowed", damage > 0)),
		"hitRateModifier": float(template.get("hitRateModifier", 0.0)),
		"risk": str(template.get("risk", "low")),
		"rarity": str(template.get("rarity", "common")),
		"status": str(template.get("status", "CONFIRMED"))
	}

