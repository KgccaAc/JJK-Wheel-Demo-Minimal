extends SceneTree

func _initialize() -> void:
	call_deferred("_run")

func _run() -> void:
	var story := root.get_node_or_null("StoryState")
	if story == null:
		_finish(false, "story_state_missing")
		return
	story.call("begin_from_identity", {
		"characterId":"identity-layout-test",
		"displayName":"禅院家旁系的超长测试姓名",
		"grade_label":"特级",
		"answers":{
			"gender":"女", "age":"刚满十八岁又三个月", "startTime":"剧情开始时期",
			"camp":"咒术师", "traits":["六眼"], "cursedTools":["狱门疆"]
		}
	})
	var identity := (load("res://scenes/wheel/identity.tscn") as PackedScene).instantiate() as Control
	root.add_child(identity)
	await process_frame
	await process_frame
	var name_label := identity.get_node_or_null("CharacterCard/Name") as Label
	var age := identity.get_node_or_null("CharacterCard/Age") as Label
	var time := identity.get_node_or_null("CharacterCard/Time") as Label
	if name_label == null or age == null or time == null:
		_finish(false, "required_control_missing")
		return
	var name_rect := name_label.get_global_rect()
	var name_readable := name_label.size.x >= 300.0 and name_label.horizontal_alignment == HORIZONTAL_ALIGNMENT_CENTER
	var metadata_separated := not age.get_global_rect().intersects(time.get_global_rect())
	var no_runtime_editor := identity.get_node_or_null("CharacterCard/Name/NameEditor") == null
	var passed := name_readable and metadata_separated and no_runtime_editor
	print("IDENTITY_LAYOUT_INTERACTION_ACCEPTANCE %s readable=%s separated=%s no_runtime_editor=%s name_rect=%s age_rect=%s time_rect=%s" % ["PASS" if passed else "FAIL", name_readable, metadata_separated, no_runtime_editor, name_rect, age.get_global_rect(), time.get_global_rect()])
	quit(0 if passed else 1)

func _click_control(control: Control) -> void:
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
	print("IDENTITY_LAYOUT_INTERACTION_ACCEPTANCE %s reason=%s" % ["PASS" if passed else "FAIL", reason])
	quit(0 if passed else 1)
