class_name AppSessionService
extends Node

signal changed(snapshot: Dictionary)

var _values: Dictionary = {"session_id": "", "identity_id": "", "guest": false, "ruleset_version": "", "data_version": ""}

func set_value(key: String, value: Variant) -> void:
	if key.is_empty(): return
	_values[key] = value
	changed.emit(snapshot())

func get_value(key: String, fallback: Variant = null) -> Variant:
	return _values.get(key, fallback)

func set_context(values: Dictionary) -> void:
	for key: Variant in values: _values[str(key)] = values[key]
	changed.emit(snapshot())

func snapshot() -> Dictionary:
	return _values.duplicate(true)

func clear() -> void:
	_values = {"session_id": "", "identity_id": "", "guest": false, "ruleset_version": "", "data_version": ""}
	changed.emit(snapshot())

