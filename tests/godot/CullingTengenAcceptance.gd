extends SceneTree

const RPG_SCENE: PackedScene = preload("res://scenes/story/RPG.tscn")

func _initialize() -> void:
	var story: Node = root.get_node_or_null("StoryState")
	if story == null:
		print("CULLING_TENGEN_ACCEPTANCE FAIL story_state_missing")
		quit(1)
		return
	story.call("begin_from_identity", {"schema":"generated-character-v2", "characterId":"tengen_route", "displayName":"天元守卫路线角色", "answers":{"familyInnateTechnique":"测试术式"}, "grade_label":"一级"})
	var join := await _choice(story, "core_join_high_school", 0)
	var gate := await _choice(story, "core_culling_gate", 0)
	var guard := await _choice(story, "core_culling_guard_tengen", 0)
	var result := await _choice(story, "core_culling_guard_tengen_result", 0)
	var passed := _ok(join, 145, "是", "core_high_school_campus") and _ok(gate, 0, "先处理高专守卫天元安排", "core_culling_guard_tengen") and _ok(guard, 73, "是", "core_culling_guard_tengen_result") and _ok(result, 74, "打得羂索仓皇逃窜", "core_culling_participation")
	print("CULLING_TENGEN_ACCEPTANCE %s join=%s gate=%s guard=%s result=%s" % ["PASS" if passed else "FAIL", _ok(join, 145, "是", "core_high_school_campus"), _ok(gate, 0, "先处理高专守卫天元安排", "core_culling_guard_tengen"), _ok(guard, 73, "是", "core_culling_guard_tengen_result"), _ok(result, 74, "打得羂索仓皇逃窜", "core_culling_participation")])
	quit(0 if passed else 1)

func _choice(story: Node, node_id: String, index: int) -> Dictionary:
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

func _ok(result: Dictionary, wheel_id: int, value: String, next_node: String) -> bool:
	var choice: Dictionary = result.get("core_choice", {}) as Dictionary
	return int(choice.get("wheel_id", 0)) == wheel_id and str(choice.get("value", "")) == value and str(result.get("next_node", "")) == next_node
