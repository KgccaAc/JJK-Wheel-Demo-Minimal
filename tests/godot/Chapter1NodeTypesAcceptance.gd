extends SceneTree

const RPG_SCENE: PackedScene = preload("res://scenes/story/RPG.tscn")

func _initialize() -> void:
	var story := root.get_node_or_null("StoryState") as Node
	if story == null:
		print("CHAPTER1_NODE_TYPES_ACCEPTANCE FAIL story_state_missing")
		quit(1)
	story.call("begin_from_identity", {"schema":"generated-character-v2", "characterId":"node_types", "displayName":"节点类型验收角色", "stats":{"cursedEnergy":"B"}, "answers":{"identity":"咒术师"}})
	var random_result := await _play_node(story, "chapter1_optional_event", 0)
	var story_flags: Dictionary = story.get("flags") as Dictionary
	var random_flag_count := int(bool(story_flags.get("river_witness_found", false))) + int(bool(story_flags.get("river_tool_obtained", false))) + int(bool(story_flags.get("river_safe_mark_seen", false)))
	var random_ok := str(random_result.get("source", "")) == "hidden_wheel" and str(random_result.get("next_node", "")) == "chapter1_branch" and not str(random_result.get("text", "")).is_empty() and random_flag_count == 1
	story.call("begin_node", "chapter1_branch")
	var branch_scene := RPG_SCENE.instantiate() as Control
	root.add_child(branch_scene)
	await process_frame
	await process_frame
	var generated_choices: Array = branch_scene.get("choices") as Array
	var has_withdraw := false
	for raw: Variant in generated_choices:
		if raw is Dictionary and str((raw as Dictionary).get("id", "")) == "withdraw": has_withdraw = true
	if not generated_choices.is_empty(): branch_scene.call("_choose_index", 0)
	await create_timer(0.8).timeout
	var history: Array = story.get("history") as Array
	var branch_result: Dictionary = history[history.size() - 1] as Dictionary if not history.is_empty() else {}
	var branch_ok := generated_choices.size() == 2 and has_withdraw and str(branch_result.get("source", "")) == "branch" and str(branch_result.get("next_node", "")) == "chapter1_danger"
	var danger_definition: Dictionary = story.call("node_definition", "chapter1_danger") as Dictionary
	var battle_ok := str(danger_definition.get("type", "")) == "battle" and str(danger_definition.get("scene", "")).contains("battle_scene")
	var passed := random_ok and branch_ok and battle_ok
	print("CHAPTER1_NODE_TYPES_ACCEPTANCE %s random=%s branch=%s danger=%s current=%s" % ["PASS" if passed else "FAIL", random_ok, branch_ok, battle_ok, str(story.get("current_node"))])
	quit(0 if passed else 1)

func _play_node(story: Node, node_id: String, option_index: int) -> Dictionary:
	story.call("begin_node", node_id)
	var scene := RPG_SCENE.instantiate() as Control
	root.add_child(scene)
	await process_frame
	await process_frame
	var choices: Array = scene.get("choices") as Array
	if option_index >= choices.size(): return {}
	scene.call("_choose_index", option_index)
	await create_timer(0.8).timeout
	var history: Array = story.get("history") as Array
	return history[history.size() - 1] as Dictionary if not history.is_empty() else {}
