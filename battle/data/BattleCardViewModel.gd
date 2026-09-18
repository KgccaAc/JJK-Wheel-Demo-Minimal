class_name BattleCardViewModel
extends RefCounted

var card_id: String = ""
var action_id: String = ""
var display_name: String = ""
var summary: String = ""
var display_category: StringName = &"basic"
var attack_value: float = 0.0
var defence_value: float = 0.0
var ce_cost: float = 0.0
var risk: String = ""
var tags: Array[String] = []
var availability: Variant = null
var source_card: Dictionary = {}
## V3 preview trace. These fields are display data only; the presenter never
## recomputes damage or CE from them.
var resolved_values: Dictionary = {}
var mitigation: Dictionary = {}
var raw_damage: float = 0.0
var scaled_damage: float = 0.0
var post_modifier_damage: float = 0.0
var defense_absorbed: float = 0.0
var guard_absorbed: float = 0.0
var shield_absorbed: float = 0.0
var hp_damage: float = 0.0

