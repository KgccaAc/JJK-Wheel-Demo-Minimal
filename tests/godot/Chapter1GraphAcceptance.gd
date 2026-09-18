extends SceneTree

const REQUIRED_TYPES := ["rpg", "selection", "map", "random", "branch", "battle", "settlement", "end"]

func _initialize() -> void:
	var file := FileAccess.open("res://data/story/chapter1.json", FileAccess.READ)
	if file == null:
		print("CHAPTER1_GRAPH_ACCEPTANCE FAIL data_missing")
		quit(1)
		return
	var parsed: Variant = JSON.parse_string(file.get_as_text())
	if not parsed is Dictionary:
		print("CHAPTER1_GRAPH_ACCEPTANCE FAIL invalid_json")
		quit(1)
		return
	var data := parsed as Dictionary
	var by_id: Dictionary = {}
	var found_types: Dictionary = {}
	var errors: Array[String] = []
	var weighted_modifier_found := false
	for raw: Variant in (data.get("nodes", []) as Array):
		if not raw is Dictionary: continue
		var node := raw as Dictionary
		var node_id := str(node.get("id", ""))
		var node_type := str(node.get("type", ""))
		if node_id.is_empty(): errors.append("node_without_id")
		elif by_id.has(node_id): errors.append("duplicate:%s" % node_id)
		else: by_id[node_id] = node
		found_types[node_type] = true
		var scene_path := str(node.get("scene", ""))
		if not scene_path.is_empty() and not ResourceLoader.exists(scene_path): errors.append("missing_scene:%s" % node_id)
	for required_type: String in REQUIRED_TYPES:
		if not found_types.has(required_type): errors.append("missing_type:%s" % required_type)
	for node_id: Variant in by_id:
		var node: Dictionary = by_id[node_id] as Dictionary
		_validate_link(str(node.get("next", "")), "next:%s" % str(node_id), by_id, errors)
		for raw_choice: Variant in (node.get("choices", []) as Array):
			if raw_choice is Dictionary: _validate_link(str((raw_choice as Dictionary).get("next", node.get("next", ""))), "choice:%s" % str(node_id), by_id, errors)
		if str(node.get("type", "")) == "random":
			var total_weight := 0
			for raw_outcome: Variant in (node.get("outcomes", []) as Array):
				if raw_outcome is Dictionary: total_weight += maxi(0, int((raw_outcome as Dictionary).get("weight", 0)))
			if total_weight <= 0: errors.append("random_without_weight:%s" % str(node_id))
			if node_id == "core_shibuya_outcome":
				for raw_outcome: Variant in (node.get("outcomes", []) as Array):
					if raw_outcome is Dictionary and not ((raw_outcome as Dictionary).get("weightByFlag", {}) as Dictionary).is_empty(): weighted_modifier_found = true
	for raw_map: Variant in (data.get("mapNodes", []) as Array):
		if not raw_map is Dictionary: continue
		var map_node := raw_map as Dictionary
		_validate_link(str(map_node.get("node", "")), "map_node", by_id, errors)
		_validate_link(str(map_node.get("requires", "")), "map_requires", by_id, errors)
		for requirement: Variant in (map_node.get("requiresAny", []) as Array):
			_validate_link(str(requirement), "map_requires_any", by_id, errors)
	var passed := errors.is_empty()
	if not weighted_modifier_found: errors.append("weighted_outcome_without_faction_modifier")
	var final_passed := errors.is_empty()
	print("CHAPTER1_GRAPH_ACCEPTANCE %s nodes=%d types=%d errors=%s" % ["PASS" if final_passed else "FAIL", by_id.size(), found_types.size(), ",".join(errors)])
	quit(0 if final_passed else 1)

func _validate_link(target: String, source: String, by_id: Dictionary, errors: Array[String]) -> void:
	if not target.is_empty() and not by_id.has(target): errors.append("dangling_%s->%s" % [source, target])
