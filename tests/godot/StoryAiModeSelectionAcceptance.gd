extends SceneTree

func _initialize() -> void:
	var story := root.get_node_or_null("StoryState") as Node
	if story == null:
		print("STORY_AI_MODE_SELECTION_ACCEPTANCE FAIL story_state_missing")
		quit(1)
	story.call("begin_from_identity", {"displayName":"AI模式验收角色", "stats":{}, "answers":{}})
	story.call("configure_story", "story", "ai")
	var selection := preload("res://scenes/story/Selection.tscn").instantiate() as Control
	root.add_child(selection)
	await process_frame
	var mode_ok := str(story.get("mode")) == "ai" and str(selection.get("action_mode")) == "ai"
	var fallback: Dictionary = selection.call("_resolve_action") as Dictionary
	var fallback_ok := not str(fallback.get("text", "")).is_empty()
	print("STORY_AI_MODE_SELECTION_ACCEPTANCE %s mode=%s fallback=%s" % ["PASS" if mode_ok and fallback_ok else "FAIL", mode_ok, fallback_ok])
	quit(0 if mode_ok and fallback_ok else 1)
