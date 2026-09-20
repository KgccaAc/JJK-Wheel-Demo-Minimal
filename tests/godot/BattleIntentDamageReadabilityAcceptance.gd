extends SceneTree

const FORMATTER_SCRIPT: Script = preload("res://battle/presentation/RoundHistoryFormatter.gd")

func _initialize() -> void:
	# 这是 V3 首回合真实 round_package 的最小形状：敌方 action 不再依赖旧
	# actions_resolved event，而是落在 actions[*].result 中。
	var package: Dictionary = {
		"round": 1,
		"round_history_before": [
			{"hp":100.0, "ce":40.0, "guard":0.0, "statuses":{}},
			{"hp":100.0, "ce":40.0, "guard":8.0, "statuses":{}}
		],
		"inputs": {
			"0": {"card_instance_ids":["p-basic-1"]},
			"1": {"card_instance_ids":["enemy-cleave-1"]}
		},
		"actions": [
			{"actor_index":0, "ok":true, "result":{"actions":[{"action_id":"punch", "values":{"raw_damage":18.0}, "outcome":{"hp_damage":12.0, "hit":true}, "mitigation":{"guard_absorbed":0.0}}]}},
			{"actor_index":1, "ok":true, "result":{"actions":[{"action_id":"enemy_cleave", "values":{"raw_damage":30.0, "scaled_damage":30.0}, "outcome":{"hit":true, "hp_damage":23.0}, "mitigation":{"guard_absorbed":7.0}}]}}
		],
		"after_state": {"actors":[
			{"hp":77.0, "ce":35.0, "guard":0.0, "statuses":{}},
			{"hp":88.0, "ce":32.0, "guard":1.0, "statuses":{}}
		]}
	}
	var summary: Dictionary = FORMATTER_SCRIPT.call("format", package) as Dictionary
	var body := str(summary.get("body", ""))
	var ok := body.contains("对方意图") and body.contains("enemy-cleave-1") and body.contains("伤害来源") and body.contains("造成23.0伤害")
	print("BATTLE_INTENT_DAMAGE_READABILITY_ACCEPTANCE %s body=%s" % ["PASS" if ok else "FAIL", body.replace("\n", " | ")])
	quit(0 if ok else 1)
