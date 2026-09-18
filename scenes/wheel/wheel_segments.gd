@tool
class_name WheelSegments
extends Control

const DEFAULT_COLORS: Array[Color] = [
	Color("#315b63"),
	Color("#9b3d35"),
	Color("#b5812b"),
	Color("#344968"),
	Color("#6f4c78"),
	Color("#3f765a"),
]

@export_group("转盘内部填充")
@export_range(0.05, 0.50, 0.01) var inner_radius_ratio: float = 0.46:
	set(value):
		inner_radius_ratio = value
		queue_redraw()
@export_range(0.10, 0.95, 0.01) var label_radius_ratio: float = 0.30:
	set(value):
		label_radius_ratio = value
		queue_redraw()
@export_range(10, 48, 1) var label_font_size: int = 16:
	set(value):
		label_font_size = value
		queue_redraw()
@export_range(8, 48, 1) var min_label_font_size: int = 8:
	set(value):
		min_label_font_size = value
		queue_redraw()
@export_range(8, 72, 1) var max_label_font_size: int = 28:
	set(value):
		max_label_font_size = value
		queue_redraw()
@export var label_position_offset: Vector2 = Vector2.ZERO:
	set(value):
		label_position_offset = value
		queue_redraw()
@export var label_color: Color = Color(0.98, 0.93, 0.82, 1.0):
	set(value):
		label_color = value
		queue_redraw()

var items: Array[Dictionary] = []
var segment_count: int = 0
var _angles: Array[float] = []
var _colors: Array[Color] = []

func set_items(next_items: Array[Dictionary]) -> void:
	items = next_items.duplicate(true)
	_rebuild_segments()
	queue_redraw()

func _ready() -> void:
	_sync_pivot_to_center()
	if items.is_empty():
		set_items([
			{"text": "咒灵", "weight": 1.0},
			{"text": "咒术师", "weight": 1.0},
			{"text": "普通人", "weight": 1.0},
			{"text": "诅咒师", "weight": 1.0},
		])

func _notification(what: int) -> void:
	if what == NOTIFICATION_RESIZED:
		_sync_pivot_to_center()

func _sync_pivot_to_center() -> void:
	pivot_offset = size * 0.5

func _rebuild_segments() -> void:
	segment_count = items.size()
	_angles = preload("res://data/WheelRun.gd").angles(items)
	_colors.clear()
	for index: int in segment_count:
		_colors.append(DEFAULT_COLORS[index % DEFAULT_COLORS.size()])
func calculate_label_font_size(label_text: String, sector_ratio: float, radius: float) -> int:
	var font: Font = ThemeDB.fallback_font
	var base_size: int = clampi(label_font_size, min_label_font_size, max_label_font_size)
	var base_width: float = maxf(font.get_string_size(label_text, HORIZONTAL_ALIGNMENT_LEFT, -1.0, base_size).x, 1.0)
	var available_width: float = maxf(radius * TAU * maxf(sector_ratio, 0.01) * 0.62, 12.0)
	var scale_factor: float = minf(1.0, available_width / base_width)
	return clampi(floori(float(base_size) * scale_factor), min_label_font_size, max_label_font_size)

func calculate_label_rotation(middle_angle: float) -> float:
	var readable_angle: float = wrapf(middle_angle, -PI, PI)
	if readable_angle > PI * 0.5:
		readable_angle -= PI
	elif readable_angle < -PI * 0.5:
		readable_angle += PI
	return readable_angle

func draw_radial_text(font: Font, label_text: String, font_size: int, color: Color) -> void:
	var label_width: float = font.get_string_size(label_text, HORIZONTAL_ALIGNMENT_LEFT, -1.0, font_size).x
	draw_string(font, Vector2(-label_width * 0.5, float(font_size) * 0.35), label_text, HORIZONTAL_ALIGNMENT_LEFT, -1.0, font_size, color)

func _draw() -> void:
	if segment_count == 0 or not preload("res://data/WheelRun.gd").validate(items):
		return
	var center: Vector2 = size * 0.5
	var radius: float = minf(size.x, size.y) * inner_radius_ratio
	var font: Font = ThemeDB.fallback_font
	for index: int in segment_count:
		var start_angle: float = _angles[index]
		var end_angle: float = _angles[index + 1] if index + 1 < _angles.size() else TAU - PI / 2.0
		if end_angle <= start_angle: continue
		var points: PackedVector2Array = PackedVector2Array([center])
		var steps: int = maxi(8, ceili(absf(end_angle - start_angle) * radius / 20.0))
		for step: int in steps + 1:
			var angle: float = lerpf(start_angle, end_angle, float(step) / float(steps))
			points.append(center + Vector2(cos(angle), sin(angle)) * radius)
		draw_colored_polygon(points, _colors[index])
		var edge_end: Vector2 = center + Vector2(cos(end_angle), sin(end_angle)) * radius
		draw_line(center, edge_end, Color(0.88, 0.79, 0.62, 0.9), 2.0, true)
		var sector_ratio: float = absf(end_angle - start_angle) / TAU
		var middle_angle: float = (start_angle + end_angle) * 0.5
		var label_position: Vector2 = center + Vector2(cos(middle_angle), sin(middle_angle)) * radius * label_radius_ratio + label_position_offset
		var label_text: String = str(items[index].get("text", ""))
		var current_font_size: int = calculate_label_font_size(label_text, sector_ratio, radius)
		draw_set_transform(label_position, calculate_label_rotation(middle_angle), Vector2.ONE)
		draw_radial_text(font, label_text, current_font_size, label_color)
		draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)
