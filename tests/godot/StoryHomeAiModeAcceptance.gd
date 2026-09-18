extends SceneTree

func _initialize() -> void:
	var story := root.get_node_or_null("StoryState") as Node
	if story == null:
		print("STORY_HOME_AI_MODE_ACCEPTANCE FAIL story_state_missing")
		quit(1)
	story.call("begin_from_identity", {"displayName":"故事设置验收角色", "stats":{}, "answers":{}})
	var home := preload("res://scenes/story/StroyHome.tscn").instantiate() as Control
	root.add_child(home)
	await process_frame
	home.call("_set_mode", "ai")
	home.call("_start_story")
	await process_frame
	var mode_ok := str(story.get("mode")) == "ai"
	print("STORY_HOME_AI_MODE_ACCEPTANCE %s mode=%s" % ["PASS" if mode_ok else "FAIL", mode_ok])
	quit(0 if mode_ok else 1)
