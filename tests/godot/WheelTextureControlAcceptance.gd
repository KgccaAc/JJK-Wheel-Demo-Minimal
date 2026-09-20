extends SceneTree

const SCENE_PATH := "res://scenes/wheel/wheel.tscn"

func _initialize() -> void:
	call_deferred("_run")

func _run() -> void:
	var packed := load(SCENE_PATH) as PackedScene
	if packed == null:
		push_error("wheel_scene_load_failed")
		quit(1)
		return
	var page := packed.instantiate() as Control
	root.add_child(page)
	await process_frame
	var more := page.get_node_or_null("Header/MoreButton") as BaseButton
	var back := page.get_node_or_null("Header/BackButton") as BaseButton
	var prev := page.get_node_or_null("Header/WheelPrev") as BaseButton
	var next := page.get_node_or_null("Header/WheelNext") as BaseButton
	var failures: PackedStringArray = []
	if not (more is TextureButton): failures.append("more_button_not_texture")
	if more is TextureButton and (more as TextureButton).texture_normal == null: failures.append("more_button_missing_texture")
	if not (back is TextureButton): failures.append("back_button_not_texture")
	if back is TextureButton and (back as TextureButton).texture_normal == null: failures.append("back_button_missing_texture")
	if not (prev is TextureButton): failures.append("prev_button_not_texture")
	if prev is TextureButton and (prev as TextureButton).texture_normal == null: failures.append("prev_button_missing_texture")
	if not (next is TextureButton): failures.append("next_button_not_texture")
	if next is TextureButton and (next as TextureButton).texture_normal == null: failures.append("next_button_missing_texture")
	var passed := failures.is_empty()
	print("WHEEL_TEXTURE_CONTROL_ACCEPTANCE %s failures=%s" % ["PASS" if passed else "FAIL", failures])
	quit(0 if passed else 1)
