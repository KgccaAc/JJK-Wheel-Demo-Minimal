extends SceneTree

func _initialize() -> void:
	var story := root.get_node_or_null("StoryState") as Node
	if story == null:
		print("CHAPTER1_BATTLE_RULES_VALIDATION_ACCEPTANCE FAIL story_state_missing")
		quit(1)
	story.call("begin_from_identity", {"displayName":"战斗规则配置验收", "stats":{}, "answers":{}})
	var validation: Dictionary = story.get("chapter_validation") as Dictionary
	var errors: Array = validation.get("errors", []) as Array
	var passed := bool(validation.get("ok", false)) and errors.is_empty()
	print("CHAPTER1_BATTLE_RULES_VALIDATION_ACCEPTANCE %s errors=%s" % ["PASS" if passed else "FAIL", ";".join(errors)])
	quit(0 if passed else 1)
