extends SceneTree

const OUTPUT := "res://reports/ui-audit/screenshots/online-popup-real.png"
const OPEN_OUTPUT := "res://reports/ui-audit/screenshots/online-popup-real-open.png"

func _initialize() -> void:
	call_deferred("_run")

func _run() -> void:
	var scene := (load("res://scenes/online/online_room.tscn") as PackedScene).instantiate() as Control
	root.add_child(scene)
	await create_timer(0.8).timeout
	scene.call("_show_server_picker")
	for _frame in 12:
		await process_frame
		if scene.get("_server_picker") != null:
			break
	var popup := scene.get("_server_picker") as PopupPanel
	var official := popup.get_node_or_null("Options/Official") as TextureButton if popup != null else null
	var local := popup.get_node_or_null("Options/LocalMock") as TextureButton if popup != null else null
	var official_label := official.get_node_or_null("Label") as Label if official != null else null
	var official_texture_ok := official != null and official.texture_normal != null
	var local_label := local.get_node_or_null("Label") as Label if local != null else null
	var local_texture_ok := local != null and local.texture_normal != null
	var click_ok := official != null and official_label != null and official_texture_ok
	var open_screenshot_ok := _save_viewport(OPEN_OUTPUT)
	if click_ok:
		official.pressed.emit()
		await process_frame
	click_ok = click_ok and int(scene.get("_server_index")) == 1
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path("res://reports/ui-audit/screenshots"))
	var screenshot_ok := _save_viewport(OUTPUT)
	var server_index_ok := int(scene.get("_server_index")) == 1
	var ok := click_ok and server_index_ok and local_texture_ok and local_label != null and screenshot_ok
	var diagnostics := {
		"popup_found": popup != null,
		"picker_member": scene.get("_server_picker") != null,
		"popup_child_names": popup.get_children().map(func(child: Node) -> String: return str(child.name)) if popup != null else [],
		"official_found": official != null,
		"official_label": official_label.text if official_label != null else "",
		"official_texture": official_texture_ok,
		"local_found": local != null,
		"local_label": local_label.text if local_label != null else "",
		"local_texture": local_texture_ok,
		"server_index": int(scene.get("_server_index")),
		"screenshot_ok": screenshot_ok,
		"open_screenshot_ok": open_screenshot_ok,
		"popup_visible_after_click": popup != null and popup.visible,
	}
	var report := FileAccess.open("res://reports/ui-audit/online-popup-real-latest.json", FileAccess.WRITE)
	if report != null:
		report.store_string(JSON.stringify(diagnostics, "  "))
	print("ONLINE_POPUP_REAL_WINDOW_DIAGNOSTICS %s" % JSON.stringify(diagnostics))
	print("ONLINE_POPUP_REAL_WINDOW_ACCEPTANCE %s server_index=%d screenshot=%s" % ["PASS" if ok else "FAIL", int(scene.get("_server_index")), OUTPUT])
	quit(0 if ok else 1)

func _save_viewport(path: String) -> bool:
	var viewport_texture := root.get_viewport().get_texture()
	if viewport_texture == null: return false
	var image := viewport_texture.get_image()
	if image == null: return false
	return image.save_png(ProjectSettings.globalize_path(path)) == OK
