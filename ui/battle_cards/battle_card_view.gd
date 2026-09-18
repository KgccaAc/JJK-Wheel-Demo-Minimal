class_name BattleCardView
extends BattleHandCard

@onready var _background: TextureRect = $Background
@onready var _selection_frame: ColorRect = $SelectionFrame
@onready var _locked_overlay: ColorRect = $LockedOverlay
@onready var _lock_reason: Label = $LockedOverlay/LockReason
@onready var _card_name: Label = $ContentMargin/Content/CardName
@onready var _card_type: Label = $ContentMargin/Content/CardType
@onready var _summary: RichTextLabel = $ContentMargin/Content/Summary
@onready var _attack: Label = $ContentMargin/Content/CostRow/Attack
@onready var _defence: Label = $ContentMargin/Content/CostRow/Defence
@onready var _ce_cost: Label = $ContentMargin/Content/CostRow/CeCost
@onready var _risk_label: Label = $ContentMargin/Content/RiskLabel
@onready var _tags_label: Label = $ContentMargin/Content/TagsLabel

func _ready() -> void:
	super._ready()
	_ignore_mouse_for_visual_children(self)

func _ignore_mouse_for_visual_children(node: Node) -> void:
	for child: Node in node.get_children():
		if child is Control:
			(child as Control).mouse_filter = Control.MOUSE_FILTER_IGNORE
		_ignore_mouse_for_visual_children(child)

func bind_card(view_model: BattleCardViewModel) -> void:
	card_data = view_model.source_card.duplicate(true)
	_card_name.text = view_model.display_name
	_card_type.text = _category_label(view_model.display_category)
	_summary.text = view_model.summary
	_attack.text = _format_stat(view_model.attack_value)
	_defence.text = _format_stat(view_model.defence_value)
	_ce_cost.text = "%.0f" % view_model.ce_cost
	_risk_label.text = "风险：%s" % (view_model.risk if not view_model.risk.is_empty() else "普通")
	_tags_label.text = " · ".join(view_model.tags.slice(0, 4))
	_set_availability(view_model.availability)

func set_face_texture(texture: Texture2D) -> void:
	_background.texture = texture

func _set_availability(availability: Variant) -> void:
	var is_playable: bool = true
	var reason: String = ""
	var ui_reason: String = ""
	if availability != null:
		if availability is Dictionary:
			is_playable = bool(availability.get("playable", true))
			reason = str(availability.get("reason", ""))
			ui_reason = str(availability.get("ui_reason", ""))
		else:
			is_playable = bool(availability.playable)
			reason = str(availability.reason)
			ui_reason = str(availability.ui_reason)
	_locked_overlay.visible = not is_playable
	_lock_reason.text = ui_reason if not ui_reason.is_empty() else reason if not reason.is_empty() else "当前不可用"
	disabled = not is_playable

func _category_label(category: StringName) -> String:
	if category == &"domain": return "领域牌"
	if category == &"technique": return "术式牌"
	return "基础牌"

func _format_stat(value: float) -> String:
	if is_equal_approx(value, roundf(value)):
		return str(int(roundf(value)))
	return "%.1f" % value



