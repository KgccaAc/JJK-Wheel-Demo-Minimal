extends SceneTree

const RPG_SCENE: PackedScene = preload("res://scenes/story/RPG.tscn")

func _initialize() -> void:
	var story: Node = root.get_node_or_null("StoryState")
	if story == null:
		print("CULLING_SPECIAL_ROUTES_ACCEPTANCE FAIL story_state_missing")
		quit(1)
		return
	var weak_ok := await _weak_reincarnation_route(story)
	var special_ok := await _special_route(story)
	var passed := weak_ok and special_ok
	print("CULLING_SPECIAL_ROUTES_ACCEPTANCE %s weak_reincarnation=%s special=%s" % ["PASS" if passed else "FAIL", weak_ok, special_ok])
	quit(0 if passed else 1)

func _weak_reincarnation_route(story: Node) -> bool:
	story.call("begin_from_identity", {"schema":"generated-character-v2", "characterId":"culling_weak", "displayName":"弱者路线角色", "grade_label":"四级", "answers":{"identity":"咒术师"}})
	await _play(story, "core_culling_gate", 0)
	await _play(story, "core_culling_participation", 0)
	var gate := await _play(story, "core_culling_post_join_gate", 0)
	var awakening := await _play(story, "core_culling_awakening", 2)
	var reincarnation := await _play(story, "core_culling_reincarnation", 1)
	await _play(story, "core_culling_location", 0)
	var result_gate := await _play(story, "core_culling_result", 0)
	var result := await _play(story, "core_culling_weak_result", 0)
	var ok := _choice_ok(gate, 0, "进入术式觉醒判定", "core_culling_awakening") and _choice_ok(awakening, 54, "被受肉了", "core_culling_reincarnation") and _choice_ok(reincarnation, 70, "鹿紫云一", "core_culling_location") and _choice_ok(result_gate, 0, "进入弱者结果", "core_culling_weak_result") and _choice_ok(result, 127, "活着", "chapter1_end")
	return ok

func _special_route(story: Node) -> bool:
	story.call("begin_from_identity", {"schema":"generated-character-v2", "characterId":"culling_special", "displayName":"特级路线角色", "grade_label":"标准特级", "answers":{"identity":"咒术师", "familyInnateTechnique":"测试术式"}})
	await _play(story, "core_culling_gate", 0)
	await _play(story, "core_culling_participation", 0)
	var gate := await _play(story, "core_culling_post_join_gate", 0)
	var location := await _play(story, "core_culling_special_location", 0)
	var result_gate := await _play(story, "core_culling_result", 0)
	var result := await _play(story, "core_culling_strong_result", 0)
	var ok := _choice_ok(gate, 0, "进入特级地点判定", "core_culling_special_location") and _choice_ok(location, 107, "去东京找日车", "core_culling_result") and _choice_ok(result_gate, 0, "进入常规结果", "core_culling_strong_result") and _choice_ok(result, 72, "存活", "chapter1_end")
	return ok

func _play(story: Node, node_id: String, index: int) -> Dictionary:
	story.call("begin_node", node_id)
	var scene := RPG_SCENE.instantiate() as Control
	root.add_child(scene)
	await process_frame
	await process_frame
	var choices: Array = scene.get("choices") as Array if scene.get("choices") is Array else []
	if index >= choices.size(): return {}
	scene.call("_choose_index", index)
	await create_timer(0.8).timeout
	var history: Array = story.get("history") as Array
	return history[history.size() - 1] as Dictionary if not history.is_empty() else {}

func _choice_ok(result: Dictionary, wheel_id: int, value: String, next_node: String) -> bool:
	var choice: Dictionary = result.get("core_choice", {}) as Dictionary
	return (wheel_id == 0 or int(choice.get("wheel_id", 0)) == wheel_id) and str(choice.get("value", "")) == value and str(result.get("next_node", "")) == next_node
