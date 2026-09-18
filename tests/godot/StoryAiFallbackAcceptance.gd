extends SceneTree

func _initialize() -> void:
	var story: Node = root.get_node_or_null("StoryState")
	if story == null:
		print("STORY_AI_FALLBACK_ACCEPTANCE FAIL story_state_missing")
		quit(1)
		return
	story.call("begin_from_identity", {"displayName":"AI回退验收角色", "stats":{"cursedEnergy":100}})
	story.call("begin_node", "chapter1_selection")
	var selection := (load("res://scenes/story/selection.tscn") as PackedScene).instantiate() as Control
	root.add_child(selection)
	await process_frame
	selection.set("action_mode", "ai")
	selection.call("_refresh_mode_textures")
	var input := selection.get_node_or_null("Print/Print") as TextEdit
	if input != null: input.text = "进入便利店并询问河岸传闻"
	var outcome: Dictionary = selection.call("_resolve_action") as Dictionary
	var fallback_ok := not outcome.is_empty() and not str(outcome.get("text", "")).is_empty() and str(selection.get("ai_last_status")).contains("回退")
	var visible_ok := bool((selection.get_node_or_null("Print") as Control).visible)
	var passed := fallback_ok and visible_ok
	print("STORY_AI_FALLBACK_ACCEPTANCE %s fallback=%s input_visible=%s" % ["PASS" if passed else "FAIL", fallback_ok, visible_ok])
	quit(0 if passed else 1)
