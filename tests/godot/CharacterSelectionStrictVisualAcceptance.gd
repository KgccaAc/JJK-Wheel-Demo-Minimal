extends SceneTree

## Strict visual boundary for the formal battle character-selection page.
## It rejects native grey Buttons, mojibake player-facing strings, and labels
## that escape the art-backed control that owns them.

func _initialize() -> void:
	call_deferred("_run")

func _run() -> void:
	var packed := load("res://scenes/battle/character_selection.tscn") as PackedScene
	var page := packed.instantiate() as Control if packed != null else null
	var failures: Array[String] = []
	if page == null:
		failures.append("scene_load_failed")
		print("CHARACTER_SELECTION_STRICT_VISUAL_ACCEPTANCE FAIL failures=%s" % failures)
		quit(1)
		return
	root.add_child(page)
	await process_frame
	_check_no_native_buttons(page, failures)
	_check_readable_labels(page, failures)
	_check_button_label_geometry(page, failures)
	page.call("_open_player_picker")
	await process_frame
	var rows := page.get_node_or_null("CharacterBackground/CharacterScroll/CharacterList") as VBoxContainer
	if rows == null or rows.get_child_count() == 0:
		failures.append("character_picker_rows_missing")
	else:
		for child: Node in rows.get_children():
			if not child is TextureButton:
				failures.append("picker_row_not_texture_button:%s" % child.name)
				continue
			var texture := (child as TextureButton).texture_normal
			if texture == null or not str(texture.resource_path).contains("res://art/"):
				failures.append("picker_row_missing_art_texture:%s" % child.name)
	var ok := failures.is_empty()
	print("CHARACTER_SELECTION_STRICT_VISUAL_ACCEPTANCE %s failures=%s" % ["PASS" if ok else "FAIL", failures])
	quit(0 if ok else 1)

func _check_no_native_buttons(page: Node, failures: Array[String]) -> void:
	for node: Node in page.find_children("*", "Button", true, false):
		if node is Button:
			failures.append("native_button:%s" % node.get_path())

func _check_readable_labels(page: Node, failures: Array[String]) -> void:
	for node: Node in page.find_children("*", "Label", true, false):
		var label := node as Label
		if label == null or label.text.strip_edges().is_empty():
			continue
		if label.text.contains("瑙掕壊") or label.text.contains("棰嗗煙") or label.text.contains("娓稿") or label.text.contains("鍜掓湳") or label.text.contains("瀵规墜"):
			failures.append("mojibake:%s=%s" % [node.get_path(), label.text])

func _check_button_label_geometry(page: Node, failures: Array[String]) -> void:
	for node: Node in page.find_children("*", "TextureButton", true, false):
		var button := node as TextureButton
		if button == null or button.name == "HomeButton" or button.name == "CharacterButton" or button.name == "BattleButton" or button.name == "ForumButton" or button.name == "ArchiveButton" or button.name == "UserButton":
			continue
		for child: Node in button.get_children():
			if not child is Label:
				continue
			var label := child as Label
			var button_rect := button.get_global_rect()
			var label_rect := label.get_global_rect()
			if not button_rect.encloses(label_rect):
				failures.append("label_outside_button:%s" % button.get_path())
			var visual_center := button_rect.get_center()
			# The art-backed picker texture reserves a left-side plus icon. Its
			# readable text field is intentionally shifted into the empty red body.
			if button.name == "PlayerCharacterButtonPlayerCharacterButton" or button.name == "OpponentCharacterButton":
				visual_center.x += 74.0
			var center_delta := label_rect.get_center() - visual_center
			if absf(center_delta.x) > 24.0 or absf(center_delta.y) > 18.0:
				failures.append("label_not_centered:%s delta=%s" % [button.get_path(), center_delta])
