class_name BattleHandCard
extends TextureButton

signal selection_requested(card: BattleHandCard)
signal drag_started(card: BattleHandCard, mouse_position: Vector2)
signal drag_moved(card: BattleHandCard, mouse_position: Vector2)
signal drag_released(card: BattleHandCard, mouse_position: Vector2)

var card_data: Dictionary = {}
var hand_mode: StringName = &"normal"
var home_position: Vector2 = Vector2.ZERO
var is_selected: bool = false
var is_dragging: bool = false
var _press_position: Vector2 = Vector2.ZERO
var _queued_drag_position: Vector2 = Vector2.ZERO
var _drag_update_queued: bool = false

func configure(data: Dictionary, mode: StringName, home: Vector2) -> void:
	card_data = data.duplicate(true)
	hand_mode = mode
	home_position = home
	global_position = home

func _ready() -> void:
	gui_input.connect(_on_gui_input)

func _input(event: InputEvent) -> void:
	# 拖到弃牌区后鼠标会离开卡牌节点，使用全局输入保证释放事件不丢失。
	if not is_dragging:
		return
	if event is InputEventMouseMotion and Input.is_mouse_button_pressed(MOUSE_BUTTON_LEFT):
		_queue_drag_move(get_global_mouse_position())
		get_viewport().set_input_as_handled()
	elif event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT and not event.pressed:
		is_dragging = false
		drag_released.emit(self, get_global_mouse_position())
		get_viewport().set_input_as_handled()

func _on_gui_input(event: InputEvent) -> void:
	if event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT:
		if event.pressed:
			_press_position = get_global_mouse_position()
			is_dragging = false
			accept_event()
		else:
			if is_dragging:
				is_dragging = false
				drag_released.emit(self, get_global_mouse_position())
			else:
				selection_requested.emit(self)
			accept_event()
	elif event is InputEventMouseMotion and Input.is_mouse_button_pressed(MOUSE_BUTTON_LEFT):
		var mouse_position: Vector2 = get_global_mouse_position()
		if not is_dragging and mouse_position.distance_to(_press_position) >= 10.0:
			is_dragging = true
			drag_started.emit(self, mouse_position)
		if is_dragging:
			# 鼠标事件可能在单帧内堆积；只投影最后一个位置，避免长对局时
			# 对同一牌重复执行布局、调制和命中区域计算。
			_queue_drag_move(mouse_position)
			accept_event()

func _queue_drag_move(mouse_position: Vector2) -> void:
	_queued_drag_position = mouse_position
	if _drag_update_queued: return
	_drag_update_queued = true
	call_deferred("_emit_queued_drag_move")

func _emit_queued_drag_move() -> void:
	_drag_update_queued = false
	if is_dragging:
		drag_moved.emit(self, _queued_drag_position)




