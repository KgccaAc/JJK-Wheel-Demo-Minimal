extends SceneTree

const REGISTRY_SCRIPT: Script = preload("res://scenes/wheel/WheelTechniqueRegistry.gd")
const SOURCE_PATH: String = "res://data/wheel/source/strength-v0.2-candidate.json"

func _initialize() -> void:
	print("WHEEL_TECHNIQUE_REGISTRY_COVERAGE_START")
	var file: FileAccess = FileAccess.open(SOURCE_PATH, FileAccess.READ)
	var parsed: Variant = JSON.parse_string(file.get_as_text()) if file != null else null
	var profiles: Dictionary = (parsed as Dictionary).get("techniqueProfiles", {}) as Dictionary if parsed is Dictionary else {}
	var failures: Array[String] = []
	for property: Variant in profiles:
		var source_name: String = str(property)
		var profile: Dictionary = profiles.get(source_name, {}) as Dictionary
		var display_name: String = str(profile.get("displayName", source_name))
		var resolved: Dictionary = REGISTRY_SCRIPT.resolve(source_name)
		if not bool(resolved.get("ok", false)): resolved = REGISTRY_SCRIPT.resolve(display_name)
		if not bool(resolved.get("ok", false)):
			failures.append(source_name)
	var passed: bool = failures.is_empty()
	print("WHEEL_TECHNIQUE_REGISTRY_COVERAGE %s profiles=%d unresolved=%s" % ["PASS" if passed else "FAIL", profiles.size(), ",".join(failures)])
	quit(0 if passed else 1)
