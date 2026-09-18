extends Control

const CHARACTER_SCENE_PATH := "res://scenes/fight/character_selection.tscn"
const FIRST_MOVE_SCENE_PATH := "res://scenes/fight/first_move_contest.tscn"
const PAGE_ENTRANCE: Script = preload("res://ui/PageEntrance.gd")
signal strategy_confirmed(strategy_name: String)

@onready var _options: Control = $StrategyContent/StrategyOptions
var selected_strategy := ""
var armed_strategy: String = ""
## 宓屽叆鎴樻枟鏃跺彧鍙戝懡浠わ紝鐢盤resenter绠＄悊闈㈡澘鐢熷懡鍛ㄦ湡銆?var embedded: bool = false
var _confirmed: bool = false
var _option_tweens: Dictionary = {}

func _ready() -> void:
	_ignore_decoration_input(self)
	mouse_filter = Control.MOUSE_FILTER_STOP
	for art: Node in _options.get_children():
		var button := art.get_child(0) as Button
		if button != null:
			art.set_meta("base_scale", art.scale)
			button.pressed.connect(_on_strategy_pressed.bind(button.name))
	PAGE_ENTRANCE.play(self)

func _on_strategy_pressed(strategy_name: String) -> void:
	if _confirmed: return
	var button: Button = _find_strategy_button(strategy_name)
	var art: Control = button.get_parent_control() if button != null else null
	if armed_strategy != strategy_name:
		armed_strategy = strategy_name
		for option: Node in _options.get_children():
			if option is Control:
				var base_scale: Vector2 = option.get_meta("base_scale", Vector2.ONE)
				var target_scale: Vector2 = base_scale * (1.08 if option == art else 1.0)
				if _option_tweens.has(option) and _option_tweens[option].is_valid(): _option_tweens[option].kill()
				var tween: Tween = create_tween()
				_option_tweens[option] = tween
				tween.set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
				tween.tween_property(option, "scale", target_scale, 0.16)
		return
	selected_strategy = strategy_name
	_confirmed = true
	if embedded:
		_play_confirm_transition()
	else:
		get_tree().change_scene_to_file(FIRST_MOVE_SCENE_PATH)

func _play_confirm_transition() -> void:
	# 纭鍚庡厛鏀舵潫閫夐」骞舵贰鍑猴紝閬垮厤绛栫暐瑙勫垯宸茬粡鍒囨崲浣嗙敾闈粛鍋滃湪鏃ч潰鏉裤€?	var tween: Tween = create_tween().set_parallel(true)
	tween.set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_IN_OUT)
	tween.tween_property(_options, "modulate:a", 0.0, 0.22)
	tween.tween_property(_options, "scale", Vector2(0.96, 0.96), 0.22)
	tween.finished.connect(func() -> void: strategy_confirmed.emit(selected_strategy), CONNECT_ONE_SHOT)

func _find_strategy_button(strategy_name: String) -> Button:
	for art: Node in _options.get_children():
		var button := art.get_child(0) as Button
		if button != null and button.name == strategy_name:
			return button
	return null

func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("ui_cancel"):
		get_tree().change_scene_to_file(CHARACTER_SCENE_PATH)

func _ignore_decoration_input(node: Node) -> void:
	for child: Node in node.get_children():
		if child is Control and not child is BaseButton:
			(child as Control).mouse_filter = Control.MOUSE_FILTER_IGNORE
		_ignore_decoration_input(child)



