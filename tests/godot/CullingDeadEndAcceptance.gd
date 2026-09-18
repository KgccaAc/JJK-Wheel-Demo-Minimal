extends SceneTree

const RPG_SCENE: PackedScene = preload("res://scenes/story/RPG.tscn")

func _initialize() -> void:
	var story: Node = root.get_node_or_null("StoryState")
	if story == null:
		print("CULLING_DEAD_END_ACCEPTANCE FAIL story_state_missing")
		quit(1)
		return
	story.call("begin_from_identity", {"schema":"generated-character-v2", "characterId":"dead_end", "displayName":"死亡收束验收角色", "grade_label":"一级"})
	story.call("mark_flag", "protagonist_dead", true)
	story.call("begin_node", "core_culling_gate")
	var scene := RPG_SCENE.instantiate() as Control
	root.add_child(scene)
	await process_frame
	await process_frame
	var choices: Array = scene.get("choices") as Array if scene.get("choices") is Array else []
	var option_ok := choices.size() == 1 and str((choices[0] as Dictionary).get("next", "")) == "core_culling_dead_end"
	scene.call("_choose_index", 0)
	await create_timer(0.8).timeout
	var history: Array = story.get("history") as Array
	var gate_result: Dictionary = history[history.size() - 1] as Dictionary if not history.is_empty() else {}
	var dead_scene := RPG_SCENE.instantiate() as Control
	root.add_child(dead_scene)
	await process_frame
	await process_frame
	var dead_choices: Array = dead_scene.get("choices") as Array if dead_scene.get("choices") is Array else []
	var dead_option_ok := dead_choices.size() == 1 and str((dead_choices[0] as Dictionary).get("next", "")) == "chapter1_end"
	dead_scene.call("_choose_index", 0)
	await create_timer(0.8).timeout
	var passed := option_ok and dead_option_ok and str(gate_result.get("next_node", "")) == "core_culling_dead_end"
	print("CULLING_DEAD_END_ACCEPTANCE %s gate_option=%s dead_option=%s next=%s" % ["PASS" if passed else "FAIL", option_ok, dead_option_ok, str(gate_result.get("next_node", ""))])
	quit(0 if passed else 1)
