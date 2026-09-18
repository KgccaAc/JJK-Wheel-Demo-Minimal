class_name SpecialEffectBadge
extends TextureRect

@onready var _effect_name: Label = $EffectName

var effect_id: String = ""
var effect_data: Dictionary = {}

func bind_effect(new_effect_id: String, display_name: String, data: Dictionary) -> void:
	effect_id = new_effect_id
	effect_data = data.duplicate(true)
	var effect_name: Label = _effect_name if _effect_name != null else get_node("EffectName") as Label
	effect_name.text = display_name if not display_name.is_empty() else new_effect_id



