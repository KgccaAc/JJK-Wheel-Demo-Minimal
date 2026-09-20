@tool
extends RichTextLabel

## CharacterSelect 角色详情表的排版参数。
## 通过 Inspector 调整后会立即应用到编辑器预览和运行时。
@export_range(-20.0, 80.0, 1.0) var detail_line_separation: float = 10.0:
	set(value):
		detail_line_separation = value
		_apply_spacing()

@export_range(-20.0, 80.0, 1.0) var detail_paragraph_separation: float = 10.0:
	set(value):
		detail_paragraph_separation = value
		_apply_spacing()

func _ready() -> void:
	_apply_spacing()

func _apply_spacing() -> void:
	if not is_inside_tree() and not Engine.is_editor_hint():
		return
	var line_spacing: int = roundi(detail_line_separation)
	add_theme_constant_override("line_separation", line_spacing)
	# Detail is rendered as a RichTextLabel [table], whose row spacing is
	# controlled by table_v_separation rather than line_separation.
	add_theme_constant_override("table_v_separation", line_spacing)
	add_theme_constant_override("paragraph_separation", roundi(detail_paragraph_separation))


