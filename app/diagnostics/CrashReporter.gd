extends Node

const DiagnosticBundleScript: Script = preload("res://app/diagnostics/DiagnosticBundle.gd")

func capture(reason: String, context: Dictionary = {}, stack: String = "") -> String:
	var stamp := "%s-%s" % [Time.get_unix_time_from_system(), randi()]
	var dir := "user://logs/crashes"
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(dir))
	var path := "%s/%s.json" % [dir, stamp]
	var record := {"schema": "jjk-crash-v1", "timestamp": Time.get_datetime_string_from_system(true), "reason": reason, "stack": stack, "context": context}
	var file := FileAccess.open(path, FileAccess.WRITE)
	if file: file.store_string(JSON.stringify(record, "\t")); file.close()
	var bundle: Dictionary = DiagnosticBundleScript.collect({"reason":reason, "crash_path":path, "context":context})
	return str(bundle.get("bundle_path", path))
