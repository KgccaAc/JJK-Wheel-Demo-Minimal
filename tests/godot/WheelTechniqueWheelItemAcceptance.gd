extends SceneTree

const REGISTRY_SCRIPT: Script = preload("res://scenes/wheel/WheelTechniqueRegistry.gd")
const WHEEL_SCRIPT: Script = preload("res://scenes/wheel/wheel.gd")
const WHEEL_PATH: String = "res://data/wheels.json"

func _initialize() -> void:
	var parsed: Variant = JSON.parse_string(FileAccess.get_file_as_string(WHEEL_PATH))
	var wheels: Array = (parsed as Dictionary).get("wheels", []) as Array if parsed is Dictionary else []
	var technique_wheel: Dictionary = {}
	for raw: Variant in wheels:
		if raw is Dictionary and str((raw as Dictionary).get("title", "")) == "生得术式":
			technique_wheel = raw as Dictionary
			break
	var failures: Array[String] = []
	var items: Array = technique_wheel.get("items", []) as Array
	var wheel: Node = WHEEL_SCRIPT.new()
	for raw_item: Variant in items:
		if not raw_item is Dictionary:
			continue
		var selected: String = str((raw_item as Dictionary).get("text", "")).strip_edges()
		var resolved: Dictionary = REGISTRY_SCRIPT.resolve(selected)
		if not bool(resolved.get("ok", false)) or not bool(resolved.get("registered", false)):
			failures.append("unresolved:%s" % selected)
			continue
		if str(resolved.get("key", "")).strip_edges().is_empty():
			failures.append("empty_key:%s" % selected)
		var source_profile: Dictionary = resolved.get("sourceData", {}) as Dictionary
		if source_profile.is_empty():
			failures.append("missing_source_data:%s" % selected)
			continue
		var display_name: String = str(source_profile.get("displayName", "")).strip_edges()
		if display_name.is_empty():
			failures.append("missing_display_name:%s" % selected)
		var source_tags: Array = source_profile.get("specialHandTags", []) as Array
		var resolved_tags: Array = resolved.get("specialHandTags", []) as Array
		for raw_tag: Variant in source_tags:
			if not resolved_tags.has(raw_tag):
				failures.append("tag_loss:%s:%s" % [selected, str(raw_tag)])
		var snapshot: Dictionary = wheel.call("_technique_snapshot_bundle", {"familyInnateTechnique":selected}) as Dictionary
		if str(snapshot.get("techniqueMatchError", "")).strip_edges() != "":
			failures.append("snapshot_error:%s:%s" % [selected, str(snapshot.get("techniqueMatchError", ""))])
		if str((snapshot.get("techniqueRef", {}) as Dictionary).get("key", "")) != str(resolved.get("key", "")):
			failures.append("snapshot_key_mismatch:%s" % selected)
		var snapshot_tags: Array = snapshot.get("specialHandTags", []) as Array
		for raw_tag: Variant in resolved_tags:
			if not snapshot_tags.has(raw_tag):
				failures.append("snapshot_tag_loss:%s:%s" % [selected, str(raw_tag)])
	wheel.free()
	print("WHEEL_TECHNIQUE_WHEEL_ITEMS %s items=%d failures=%s" % ["PASS" if failures.is_empty() else "FAIL", items.size(), ";".join(failures)])
	quit(0 if failures.is_empty() else 1)
