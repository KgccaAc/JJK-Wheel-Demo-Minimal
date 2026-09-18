extends SceneTree

const RPG_SCENE: PackedScene = preload("res://scenes/story/RPG.tscn")

func _initialize() -> void:
	var story := root.get_node_or_null("StoryState") as Node
	if story == null:
		print("CULLING_ENTRY_ACCEPTANCE FAIL story_state_missing")
		quit(1)
		return
	story.call("begin_from_identity", {"schema":"generated-character-v2", "characterId":"culling_entry", "displayName":"死灭入口验收角色", "stats":{"cursedEnergy":"B"}, "answers":{"identity":"咒术师", "familyInnateTechnique":"测试术式"}, "grade_label":"一级"})
	var gate := await _play(story, "core_culling_gate", 0)
	var participation := await _play(story, "core_culling_participation", 0)
	var post_join := await _play(story, "core_culling_post_join_gate", 0)
	var location := await _play(story, "core_culling_location", 1)
	var result_gate := await _play(story, "core_culling_result", 0)
	var result := await _play(story, "core_culling_strong_result", 0)
	var allowed := _choice_ok(gate, 0, "进入死灭回游判断", "core_culling_participation")
	var joined := _choice_ok(participation, 144, "是", "core_culling_post_join_gate") and bool((story.get("flags") as Dictionary).get("participates_culling_game", false))
	var routed := _choice_ok(post_join, 0, "进入普通地点判定", "core_culling_location")
	var located := _choice_ok(location, 55, "东京", "core_culling_result") and str((story.get("flags") as Dictionary).get("culling_location", "")) == "东京"
	var result_routed := _choice_ok(result_gate, 0, "进入常规结果", "core_culling_strong_result")
	var result_ok := _choice_ok(result, 72, "存活", "chapter1_end")
	story.call("begin_from_identity", {"schema":"generated-character-v2", "characterId":"culling_blocked", "displayName":"改写入口验收角色", "stats":{"cursedEnergy":"B"}, "answers":{"identity":"咒术师"}})
	story.call("mark_flag", "culling_game_participation_blocked", true)
	var altered := await _play(story, "core_culling_gate", 0)
	var altered_choice := await _play(story, "core_culling_altered_outcome", 2)
	var blocked_route := _choice_ok(altered, 0, "死灭回游改写后走向", "core_culling_altered_outcome")
	var altered_ok := _choice_ok(altered_choice, 0, "羂索计划被迫延期，后续事件大幅缩水", "chapter1_end")
	var passed := allowed and joined and routed and located and result_routed and result_ok and blocked_route and altered_ok
	print("CULLING_ENTRY_ACCEPTANCE %s allowed=%s joined=%s routed=%s located=%s result=%s altered=%s" % ["PASS" if passed else "FAIL", allowed, joined, routed, located, result_routed and result_ok, blocked_route and altered_ok])
	quit(0 if passed else 1)

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
