extends SceneTree

const RPG_SCENE: PackedScene = preload("res://scenes/story/RPG.tscn")

func _initialize() -> void:
	var story := root.get_node_or_null("StoryState") as Node
	if story == null:
		print("CORE_CONSEQUENCE_ACCEPTANCE FAIL story_state_missing")
		quit(1)
		return
	story.call("begin_from_identity", {"schema":"generated-character-v2", "characterId":"core_consequence", "displayName":"核心后果验收角色"})
	var severe := await _play_choice(story, "core_exchange_result", 1)
	var severe_committed := str((severe.get("core_choice", {}) as Dictionary).get("value", "")) == "重伤（无法参与涩谷事变）" and bool((story.get("flags") as Dictionary).get("shibuya_participation_blocked", false))
	story.call("begin_node", "core_shibuya_participation")
	var gate_scene := RPG_SCENE.instantiate() as Control
	root.add_child(gate_scene)
	await process_frame
	await process_frame
	var gate_choices: Array = gate_scene.get("choices") as Array
	var gate_ok := gate_choices.size() == 1 and str((gate_choices[0] as Dictionary).get("id", "")) == "avoid"
	gate_scene.queue_free()
	await process_frame
	var injured := await _play_choice(story, "core_shibuya_after_state", 0)
	var injury_ok := str((injured.get("core_choice", {}) as Dictionary).get("value", "")) == "重伤存活（不能参加死灭回游）" and str(injured.get("next_node", "")) == "core_shibuya_outcome" and bool((story.get("flags") as Dictionary).get("culling_game_participation_blocked", false))
	var passed := severe_committed and gate_ok and injury_ok
	print("CORE_CONSEQUENCE_ACCEPTANCE %s severe=%s gate=%s injury=%s" % ["PASS" if passed else "FAIL", severe_committed, gate_ok, injury_ok])
	quit(0 if passed else 1)

func _play_choice(story: Node, node_id: String, choice_index: int) -> Dictionary:
	story.call("begin_node", node_id)
	var scene := RPG_SCENE.instantiate() as Control
	root.add_child(scene)
	await process_frame
	await process_frame
	var choices: Array = scene.get("choices") as Array
	if choice_index >= choices.size(): return {}
	scene.call("_choose_index", choice_index)
	await create_timer(0.8).timeout
	var history: Array = story.get("history") as Array
	return history[history.size() - 1] as Dictionary if not history.is_empty() else {}
