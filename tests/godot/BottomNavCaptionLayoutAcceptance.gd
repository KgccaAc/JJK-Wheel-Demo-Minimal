extends SceneTree

## The selected navigation icon already contains its readable page name.  A second
## page-level caption must not be injected above the nav row, where it can overlap
## a page's primary action area (for example Online Room's preparation strip).

func _initialize() -> void:
	call_deferred("_run")

func _run() -> void:
	var scene := (load("res://scenes/online/room_page.tscn") as PackedScene).instantiate() as Control
	root.add_child(scene)
	await process_frame
	await process_frame
	var nav := scene.get_node_or_null("BottomNav") as HBoxContainer
	var selected_button := nav.get_node_or_null("HomeButton") as TextureButton if nav != null else null
	var selected_caption := selected_button.get_node_or_null("NavCaption") as Label if selected_button != null else null
	var stray_caption := scene.get_node_or_null("NavCurrentLabel") as Label
	var failures: Array[String] = []
	_check(selected_caption != null and selected_caption.visible, "selected_button_caption_missing", failures)
	if selected_caption != null and selected_button != null:
		_check(selected_button.get_global_rect().encloses(selected_caption.get_global_rect()), "selected_button_caption_outside_texture", failures)
	_check(stray_caption == null, "redundant_page_level_current_caption_present", failures)
	print("BOTTOM_NAV_CAPTION_LAYOUT_ACCEPTANCE %s failures=%s" % ["PASS" if failures.is_empty() else "FAIL", failures])
	quit(0 if failures.is_empty() else 1)

func _check(condition: bool, code: String, failures: Array[String]) -> void:
	if not condition:
		failures.append(code)
