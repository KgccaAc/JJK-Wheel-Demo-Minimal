@tool
extends Control

const DESIGN_SIZE: Vector2 = Vector2(500.0, 265.0)
const SELECTION_ART_CENTER_Y_RATIO: float = 0.49575

@onready var selection_frame: TextureRect = $SelectionFrame
@onready var start_button: Button = $StartButton
@onready var register_button: Button = $RegisterButton
@onready var settings_button: Button = $SettingsButton
@onready var login_selector: OptionButton = $LoginSelector

func _ready() -> void:
	_layout_controls()

func _notification(what: int) -> void:
	if what == NOTIFICATION_RESIZED:
		_layout_controls()

func _layout_controls() -> void:
	if size.x <= 0.0 or size.y <= 0.0:
		return
	var width_scale: float = size.x / DESIGN_SIZE.x
	var height_scale: float = size.y / DESIGN_SIZE.y
	var font_scale: float = minf(width_scale, height_scale)

	start_button.position = Vector2.ZERO
	start_button.size = Vector2(size.x, 54.0 * height_scale)
	start_button.add_theme_font_size_override("font_size", roundi(18.0 * font_scale))

	register_button.position = Vector2(0.0, 58.0 * height_scale)
	register_button.size = Vector2(size.x, 48.0 * height_scale)
	register_button.add_theme_font_size_override("font_size", roundi(16.0 * font_scale))

	settings_button.position = Vector2(0.0, 110.0 * height_scale)
	settings_button.size = Vector2(size.x, 48.0 * height_scale)
	settings_button.add_theme_font_size_override("font_size", roundi(16.0 * font_scale))

	login_selector.position = Vector2(size.x * 0.256, 174.0 * height_scale)
	login_selector.size = Vector2(size.x * 0.5, 50.0 * height_scale)
	login_selector.add_theme_font_size_override("font_size", roundi(16.0 * font_scale))

	selection_frame.position.x = -size.x * 0.296
	selection_frame.size = Vector2(size.x * 1.612, 475.0 * height_scale)
	selection_frame.position.y = start_button.position.y + start_button.size.y * 0.5 - selection_frame.size.y * SELECTION_ART_CENTER_Y_RATIO



