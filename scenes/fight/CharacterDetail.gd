@tool
class_name CharacterDetail
extends RichTextLabel

## CharacterSelect 瑙掕壊璇︽儏琛ㄧ殑鎺掔増鍙傛暟銆?## 閫氳繃 Inspector 璋冩暣鍚庝細绔嬪嵆搴旂敤鍒扮紪杈戝櫒棰勮鍜岃繍琛屾椂銆?@export_range(-20.0, 80.0, 1.0) var detail_line_separation: float = 10.0:
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
