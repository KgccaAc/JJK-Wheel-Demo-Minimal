@tool
extends Control

## 独立召唤物牌面。调整根节点尺寸或实例 scale 时，内部内容保持比例。
const DESIGN_SIZE: Vector2 = Vector2(2176.0, 1536.0)

@onready var _content: Control = $PresentationRoot
@onready var _name_label: Label = $PresentationRoot/CounterName
@onready var _hp_label: Label = $PresentationRoot/HpAccount
@onready var _health_fill: ColorRect = $PresentationRoot/HealthFill

var _health_fill_max_width: float = 0.0

func _ready() -> void:
	# Enemy instances author a 180-degree PresentationRoot rotation.  A centered pivot
	# keeps that mirrored card inside its SummonedPreview root instead of rotating
	# it into negative coordinates.
	_content.pivot_offset = _content.size * 0.5
	_health_fill_max_width = maxf(_health_fill.size.x, 0.0)
	_rescale_content()

func _notification(what: int) -> void:
	if what == NOTIFICATION_RESIZED and is_node_ready():
		_rescale_content()

func _rescale_content() -> void:
	if _content == null: return
	var uniform_scale: float = minf(size.x / DESIGN_SIZE.x, size.y / DESIGN_SIZE.y)
	uniform_scale = maxf(uniform_scale, 0.001)
	_content.scale = Vector2.ONE * uniform_scale
	_content.position = Vector2((size.x - DESIGN_SIZE.x * uniform_scale) * 0.5, (size.y - DESIGN_SIZE.y * uniform_scale) * 0.5)

func bind_summon(summon: Dictionary) -> void:
	var max_hp: float = maxf(float(summon.get("max_hp", summon.get("maxHp", 1.0))), 0.001)
	var hp: float = clampf(float(summon.get("hp", max_hp)), 0.0, max_hp)
	_name_label.text = str(summon.get("name", summon.get("label", summon.get("id", "召唤物"))))
	_hp_label.text = "%s / %s" % [_format_number(hp), _format_number(max_hp)]
	var fill_width: float = _health_fill_max_width
	if fill_width <= 0.0:
		fill_width = maxf(_health_fill.size.x, 0.0)
	_health_fill.size.x = fill_width * hp / max_hp
	set_meta("summon_snapshot", summon.duplicate(true))
	var attack_label: Label = get_node_or_null("PresentationRoot/AttackValue") as Label
	var defense_label: Label = get_node_or_null("PresentationRoot/DefenseValue") as Label
	if attack_label != null: attack_label.text = _format_number(float(summon.get("attack", summon.get("attackPower", 0.0))))
	if defense_label != null: defense_label.text = _format_number(float(summon.get("defense", summon.get("defensePower", 0.0))))
	visible = hp > 0.0 and bool(summon.get("active", true))

func clear_summon() -> void:
	visible = false

func _format_number(value: float) -> String:
	return str(int(roundf(value))) if is_equal_approx(value, roundf(value)) else "%.1f" % value






