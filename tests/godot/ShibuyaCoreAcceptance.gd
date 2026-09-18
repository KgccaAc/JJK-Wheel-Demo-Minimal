extends SceneTree

const RPG_SCENE: PackedScene = preload("res://scenes/story/RPG.tscn")

func _initialize() -> void:
	var story := root.get_node_or_null("StoryState") as Node
	if story == null:
		print("SHIBUYA_CORE_ACCEPTANCE FAIL story_state_missing")
		quit(1)
	story.call("begin_from_identity", {"schema":"generated-character-v2", "characterId":"shibuya_core", "displayName":"涩谷验收角色", "stats":{"cursedEnergy":"B"}, "answers":{"identity":"咒术师"}})
	var junpei := await _play_node(story, "core_junpei_high_school", 2)
	var participate := await _play_node(story, "core_shibuya_participation", 0)
	var faction := await _play_node(story, "core_shibuya_faction", 0)
	var opening := await _play_node(story, "core_shibuya_high_school_opening", 1)
	var impact := await _play_node(story, "core_shibuya_high_school_impact", 2)
	var passed := _choice_ok(junpei, 96, "成功拯救顺平", "core_shibuya_participation") and _choice_ok(participate, 143, "是", "core_shibuya_faction") and _choice_ok(faction, 132, "高专（抽中之后默认高专）", "core_shibuya_high_school_opening") and _choice_ok(opening, 149, "跟着虎杖一起出发", "core_shibuya_high_school_impact") and _choice_ok(impact, 148, "快人一步五条封印失败", "core_shibuya_seal_failure")
	print("SHIBUYA_CORE_ACCEPTANCE %s W96=%s W143=%s W132=%s W149=%s W148=%s current=%s" % ["PASS" if passed else "FAIL", _choice_ok(junpei, 96, "成功拯救顺平", "core_shibuya_participation"), _choice_ok(participate, 143, "是", "core_shibuya_faction"), _choice_ok(faction, 132, "高专（抽中之后默认高专）", "core_shibuya_high_school_opening"), _choice_ok(opening, 149, "跟着虎杖一起出发", "core_shibuya_high_school_impact"), _choice_ok(impact, 148, "快人一步五条封印失败", "core_shibuya_seal_failure"), str(story.get("current_node"))])
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

func _choice_ok(result: Dictionary, wheel_id: int, value: String, next_node: String) -> bool:
	var choice: Dictionary = result.get("core_choice", {}) as Dictionary
	return int(choice.get("wheel_id", 0)) == wheel_id and str(choice.get("value", "")) == value and str(result.get("next_node", "")) == next_node
