@tool
extends Control

const UI: Script = preload("res://ui/ClientUi.gd")

const DESIGN_SIZE: Vector2 = Vector2(1672.0, 941.0)
const PAGE_ENTRANCE: Script = preload("res://ui/PageEntrance.gd")
@onready var _content_root: Control = $ContestContent

func _notification(what: int) -> void:
	if what == NOTIFICATION_RESIZED and is_inside_tree():
		_fit_content_to_bounds()

const STRATEGY_SCENE_PATH := "res://scenes/battle/strategy_selection.tscn"
const FIGHT_SCENE_PATH := "res://scenes/battle/battle_scene.tscn"
const UNSELECTED_TEXTURE: Texture2D = preload("res://art/fight/先手争夺/先手争夺体势投入按钮未选中.png")
const SELECTED_TEXTURE: Texture2D = preload("res://art/fight/先手争夺/先手争夺体势投入按钮选中.png")
const DEFAULT_LABEL_COLOR: Color = Color(0.4, 0.072, 0.072, 1.0)
const SELECTED_LABEL_COLOR: Color = Color.WHITE
signal contest_confirmed(option_name: String)

@onready var _choices: Control = $ContestContent/TextureRect/ChoiceButtons
var selected_option: String = ""
var embedded: bool = false
var _confirmed: bool = false
var _choice_tween: Tween
const BID_VALUES: Array[int] = [0, 10, 20, 30]

func _ready() -> void:
	_fit_content_to_bounds()
	if Engine.is_editor_hint(): return
	_ignore_decoration_input(self)
	mouse_filter = Control.MOUSE_FILTER_STOP
	var choice_index: int = 0
	for child: Node in _choices.get_children():
		if child is Button:
			(child as Button).pressed.connect(_on_option_pressed.bind(child as Button))
			_set_option_texture(child as Button, false)
			_set_option_label_color(child as Button, false)
			(child.get_node("Label") as Label).text = "投入%d体势" % BID_VALUES[choice_index]
			choice_index += 1
	PAGE_ENTRANCE.play(self)

func _fit_content_to_bounds() -> void:
	var content: Control = get_node_or_null("ContestContent") as Control
	if content == null: return
	var available: Vector2 = size
	if available.x <= 0.0 or available.y <= 0.0: return
	var factor: float = minf(available.x / DESIGN_SIZE.x, available.y / DESIGN_SIZE.y)
	content.pivot_offset = DESIGN_SIZE * 0.5
	content.scale = Vector2.ONE * factor
	content.position = (available - DESIGN_SIZE * factor) * 0.5

func _on_option_pressed(button: Button) -> void:
	if _confirmed: return
	if selected_option == button.name:
		_confirm_selected_option()
		return
	selected_option = button.name
	for child: Node in _choices.get_children():
		if child is Button:
			(child as Button).modulate = Color(1.0, 1.0, 1.0, 0.65)
			_set_option_texture(child as Button, false)
			_set_option_label_color(child as Button, false)
	button.modulate = Color.WHITE
	_set_option_texture(button, true)
	_set_option_label_color(button, true)
	_play_button_animation(button)

func _set_option_texture(button: Button, selected: bool) -> void:
	var art := button.get_node_or_null("Buttom") as TextureRect
	if art != null:
		art.texture = SELECTED_TEXTURE if selected else UNSELECTED_TEXTURE
		art.mouse_filter = Control.MOUSE_FILTER_IGNORE

func _set_option_label_color(button: Button, selected: bool) -> void:
	var label := button.get_node_or_null("Label") as Label
	if label != null:
		label.add_theme_color_override("font_color", SELECTED_LABEL_COLOR if selected else DEFAULT_LABEL_COLOR)

func _play_button_animation(button: Button) -> void:
	button.pivot_offset = button.size * 0.5
	if _choice_tween != null and _choice_tween.is_valid(): _choice_tween.kill()
	var tween: Tween = create_tween()
	_choice_tween = tween
	tween.set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	tween.tween_property(button, "scale", Vector2(1.08, 1.08), 0.10)
	tween.tween_property(button, "scale", Vector2.ONE, 0.16)

func _confirm_selected_option() -> void:
	if not _confirmed and selected_option != "":
		_confirmed = true
		if embedded:
			contest_confirmed.emit(selected_option)
		else:
			UI.navigate(self, FIGHT_SCENE_PATH)

func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("ui_cancel"):
		UI.navigate(self, STRATEGY_SCENE_PATH)

func _ignore_decoration_input(node: Node) -> void:
	for child: Node in node.get_children():
		if child is Control and not child is BaseButton:
			(child as Control).mouse_filter = Control.MOUSE_FILTER_IGNORE
		_ignore_decoration_input(child)



