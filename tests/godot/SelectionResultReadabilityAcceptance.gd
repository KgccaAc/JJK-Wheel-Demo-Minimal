extends SceneTree

func _initialize() -> void:
	call_deferred("_run")

func _run() -> void:
	var story := root.get_node_or_null("StoryState")
	if story == null:
		_finish(false, "story_state_missing")
		return
	story.call("begin_from_identity", {"displayName":"结果阅读验收角色"})
	story.call("begin_node", "chapter1_selection")
	var selection := (load("res://scenes/story/selection.tscn") as PackedScene).instantiate() as Control
	root.add_child(selection)
	await process_frame
	var enter := selection.get_node_or_null("Enter") as BaseButton
	var detail := selection.get_node_or_null("Scene/Detail") as Label
	if enter == null or detail == null:
		_finish(false, "control_missing")
		return
	await _click(enter)
	await process_frame
	var result_text := detail.text
	var result_visible := bool(selection.get("result_ready")) and int(selection.get("slot_index")) == 0 and not result_text.is_empty()
	await create_timer(1.6).timeout
	var stayed_for_reading := is_instance_valid(selection) and bool(selection.get("result_ready")) and int(selection.get("slot_index")) == 0 and detail.text == result_text
	if stayed_for_reading:
		await _click(enter)
		await create_timer(0.05).timeout
	var advanced_by_player := is_instance_valid(selection) and not bool(selection.get("result_ready")) and int(selection.get("slot_index")) == 1
	var passed := result_visible and stayed_for_reading and advanced_by_player
	print("SELECTION_RESULT_READABILITY_ACCEPTANCE %s result=%s stayed=%s player_advanced=%s" % ["PASS" if passed else "FAIL", result_visible, stayed_for_reading, advanced_by_player])
	quit(0 if passed else 1)

func _click(control: Control) -> void:
	var point := control.get_global_rect().get_center()
	var motion := InputEventMouseMotion.new()
	motion.position = point
	motion.global_position = point
	root.push_input(motion, true)
	await process_frame
	var event := InputEventMouseButton.new()
	event.position = point
	event.global_position = point
	event.button_index = MOUSE_BUTTON_LEFT
	event.button_mask = MOUSE_BUTTON_MASK_LEFT
	event.pressed = true
	root.push_input(event, true)
	event = event.duplicate() as InputEventMouseButton
	event.pressed = false
	event.button_mask = 0
	root.push_input(event, true)

func _finish(passed: bool, reason: String) -> void:
	print("SELECTION_RESULT_READABILITY_ACCEPTANCE %s reason=%s" % ["PASS" if passed else "FAIL", reason])
	quit(0 if passed else 1)
