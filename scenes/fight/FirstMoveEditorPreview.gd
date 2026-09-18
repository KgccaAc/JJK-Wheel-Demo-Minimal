@tool
extends Control

const DESIGN_SIZE: Vector2 = Vector2(1672.0, 941.0)

func _notification(what: int) -> void:
	if what == NOTIFICATION_RESIZED and is_inside_tree(): _fit_content()

func _ready() -> void:
	# 姝よ妭鐐瑰彧鏈嶅姟缂栬緫鍣ㄦ帓鐗堬紱杩愯鏃跺厛鎵嬬敱Presenter瀹炰緥鍖栥€?	if not Engine.is_editor_hint():
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



