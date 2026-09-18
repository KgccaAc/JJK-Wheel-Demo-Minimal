@tool
extends Control

const DESIGN_SIZE: Vector2 = Vector2(1672.0, 941.0)

func _notification(what: int) -> void:
	if what == NOTIFICATION_RESIZED and is_inside_tree(): _fit_content()

func _ready() -> void:
	# 此节点只服务编辑器排版；运行时先手由Presenter实例化。
	if not Engine.is_editor_hint():
		hide()
		process_mode = Node.PROCESS_MODE_DISABLED
		return
	_fit_content()

func _fit_content() -> void:
	var content: Control = get_node_or_null("FirstMoveContest") as Control
	if content == null or size.x <= 0.0 or size.y <= 0.0: return
	var factor: float = minf(size.x / DESIGN_SIZE.x, size.y / DESIGN_SIZE.y)
	content.position = (size - DESIGN_SIZE * factor) * 0.5
	content.scale = Vector2.ONE * factor




