class_name PageEntrance
extends RefCounted

## 页面入口动画跟随 MenuInteractions：背景先显，页头从上方进入，
## 主体按所在左右区域进入，底栏和工具按钮只淡入。
const BACKGROUND_DURATION: float = 0.55
const HEADER_DURATION: float = 0.45
const SECTION_DURATION: float = 0.46
const FADE_DURATION: float = 0.42
const STAGGER: float = 0.07
const HEADER_OFFSET: Vector2 = Vector2(0.0, -18.0)
const SIDE_OFFSET: float = 70.0

static func play(page: Control, excluded_names: Array = [], move_content: bool = true) -> void:
	if bool(page.get_meta("page_entrance_played", false)):
		return
	page.set_meta("page_entrance_played", true)
	var background: Control = null
	var targets: Array[Dictionary] = []
	for child: Node in page.get_children():
		if not child is Control:
			continue
		var control: Control = child as Control
		if not control.visible or excluded_names.has(control.name):
			continue
		if _is_background(control):
			if background == null: background = control
			continue
		targets.append({"node":control, "role":_role_for(control), "delay":float(targets.size()) * STAGGER})
	if background != null:
		background.modulate.a = 0.0
		var background_tween: Tween = page.create_tween()
		background_tween.set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_OUT)
		background_tween.tween_property(background, "modulate:a", 1.0, BACKGROUND_DURATION)
	var content_index: int = 0
	for target: Dictionary in targets:
		var content: Control = target["node"] as Control
		var role: String = str(target["role"])
		var origin: Vector2 = content.position
		var original_scale: Vector2 = content.scale
		var offset: Vector2 = _offset_for(content, role, page.size) if move_content else Vector2.ZERO
		var duration: float = HEADER_DURATION if role == "header" else SECTION_DURATION
		if role == "fade": duration = FADE_DURATION
		content.modulate.a = 0.0
		if role == "card":
			content.pivot_offset = content.size * 0.5
			content.scale = original_scale * 0.92
		elif move_content:
			content.position = origin + offset
		var tween: Tween = page.create_tween().set_parallel(true)
		tween.set_trans(Tween.TRANS_BACK if role == "card" or role == "section" else Tween.TRANS_SINE)
		tween.set_ease(Tween.EASE_OUT)
		var delay: float = BACKGROUND_DURATION + float(content_index) * STAGGER
		tween.tween_property(content, "modulate:a", 1.0, duration).set_delay(delay)
		if role == "card":
			tween.tween_property(content, "scale", original_scale, duration).set_delay(delay)
		elif role != "fade" and move_content:
			tween.tween_property(content, "position", origin, duration).set_delay(delay)
		content_index += 1

static func _role_for(control: Control) -> String:
	var node_name: String = str(control.name).to_lower()
	if node_name.contains("bottom") or node_name.contains("footer") or node_name.contains("nav") or node_name.contains("topbar"): return "fade"
	if node_name.contains("header") or node_name.contains("title") or node_name.contains("subtitle"): return "header"
	if node_name.contains("card") or node_name.contains("grid") or node_name.contains("tab"): return "card"
	if node_name.contains("button") or node_name.contains("control"): return "fade"
	return "section"

static func _offset_for(control: Control, role: String, page_size: Vector2) -> Vector2:
	if role == "header": return HEADER_OFFSET
	if role == "fade" or role == "card": return Vector2.ZERO
	var center_x: float = control.position.x + control.size.x * 0.5
	return Vector2(-SIDE_OFFSET if center_x <= page_size.x * 0.5 else SIDE_OFFSET, 0.0)

static func _is_background(control: Control) -> bool:
	var node_name: String = String(control.name).to_lower()
	return node_name.contains("background") or node_name.contains("desk")



