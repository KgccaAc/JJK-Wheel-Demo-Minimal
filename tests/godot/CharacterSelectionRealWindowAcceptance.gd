extends SceneTree

const DEFAULT_OUTPUT := "res://reports/ui-audit/screenshots/character-selection-real-default.png"
const PICKER_OUTPUT := "res://reports/ui-audit/screenshots/character-selection-real-picker.png"
const DIAGNOSTIC_OUTPUT := "res://reports/ui-audit/character-selection-real-latest.json"

func _initialize() -> void:
	call_deferred("_run")

func _run() -> void:
	var packed := load("res://scenes/battle/character_selection.tscn") as PackedScene
	var page := packed.instantiate() as Control if packed != null else null
	var failures: Array[String] = []
	if page == null:
		failures.append("scene_load_failed")
		_finish(failures, {})
		return
	root.add_child(page)
	await create_timer(1.6).timeout
	var default_capture := _capture(DEFAULT_OUTPUT)
	if not default_capture:
		failures.append("default_capture_failed")
	var player_button := page.get_node_or_null("CharacterContent/PlayerCharacterSlots/PlayerCharacterButtonPlayerCharacterButton") as TextureButton
	if player_button == null:
		player_button = page.get_node_or_null("CharacterContent/PlayerCharacterSlots/PlayerCharacterButton") as TextureButton
	if player_button == null:
		failures.append("player_picker_button_missing")
	else:
		player_button.pressed.emit()
		await process_frame
		await create_timer(0.35).timeout
	var picker := page.get_node_or_null("CharacterBackground") as Control
	if picker == null or not picker.visible:
		failures.append("picker_not_visible")
	var picker_capture := _capture(PICKER_OUTPUT)
	if not picker_capture:
		failures.append("picker_capture_failed")
	var rows := page.get_node_or_null("CharacterBackground/CharacterScroll/CharacterList") as VBoxContainer
	if rows == null or rows.get_child_count() == 0:
		failures.append("picker_rows_missing")
	var diagnostics := {
		"schema":"character-selection-real-window-v1",
		"default_screenshot":DEFAULT_OUTPUT,
		"picker_screenshot":PICKER_OUTPUT,
		"default_capture_ok":default_capture,
		"picker_capture_ok":picker_capture,
		"picker_visible":picker != null and picker.visible,
		"row_count":rows.get_child_count() if rows != null else 0,
		"failures":failures,
	}
	var report := FileAccess.open(DIAGNOSTIC_OUTPUT, FileAccess.WRITE)
	if report != null:
		report.store_string(JSON.stringify(diagnostics, "  ") + "\n")
	_finish(failures, diagnostics)

func _capture(path: String) -> bool:
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path("res://reports/ui-audit/screenshots"))
	var viewport_texture := root.get_viewport().get_texture()
	if viewport_texture == null:
		return false
	var image := viewport_texture.get_image()
	if image == null:
		return false
	return image.save_png(ProjectSettings.globalize_path(path)) == OK

func _finish(failures: Array[String], diagnostics: Dictionary) -> void:
	print("CHARACTER_SELECTION_REAL_WINDOW_DIAGNOSTICS %s" % JSON.stringify(diagnostics))
	print("CHARACTER_SELECTION_REAL_WINDOW_ACCEPTANCE %s failures=%s" % ["PASS" if failures.is_empty() else "FAIL", failures])
	quit(0 if failures.is_empty() else 1)
