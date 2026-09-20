extends SceneTree

func _initialize() -> void:
	call_deferred("_run")

func _run() -> void:
	var scene := (load("res://scenes/online/online_room.tscn") as PackedScene).instantiate() as Control
	root.add_child(scene)
	await process_frame
	var button_paths := [
		"RoomPage/Header/MoreButton",
		"MatchmakingPage/Background2/Header/MoreButton",
		"TopBar/RoomTab",
		"TopBar/MatchTab",
	]
	var invalid: Array[String] = []
	for path: String in button_paths:
		var node := scene.get_node_or_null(path)
		if not node is TextureButton:
			invalid.append(path + ":not_texture_button")
			continue
		var texture := (node as TextureButton).texture_normal
		if texture == null or not str(texture.resource_path).contains("res://art/"):
			invalid.append(path + ":missing_art_texture")
	var option_paths := [
		"MatchmakingPage/Basic/InteractiveLayer/ParticipantCharacter",
		"MatchmakingPage/Basic/InteractiveLayer/ServerRegion",
	]
	for path: String in option_paths:
		var option := scene.get_node_or_null(path) as OptionButton
		if option == null:
			invalid.append(path + ":missing_option")
			continue
		var style := option.get_theme_stylebox("normal")
		if not style is StyleBoxTexture or (style as StyleBoxTexture).texture == null:
			invalid.append(path + ":missing_art_stylebox")
	print("ONLINE_STATIC_TEXTURE_CONTROL_ACCEPTANCE %s invalid=%s" % ["PASS" if invalid.is_empty() else "FAIL", invalid])
	quit(0 if invalid.is_empty() else 1)
