extends SceneTree

const REQUIRED_TYPES := ["rpg", "selection", "map", "random", "branch", "battle", "settlement", "end"]

func _initialize() -> void:
	var file := FileAccess.open("res://data/story/chapter1.json", FileAccess.READ)
	if file == null:
		print("CHAPTER1_NODE_CONTRACT_ACCEPTANCE FAIL data_missing")
		quit(1)
		return
	var parsed: Variant = JSON.parse_string(file.get_as_text())
	if not parsed is Dictionary:
		print("CHAPTER1_NODE_CONTRACT_ACCEPTANCE FAIL invalid_json")
		quit(1)
		return
	var data := parsed as Dictionary
	var by_id: Dictionary = {}
	var found_types: Dictionary = {}
	var errors: Array[String] = []
	for raw: Variant in data.get("nodes", []):
		if not raw is Dictionary: continue
		var node := raw as Dictionary
		var node_id := str(node.get("id", ""))
		var node_type := str(node.get("type", ""))
		if node_id.is_empty() or by_id.has(node_id): errors.append("duplicate_or_empty:%s" % node_id)
		by_id[node_id] = node
		found_types[node_type] = true
		if str(node.get("scene", "")).is_empty(): errors.append("scene_missing:%s" % node_id)
		if node_type in ["rpg", "branch"] and (node.get("choices", []) as Array).is_empty(): errors.append("choices_missing:%s" % node_id)
		if node_type == "random" and (node.get("outcomes", []) as Array).is_empty(): errors.append("outcomes_missing:%s" % node_id)
		if bool(node.get("critical", false)) and bool(node.get("aiMayResolve", true)): errors.append("critical_ai:%s" % node_id)
	for required: String in REQUIRED_TYPES:
		if not found_types.has(required): errors.append("type_missing:%s" % required)
	var selection: Dictionary = by_id.get("chapter1_selection", {}) as Dictionary
	var action_count := 0
	for raw_action: Variant in (selection.get("actions", {}) as Dictionary).values():
		if not raw_action is Dictionary: continue
		var outcomes: Dictionary = (raw_action as Dictionary).get("outcomes", {}) as Dictionary
		action_count += outcomes.size()
		for slot: Variant in outcomes:
			var outcome := outcomes[slot] as Dictionary
			if str(outcome.get("text", "")).is_empty(): errors.append("selection_text:%s" % str(slot))
	if action_count != 16: errors.append("selection_outcomes:%d" % action_count)
	var story: Node = root.get_node_or_null("StoryState")
	if story == null:
		errors.append("story_state_missing")
	else:
		story.call("begin_from_identity", {"schema":"generated-character-v2", "characterId":"contract_check"})
		var intro_contract: Dictionary = (story.call("node_definition", "chapter1_intro").get("runtimeContract", {}) as Dictionary)
		var selection_contract: Dictionary = (story.call("node_definition", "chapter1_selection").get("runtimeContract", {}) as Dictionary)
		var battle_contract: Dictionary = (story.call("node_definition", "chapter1_battle").get("runtimeContract", {}) as Dictionary)
		if not bool(intro_contract.get("manualChoice", false)): errors.append("intro_not_manual")
		if str(selection_contract.get("resolution", "")) != "time_slot_local": errors.append("selection_contract_invalid")
		if str(battle_contract.get("resolution", "")) != "real_battle": errors.append("battle_contract_invalid")
	var passed := errors.is_empty()
	print("CHAPTER1_NODE_CONTRACT_ACCEPTANCE %s nodes=%d types=%d selection_outcomes=%d errors=%s" % ["PASS" if passed else "FAIL", by_id.size(), found_types.size(), action_count, ",".join(errors)])
	quit(0 if passed else 1)
