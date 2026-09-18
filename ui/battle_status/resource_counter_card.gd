class_name ResourceCounterCard
extends Control

@onready var _counter_name: Label = $CounterName
@onready var _counter_value: Label = $CounterValue

var counter_id: String = ""

func bind_counter(new_counter_id: String, display_name: String, value: float) -> void:
	counter_id = new_counter_id
	var counter_name: Label = _counter_name if _counter_name != null else get_node("CounterName") as Label
	var counter_value: Label = _counter_value if _counter_value != null else get_node("CounterValue") as Label
	counter_name.text = display_name if not display_name.is_empty() else new_counter_id
	counter_value.text = _format_value(value)

func _format_value(value: float) -> String:
	if is_equal_approx(value, roundf(value)): return str(int(roundf(value)))
	return "%.1f" % value
