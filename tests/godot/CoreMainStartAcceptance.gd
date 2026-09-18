extends SceneTree

const RPG_SCENE: PackedScene = preload("res://scenes/story/RPG.tscn")

func _initialize() -> void:
	var story := root.get_node_or_null("StoryState") as Node
	if story == null:
		print("CORE_MAIN_START_ACCEPTANCE FAIL story_state_missing")
		quit(1)
	story.call("begin_from_identity", {"schema":"generated-character-v2", "characterId":"core_main_start", "displayName":"主线验收角色", "stats":{"cursedEnergy":"B"}, "answers":{"identity":"咒术师"}})
	var first := await _play_node(story, "core_join_main_team", 0)
	var second := await _play_node(story, "core_exchange_participation", 0)
	var third := await _play_node(story, "core_exchange_result", 1)
	var fourth := await _play_node(story, "core_junpei_participation", 1)
	var passed := _choice_ok(first, 36, "是", "core_exchange_participation") and _choice_ok(second, 170, "是", "core_exchange_result") and _choice_ok(third, 93, "重伤（无法参与涩谷事变）", "core_junpei_participation") and _choice_ok(fourth, 95, "和虎杖被一同派遣处理", "core_junpei_high_school")
	print("CORE_MAIN_START_ACCEPTANCE %s W36=%s W170=%s W93=%s W95=%s current=%s" % ["PASS" if passed else "FAIL", _choice_ok(first, 36, "是", "core_exchange_participation"), _choice_ok(second, 170, "是", "core_exchange_result"), _choice_ok(third, 93, "重伤（无法参与涩谷事变）", "core_junpei_participation"), _choice_ok(fourth, 95, "和虎杖被一同派遣处理", "core_junpei_high_school"), str(story.get("current_node"))])
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
