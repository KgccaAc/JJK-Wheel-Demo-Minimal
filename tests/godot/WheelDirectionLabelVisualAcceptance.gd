extends SceneTree

const SCENE_PATH: String = "res://scenes/wheel/wheel.tscn"
const OUTPUT: String = "res://reports/ui-audit/screenshots/wheel-direction-real.png"

func _initialize() -> void:
	call_deferred("_run")

func _run() -> void:
	var packed: PackedScene = load(SCENE_PATH) as PackedScene
	if packed == null:
		push_error("wheel_scene_load_failed")
		quit(1)
		return
	var page: Control = packed.instantiate() as Control
	root.add_child(page)
	await process_frame
	await create_timer(0.8).timeout
	var wheel: Node = page.get_node_or_null("WheelArea/WheelSegments")
	var failures: PackedStringArray = []
	if wheel == null:
		failures.append("wheel_segments_missing")
	else:
		# Reproduce the settled/no-spin state after a previous result restores a
		# non-zero wheel rotation. Labels are rendered inside WheelSegments, so the
		# parent rotation must be included when checking their final screen angle.
		wheel.rotation = 2.36436414718628
		await process_frame
		var angles: Array = wheel.get("_angles") as Array
		for index: int in angles.size():
			var start_angle: float = float(angles[index])
			var end_angle: float = float(angles[index + 1]) if index + 1 < angles.size() else TAU - PI / 2.0
			var middle_angle: float = (start_angle + end_angle) * 0.5
			var local_rotation: float = float(wheel.call("calculate_label_rotation", middle_angle))
			var final_rotation: float = wheel.rotation + local_rotation
			if absf(final_rotation) > PI * 0.5 + 0.001 and absf(final_rotation - TAU) > PI * 0.5 + 0.001 and absf(final_rotation + TAU) > PI * 0.5 + 0.001:
				failures.append("inverted_label_%d_final_rotation_%0.3f" % [index, final_rotation])
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path("res://reports/ui-audit/screenshots"))
	var image: Image = root.get_texture().get_image()
	var save_error: Error = image.save_png(ProjectSettings.globalize_path(OUTPUT))
	if save_error != OK:
		failures.append("screenshot_save_failed")
	var passed: bool = failures.is_empty()
	print("WHEEL_DIRECTION_LABEL_VISUAL_ACCEPTANCE %s failures=%s screenshot=%s" % ["PASS" if passed else "FAIL", failures, OUTPUT])
	quit(0 if passed else 1)
