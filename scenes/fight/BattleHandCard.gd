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

func _on_gui_input(event: InputEvent) -> void:
	if event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT:
		if event.pressed:
			_press_position = get_global_mouse_position()
			is_dragging = false
			accept_event()
		else:
			if is_dragging:
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
			# 榧犳爣浜嬩欢鍙兘鍦ㄥ崟甯у唴鍫嗙Н锛涘彧鎶曞奖鏈€鍚庝竴涓綅缃紝閬垮厤闀垮灞€鏃?			# 瀵瑰悓涓€鐗岄噸澶嶆墽琛屽竷灞€銆佽皟鍒跺拰鍛戒腑鍖哄煙璁＄畻銆?			_queue_drag_move(mouse_position)
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



