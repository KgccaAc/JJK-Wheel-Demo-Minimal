extends SceneTree

const STORY_STATE_SCRIPT: Script = preload("res://story/StoryState.gd")

func _initialize() -> void:
	var source_options: Array[String] = _wheel_145_options()
	var chapter: Dictionary = _read_json("res://data/story/chapter1.json")
	var node: Dictionary = _find_node(chapter, "core_join_high_school")
	var node_options: Array[String] = []
	for raw: Variant in node.get("choices", []) as Array:
		if raw is Dictionary:
			node_options.append(str((raw as Dictionary).get("value", "")))
	var source_ok := source_options == ["是", "否"]
	var node_ok := int(node.get("sourceWheelId", 0)) == 145 and bool(node.get("critical", false)) and not bool(node.get("aiMayResolve", true)) and node_options == source_options

	var state: Node = STORY_STATE_SCRIPT.new()
	state._ready()
	state.begin_from_identity({"displayName":"核心节点验收角色"})
	var commit_ok := false
	if state.has_method("resolve_core_choice"):
		var pending: Dictionary = state.call("resolve_core_choice", "core_join_high_school", "是否加入高专", 145, "join", "是", "决定加入高专。", "core_high_school_campus") as Dictionary
		var before_commit_empty := (state.get("core_results") as Dictionary).is_empty()
		var first_commit := bool(state.call("commit_pending"))
		var second_commit := bool(state.call("commit_pending"))
		var results: Dictionary = state.get("core_results") as Dictionary
		var saved: Dictionary = results.get("core_join_high_school", {}) as Dictionary
		commit_ok = not pending.is_empty() and before_commit_empty and first_commit and not second_commit
		commit_ok = commit_ok and int(saved.get("wheel_id", 0)) == 145 and str(saved.get("value", "")) == "是" and str(state.get("current_node")) == "core_high_school_campus"
	state.free()

	var ok := source_ok and node_ok and commit_ok
	print("[%-4s] W145 options remain source-authored and commit once" % ("PASS" if ok else "FAIL"))
	print("CORE_DECISION_ACCEPTANCE %s" % ("PASS" if ok else "FAIL"))
	quit(0 if ok else 1)

func _wheel_145_options() -> Array[String]:
	var data: Dictionary = _read_json("res://data/wheels.json")
	for raw: Variant in data.get("wheels", data.get("items", [])) as Array:
		if raw is Dictionary and int((raw as Dictionary).get("dbId", 0)) == 145:
			var result: Array[String] = []
			for item: Variant in (raw as Dictionary).get("items", []) as Array:
				if item is Dictionary:
					result.append(str((item as Dictionary).get("text", "")))
			return result
	return []

func _find_node(chapter: Dictionary, node_id: String) -> Dictionary:
	for raw: Variant in chapter.get("nodes", []) as Array:
		if raw is Dictionary and str((raw as Dictionary).get("id", "")) == node_id:
			return raw as Dictionary
	return {}

func _read_json(path: String) -> Dictionary:
	var parsed: Variant = JSON.parse_string(FileAccess.get_file_as_string(path))
	return parsed as Dictionary if parsed is Dictionary else {}
