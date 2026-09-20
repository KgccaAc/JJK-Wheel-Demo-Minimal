extends HBoxContainer

const UI: Script = preload("res://ui/ClientUi.gd")
const BUTTON_TOOLTIPS: Array[String] = ["主页", "角色", "战斗", "论坛", "联机与档案"]

const NORMAL_TEXTURES: Array[Texture2D] = [
	preload("res://art/menu/未选中状态主页小标.png"), preload("res://art/menu/未选中状态角色小标.png"),
	preload("res://art/menu/未选中状态战斗小标.png"), preload("res://art/menu/未选中状态论坛小标.png"),
	preload("res://art/menu/未选中状态OC小标.png")
]
const SELECTED_TEXTURES: Array[Texture2D] = [
	preload("res://art/menu/选中状态主页小标.png"), preload("res://art/menu/选中状态角色小标.png"),
	preload("res://art/menu/选中状态战斗小标.png"), preload("res://art/menu/选中状态论坛小标.png"),
	preload("res://art/menu/选中状态OC小标.png")
]

## A navigation bar is shared by several independently laid-out pages.  A page is
## allowed to omit an entry while its layout is being revised, so these references
## must be optional instead of using `$NodeName` (which records a runtime error
## before `_ready` can make a decision).
@onready var _buttons: Array[TextureButton] = [
	get_node_or_null("HomeButton") as TextureButton,
	get_node_or_null("CharacterButton") as TextureButton,
	get_node_or_null("BattleButton") as TextureButton,
	get_node_or_null("ForumButton") as TextureButton,
	get_node_or_null("ArchiveButton") as TextureButton,
]
var _selected_index := 0

func _ready() -> void:
	for index: int in _buttons.size():
		var button: TextureButton = _buttons[index]
		if button == null: continue
		button.texture_normal = NORMAL_TEXTURES[index]
		button.tooltip_text = BUTTON_TOOLTIPS[index]
		button.pressed.connect(_on_button_pressed.bind(index))
	UI.bind_button_feedback(self)
	select(0)

func select(selected_index: int) -> void:
	_on_button_pressed(clampi(selected_index, 0, _buttons.size() - 1))

func _on_button_pressed(selected_index: int) -> void:
	_selected_index = selected_index
	for index: int in _buttons.size():
		var button: TextureButton = _buttons[index]
		if button == null: continue
		button.texture_normal = SELECTED_TEXTURES[index] if index == selected_index else NORMAL_TEXTURES[index]
		var caption := button.get_node_or_null("NavCaption") as Label
		if index == selected_index:
			if caption == null:
				caption = Label.new()
				caption.name = "NavCaption"
				button.add_child(caption)
			caption.set_anchors_and_offsets_preset(Control.PRESET_CENTER_BOTTOM)
			caption.position.y = 64.0
			caption.size = Vector2(100.0, 24.0)
			caption.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
			caption.mouse_filter = Control.MOUSE_FILTER_IGNORE
			caption.add_theme_font_size_override("font_size", 15)
			caption.add_theme_color_override("font_color", Color(0.18, 0.12, 0.22, 1.0))
			caption.text = BUTTON_TOOLTIPS[index]
			caption.visible = true
		elif caption != null:
			caption.visible = false



