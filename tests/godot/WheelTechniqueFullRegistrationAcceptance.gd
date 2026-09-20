extends SceneTree

const REGISTRY_SCRIPT: Script = preload("res://scenes/wheel/WheelTechniqueRegistry.gd")
const SOURCE_PATH := "res://data/wheel/source/strength-v0.2-candidate.json"

func _initialize() -> void:
	var parsed: Variant = JSON.parse_string(FileAccess.get_file_as_string(SOURCE_PATH))
	var profiles: Dictionary = (parsed as Dictionary).get("techniqueProfiles", {}) as Dictionary if parsed is Dictionary else {}
	var registered: Array[Dictionary] = REGISTRY_SCRIPT.list_registered()
	var failures: Array[String] = []
	if registered.size() != profiles.size(): failures.append("registered=%d profiles=%d" % [registered.size(), profiles.size()])
	for source_name: Variant in profiles.keys():
		var resolved: Dictionary = REGISTRY_SCRIPT.resolve(str(source_name))
		if not bool(resolved.get("ok", false)) or not bool(resolved.get("registered", false)):
			failures.append("unresolved:%s" % str(source_name))
			continue
		if str(resolved.get("sourceProfile", "")) != str(source_name): failures.append("source_mismatch:%s" % str(source_name))
		if (resolved.get("sourceData", {}) as Dictionary).is_empty(): failures.append("source_data_missing:%s" % str(source_name))
	for entry: Dictionary in registered:
		var stable_key: String = str(entry.get("key", "")).strip_edges()
		if stable_key.is_empty():
			failures.append("empty_registered_key:%s" % str(entry.get("sourceProfile", entry.get("name", ""))))
			continue
		var key_resolved: Dictionary = REGISTRY_SCRIPT.resolve(stable_key)
		if not bool(key_resolved.get("ok", false)) or (key_resolved.get("sourceData", {}) as Dictionary).is_empty():
			failures.append("key_not_source_backed:%s" % stable_key)
	print("WHEEL_TECHNIQUE_FULL_REGISTRATION %s profiles=%d registered=%d failures=%s" % ["PASS" if failures.is_empty() else "FAIL", profiles.size(), registered.size(), ";".join(failures)])
	quit(0 if failures.is_empty() else 1)
