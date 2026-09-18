extends SceneTree

func _initialize() -> void:
	call_deferred("_run")

func _run() -> void:
	var story: Node = get_root().get_node_or_null("StoryState")
	if story == null:
		push_error("StoryState autoload missing")
		quit(1)
		return
	story.call("begin_from_identity", {"displayName":"流程验收角色", "stats":{"cursedEnergy":120,"control":90,"martial":80,"body":100,"efficiency":75,"talent":110}})
	story.call("begin_node", "chapter1_selection")
	var packed := load("res://scenes/story/selection.tscn") as PackedScene
	var selection := packed.instantiate() as Control
	get_root().add_child(selection)
	await process_frame
	var ok := true
	var input_panel := selection.get_node_or_null("Print") as Control
	ok = ok and input_panel != null and not input_panel.visible
	ok = ok and int(selection.get("slot_index")) == 0
	for index: int in 3:
		selection.call("_confirm")
		await create_timer(1.25).timeout
		ok = ok and bool(selection.get("result_ready")) and int(selection.get("slot_index")) == index
		selection.call("_confirm")
		await create_timer(0.85).timeout
		ok = ok and is_instance_valid(selection) and int(selection.get("slot_index")) == index + 1
	if is_instance_valid(selection):
		selection.call("_set_action", "搜索")
		selection.call("_confirm")
	await create_timer(1.25).timeout
	ok = ok and is_instance_valid(selection) and bool(selection.get("result_ready")) and int(selection.get("slot_index")) == 3
	if is_instance_valid(selection): selection.call("_confirm")
	await create_timer(0.5).timeout
	var history: Array = story.get("history") as Array
	ok = ok and history.size() == 1 and str(story.get("current_node")) == "chapter1_map"
	if not history.is_empty():
		var result := history[0] as Dictionary
		ok = ok and str(result.get("node_id", "")) == "chapter1_selection"
		ok = ok and str(result.get("text", "")).contains("【早上·观察】")
		ok = ok and str(result.get("text", "")).contains("【晚上·搜索】")
	print("[%-4s] four time slots resolve through one settlement commit" % ("PASS" if ok else "FAIL"))
	print("STORY_INTERACTION_ACCEPTANCE %s" % ("PASS" if ok else "FAIL"))
	quit(0 if ok else 1)
