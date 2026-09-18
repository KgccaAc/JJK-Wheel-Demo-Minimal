extends SceneTree

const RPG_SCENE: PackedScene = preload("res://scenes/story/RPG.tscn")

func _initialize() -> void:
	var story := root.get_node_or_null("StoryState") as Node
	if story == null:
		print("CORE_MULTI_CHOICE_ACCEPTANCE FAIL story_state_missing")
		quit(1)
	story.call("begin_from_identity", {"schema":"generated-character-v2", "characterId":"core_multi_choice", "displayName":"多选验收角色", "stats":{"cursedEnergy":"B"}, "answers":{"identity":"咒术师"}})
	story.call("begin_node", "core_high_school_campus")
	var campus := RPG_SCENE.instantiate() as Control
	root.add_child(campus)
	await process_frame
	await process_frame
	var campus_choices: Array = campus.get("choices") as Array
	var campus_extra: Array = campus.get("extra_choice_buttons") as Array
	var campus_loaded := campus_choices.size() == 3 and campus_extra.size() == 1 and str(campus_choices[2].get("label", "")) == "福冈校"
	campus.call("_choose_index", 2)
	await create_timer(0.8).timeout
	var history: Array = story.get("history") as Array
	var first: Dictionary = history[history.size() - 1] as Dictionary if not history.is_empty() else {}
	var first_choice: Dictionary = first.get("core_choice", {}) as Dictionary
	var first_passed := str(first_choice.get("wheel_id", "")) == "171" and str(first_choice.get("value", "")) == "福冈" and str(story.get("current_node")) == "core_high_school_status"
	var status := RPG_SCENE.instantiate() as Control
	root.add_child(status)
	await process_frame
	await process_frame
	var status_choices: Array = status.get("choices") as Array
	var status_extra: Array = status.get("extra_choice_buttons") as Array
	var status_loaded := status_choices.size() == 4 and status_extra.size() == 2 and str(status_choices[3].get("label", "")) == "学生"
	status.call("_choose_index", 3)
	await create_timer(0.8).timeout
	history = story.get("history") as Array
	var second: Dictionary = history[history.size() - 1] as Dictionary if not history.is_empty() else {}
	var second_choice: Dictionary = second.get("core_choice", {}) as Dictionary
	var second_passed := str(second_choice.get("wheel_id", "")) == "172" and str(second_choice.get("value", "")) == "学生" and str(story.get("current_node")) == "core_join_main_team"
	var passed := campus_loaded and first_passed and status_loaded and second_passed
	print("CORE_MULTI_CHOICE_ACCEPTANCE %s campus=%s first=%s status=%s second=%s" % ["PASS" if passed else "FAIL", campus_loaded, first_passed, status_loaded, second_passed])
	quit(0 if passed else 1)
