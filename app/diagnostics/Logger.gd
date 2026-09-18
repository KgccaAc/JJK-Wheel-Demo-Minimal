extends Node

const LOG_PATH := "user://logs/current.jsonl"

func write_log(level: String, message: String, context: Dictionary = {}) -> void:
	var record := {"timestamp": Time.get_datetime_string_from_system(true), "level": level, "source": "godot", "message": message, "context": _sanitize(context)}
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path("user://logs"))
	var file := FileAccess.open(LOG_PATH, FileAccess.READ_WRITE)
	if file == null: file = FileAccess.open(LOG_PATH, FileAccess.WRITE)
	if file:
		file.seek_end(); file.store_line(JSON.stringify(record)); file.close()

func info(message: String, context: Dictionary = {}) -> void: write_log("info", message, context)
func warning(message: String, context: Dictionary = {}) -> void: write_log("warning", message, context)

func _sanitize(value: Variant) -> Variant:
	if value is Dictionary:
		var out: Dictionary = {}
		for key: Variant in value:
			var name := str(key).to_lower()
			out[str(key)] = "[REDACTED]" if name.contains("token") or name.contains("password") else _sanitize(value[key])
		return out
	if value is Array:
		var out: Array = []
		for item: Variant in value:
			out.append(_sanitize(item))
		return out
	return value
