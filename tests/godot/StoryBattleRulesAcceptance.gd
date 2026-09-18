extends SceneTree

func _initialize() -> void:
	var story := root.get_node_or_null("StoryState") as Node
	if story == null or not story.has_method("battle_result_rules"):
		print("STORY_BATTLE_RULES_ACCEPTANCE FAIL story_state_missing")
		quit(1)
	story.call("begin_from_identity", {"displayName":"战斗规则验收", "stats":{}, "answers":{}})
	var victory := story.call("battle_result_rules", "core_battle_shibuya_sukuna", "victory", 0.75, 0.5) as Dictionary
	var retreat := story.call("battle_result_rules", "core_battle_shibuya_sukuna", "retreat", 0.75, 0.5) as Dictionary
	var v_resources: Dictionary = victory.get("resources", {}) as Dictionary
	var r_resources: Dictionary = retreat.get("resources", {}) as Dictionary
	var v_growth: Dictionary = victory.get("growth", {}) as Dictionary
	var passed := int(v_resources.get("xp", 0)) == 30 and int(r_resources.get("xp", 0)) == 8 and int(v_growth.get("咒力操纵", 0)) == 1 and int(v_resources.get("hp", 0)) == -8
	print("STORY_BATTLE_RULES_ACCEPTANCE %s victory_xp=%d retreat_xp=%d" % ["PASS" if passed else "FAIL", int(v_resources.get("xp", 0)), int(r_resources.get("xp", 0))])
	quit(0 if passed else 1)
