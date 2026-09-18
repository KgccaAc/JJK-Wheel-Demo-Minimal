class_name StoryTransitionService
extends Node

var _busy := false

func play(page: Node, scene_path: String, style: String = "fade") -> bool:
	if _busy or page == null or not is_instance_valid(page): return false
	_busy = true
	var overlay := ColorRect.new()
	overlay.name = "StoryTransitionOverlay"
	overlay.color = Color.BLACK if style != "flash" else Color.WHITE
	overlay.modulate.a = 0.0
	overlay.mouse_filter = Control.MOUSE_FILTER_STOP
	overlay.z_index = 999
	overlay.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	page.add_child(overlay)
	var duration := 0.08 if ClientUi.reduced_motion() else (0.22 if style != "flash" else 0.12)
	var tween := page.create_tween()
	tween.tween_property(overlay, "modulate:a", 1.0, duration)
	tween.tween_callback(func() -> void:
		_busy = false
		ClientUi.navigate(page, scene_path, true)
	)
	return true
