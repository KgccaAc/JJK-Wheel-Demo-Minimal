extends SceneTree

const MATCH_OUTPUT := "res://reports/ui-audit/screenshots/online-matchmaking-static-real.png"
const ROOM_OUTPUT := "res://reports/ui-audit/screenshots/online-room-static-real.png"
const DIAGNOSTIC_OUTPUT := "res://reports/ui-audit/online-static-real-latest.json"
const ROOM_PAGE_ENTRANCE_SETTLE_SECONDS := 1.5
const ROOM_CONTENT_PATHS := [
	"RoomPage",
	"RoomPage/InteractiveLayer",
	"RoomPage/ServeChoose",
	"RoomPage/RoomSeeting",
	"RoomPage/Join",
]

func _initialize() -> void:
	call_deferred("_run")

func _run() -> void:
	var scene := (load("res://scenes/online/online_room.tscn") as PackedScene).instantiate() as Control
	root.add_child(scene)
	await create_timer(1.0).timeout
	var room_tab := scene.get_node_or_null("TopBar/RoomTab") as TextureButton
	var match_tab := scene.get_node_or_null("TopBar/MatchTab") as TextureButton
	var room_page := scene.get_node_or_null("RoomPage") as Control
	var match_page := scene.get_node_or_null("MatchmakingPage") as Control
	var match_character := scene.get_node_or_null("MatchmakingPage/Basic/InteractiveLayer/ParticipantCharacter") as OptionButton
	var match_server := scene.get_node_or_null("MatchmakingPage/Basic/InteractiveLayer/ServerRegion") as OptionButton
	var failures: Array[String] = []
	var settled_room_content: Array[Dictionary] = []
	_check(match_page != null and match_page.visible, "matchmaking_not_initially_visible", failures)
	_check(match_tab != null and match_tab.disabled, "match_tab_not_selected", failures)
	_check(match_character != null and match_character.get_theme_stylebox("normal") is StyleBoxTexture, "character_option_not_textured", failures)
	_check(match_server != null and match_server.get_theme_stylebox("normal") is StyleBoxTexture, "server_option_not_textured", failures)
	var match_capture := _capture(MATCH_OUTPUT)
	_check(match_capture, "matchmaking_capture_failed", failures)
	if room_tab != null:
		await _click(room_tab)
		# PageEntrance starts the room background first, then fades each content
		# section in. Capture after the longest room-page tween has completed so
		# the screenshot represents a player-visible settled state, not a frame
		# deliberately rendered transparent during page entry.
		await create_timer(ROOM_PAGE_ENTRANCE_SETTLE_SECONDS).timeout
	_check(room_page != null and room_page.visible, "room_tab_did_not_show_room_page", failures)
	_check(room_tab != null and room_tab.disabled, "room_tab_not_selected_after_click", failures)
	settled_room_content = _room_content_states(scene)
	for state: Dictionary in settled_room_content:
		var node_path: String = str(state.get("path", "unknown"))
		if node_path == "RoomPage/InteractiveLayer":
			continue # Legacy layer; current room UI is the three art-backed sections below.
		_check(bool(state.get("visible", false)), node_path + ":not_visible", failures)
		_check(float(state.get("alpha", 0.0)) >= 0.99, node_path + ":not_opaque_after_entrance", failures)
		_check(float(state.get("width", 0.0)) > 0.0 and float(state.get("height", 0.0)) > 0.0, node_path + ":empty_rect", failures)
	var room_capture := _capture(ROOM_OUTPUT)
	_check(room_capture, "room_capture_failed", failures)
	if match_tab != null:
		await _click(match_tab)
		await create_timer(0.5).timeout
	_check(match_page != null and match_page.visible, "match_tab_did_not_restore_matchmaking", failures)
	_check(match_tab != null and match_tab.disabled, "match_tab_not_selected_after_click", failures)
	_write_diagnostic({
		"schema": "online-static-real-window-v2",
		"room_page_entrance_settle_seconds": ROOM_PAGE_ENTRANCE_SETTLE_SECONDS,
		"room_content": settled_room_content,
		"failures": failures,
	})
	print("ONLINE_STATIC_CONTROLS_REAL_WINDOW_ACCEPTANCE %s failures=%s" % ["PASS" if failures.is_empty() else "FAIL", failures])
	quit(0 if failures.is_empty() else 1)

func _room_content_states(scene: Control) -> Array[Dictionary]:
	var result: Array[Dictionary] = []
	for node_path: String in ROOM_CONTENT_PATHS:
		var control := scene.get_node_or_null(node_path) as Control
		if control == null:
			result.append({"path": node_path, "exists": false})
			continue
		var rect: Rect2 = control.get_global_rect()
		result.append({
			"path": node_path,
			"exists": true,
			"visible": control.visible,
			"alpha": control.modulate.a,
			"width": rect.size.x,
			"height": rect.size.y,
			"x": rect.position.x,
			"y": rect.position.y,
		})
	return result

func _write_diagnostic(payload: Dictionary) -> void:
	var absolute_path := ProjectSettings.globalize_path(DIAGNOSTIC_OUTPUT)
	DirAccess.make_dir_recursive_absolute(absolute_path.get_base_dir())
	var file := FileAccess.open(absolute_path, FileAccess.WRITE)
	if file != null:
		file.store_string(JSON.stringify(payload, "\t") + "\n")

func _click(control: Control) -> void:
	var point := control.get_global_rect().get_center()
	var viewport := control.get_viewport()
	var motion := InputEventMouseMotion.new()
	motion.position = point
	motion.global_position = point
	viewport.push_input(motion, true)
	await process_frame
	var event := InputEventMouseButton.new()
	event.position = point
	event.global_position = point
	event.button_index = MOUSE_BUTTON_LEFT
	event.button_mask = MOUSE_BUTTON_MASK_LEFT
	event.pressed = true
	viewport.push_input(event, true)
	event = event.duplicate() as InputEventMouseButton
	event.pressed = false
	event.button_mask = 0
	viewport.push_input(event, true)
	await process_frame

func _capture(path: String) -> bool:
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path("res://reports/ui-audit/screenshots"))
	var texture := root.get_texture()
	if texture == null: return false
	var image := texture.get_image()
	if image == null: return false
	return image.save_png(ProjectSettings.globalize_path(path)) == OK

func _check(condition: bool, code: String, failures: Array[String]) -> void:
	if not condition:
		failures.append(code)
