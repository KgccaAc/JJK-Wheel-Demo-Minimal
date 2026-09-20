extends SceneTree

func _initialize() -> void:
	call_deferred("_run")

func _run() -> void:
	var scene := (load("res://scenes/online/online_room.tscn") as PackedScene).instantiate() as Control
	root.add_child(scene)
	await process_frame
	scene.call("_show_server_picker")
	await process_frame
	var server_popup := scene.get_node_or_null("OnlineServerPicker") as Node
	var server_buttons: Array = server_popup.find_children("*", "BaseButton", true, false) if server_popup != null else []
	if server_popup != null: server_popup.hide()
	scene.call("_show_character_picker")
	await process_frame
	var character_popup := scene.get_node_or_null("OnlineCharacterPicker") as Node
	var character_buttons: Array = character_popup.find_children("*", "BaseButton", true, false) if character_popup != null else []
	var all_buttons: Array = []
	all_buttons.append_array(server_buttons)
	all_buttons.append_array(character_buttons)
	var invalid: Array[String] = []
	for raw: Node in all_buttons:
		if raw is Button: invalid.append(str(raw.get_path()) + ":Button")
		if raw is TextureButton and (raw as TextureButton).texture_normal == null: invalid.append(str(raw.get_path()) + ":texture_missing")
	var ok := not all_buttons.is_empty() and invalid.is_empty()
	print("ONLINE_POPUP_TEXTURE_CONTROL_ACCEPTANCE %s buttons=%d invalid=%s" % ["PASS" if ok else "FAIL", all_buttons.size(), ",".join(invalid)])
	quit(0 if ok else 1)
