extends SceneTree

const STORY_STATE_SCRIPT: Script = preload("res://story/StoryState.gd")
const WHEEL_SCRIPT: Script = preload("res://scenes/wheel/wheel.gd")

func _initialize() -> void:
	var failed := false
	failed = not _test_state_commit() or failed
	failed = not _test_chapter_data() or failed
	failed = not _test_core_timeline() or failed
	failed = not _test_core_runtime_sync() or failed
	failed = not _test_wheel_snapshot_contract() or failed
	failed = not _test_scene_contracts() or failed
	print("STORY_FLOW_ACCEPTANCE %s" % ("FAIL" if failed else "PASS"))
	quit(1 if failed else 0)

func _test_state_commit() -> bool:
	var state: Node = STORY_STATE_SCRIPT.new()
	state._ready()
	state.begin_from_identity({"name":"验收角色"})
	var first: Dictionary = state.resolve_local("n1", "节点", "结果", {"xp":5, "ce":-8}, {"悟性":1}, "n2", "test")
	var second: Dictionary = state.resolve_local("n1", "节点", "重复", {"xp":99}, {}, "n2", "test")
	var unchanged_before: bool = int(state.resources.xp) == 0 and int(state.resources.ce) == 100
	var first_commit: bool = bool(state.commit_pending())
	var second_commit: bool = bool(state.commit_pending())
	var ok: bool = first == second and unchanged_before and first_commit and not second_commit and int(state.resources.xp) == 5 and int(state.resources.ce) == 92 and int(state.growth["悟性"]) == 1 and state.history.size() == 1
	print("[%-4s] pending result commits exactly once" % ("PASS" if ok else "FAIL"))
	state.free()
	return ok

func _test_core_timeline() -> bool:
	var parsed: Variant = JSON.parse_string(FileAccess.get_file_as_string("res://data/story/core-timeline-main-start-shibuya.json"))
	var ok := parsed is Dictionary
	if not ok: return false
	var data := parsed as Dictionary
	ok = ok and not bool((data.get("policy", {}) as Dictionary).get("aiMaySelect", true))
	var periods: Array = data.get("periods", []) as Array
	ok = ok and periods.size() == 3 and str((periods[0] as Dictionary).get("id", "")) == "mainStart" and str((periods[1] as Dictionary).get("id", "")) == "shibuya" and str((periods[2] as Dictionary).get("id", "")) == "cullingGame"
	var first_nodes: Array = (periods[0] as Dictionary).get("nodes", []) as Array if periods.size() > 0 else []
	var shibuya_nodes: Array = (periods[1] as Dictionary).get("nodes", []) as Array if periods.size() > 1 else []
	var culling_nodes: Array = (periods[2] as Dictionary).get("nodes", []) as Array if periods.size() > 2 else []
	ok = ok and not first_nodes.is_empty() and int((first_nodes[0] as Dictionary).get("wheelId", 0)) == 145
	var has_w143 := false
	var has_w69 := false
	for raw: Variant in shibuya_nodes:
		if raw is Dictionary:
			has_w143 = has_w143 or int((raw as Dictionary).get("wheelId", 0)) == 143
			has_w69 = has_w69 or int((raw as Dictionary).get("wheelId", 0)) == 69
	ok = ok and has_w143 and has_w69
	var has_w144 := false
	var has_w72 := false
	for raw: Variant in culling_nodes:
		if raw is Dictionary:
			has_w144 = has_w144 or int((raw as Dictionary).get("wheelId", 0)) == 144
			has_w72 = has_w72 or int((raw as Dictionary).get("wheelId", 0)) == 72
	ok = ok and has_w144 and has_w72
	print("[%-4s] core timeline preserves source wheel boundaries" % ("PASS" if ok else "FAIL"))
	return ok

func _test_core_runtime_sync() -> bool:
	var state: Node = STORY_STATE_SCRIPT.new()
	state._ready()
	var validation: Dictionary = state.get("core_timeline_validation") as Dictionary
	var ok := bool(validation.get("ok", false)) and int(validation.get("checked", 0)) >= 31
	print("[%-4s] runtime core timeline matches chapter nodes checked=%d errors=%s" % ["PASS" if ok else "FAIL", int(validation.get("checked", 0)), ",".join(validation.get("errors", []) as Array)])
	state.free()
	return ok

func _test_wheel_snapshot_contract() -> bool:
	var wheel: Node = WHEEL_SCRIPT.new()
	wheel.set("_rank_result", {"grade_label":"二级", "stats":{"cursedEnergy":"B", "control":"C", "efficiency":"C", "body":"B", "martial":"C", "talent":"A"}, "answers":{"familyInnateTechnique":"无下限术式", "identity":"咒术师"}})
	var snapshot: Dictionary = wheel.call("_wheel_rank_character_snapshot") as Dictionary
	var techniques: Array = snapshot.get("techniques", []) as Array
	var ok := not str(snapshot.get("characterId", "")).is_empty() and not techniques.is_empty() and not (snapshot.get("techniqueFamilies", []) as Array).is_empty() and not (snapshot.get("cardTags", []) as Array).is_empty() and not (snapshot.get("specialHandTags", []) as Array).is_empty()
	print("[%-4s] wheel snapshot preserves technique and hand tags" % ("PASS" if ok else "FAIL"))
	wheel.free()
	return ok

func _test_chapter_data() -> bool:
	var parsed: Variant = JSON.parse_string(FileAccess.get_file_as_string("res://data/story/chapter1.json"))
	var ok := parsed is Dictionary
	var selection: Dictionary = {}
	if ok:
		for raw: Variant in (parsed as Dictionary).get("nodes", []):
			if raw is Dictionary and str((raw as Dictionary).get("id", "")) == "chapter1_selection": selection = raw as Dictionary
	var slots: Array = selection.get("timeSlots", []) as Array
	var actions: Dictionary = selection.get("actions", {}) as Dictionary
	ok = ok and slots == ["早上", "中午", "下午", "晚上"] and actions.size() == 4
	for action: Variant in actions:
		var outcomes: Dictionary = (actions[action] as Dictionary).get("outcomes", {}) as Dictionary
		for slot: Variant in slots:
			ok = ok and outcomes.has(slot) and (outcomes[slot] as Dictionary).has("text") and (outcomes[slot] as Dictionary).has("resources")
	print("[%-4s] chapter one has four complete local time slots" % ("PASS" if ok else "FAIL"))
	return ok

func _test_scene_contracts() -> bool:
	var contracts := {
		"res://scenes/wheel/identity.tscn":["Next", "Save", "Restart"],
		"res://scenes/wheel/Select.tscn":["TextureButton", "Wheel"],
		"res://scenes/story/StroyHome.tscn":["Start", "Start2", "HardSelect/Easy", "Type/Basic"],
		"res://scenes/story/RPG.tscn":["Text/TextureButton", "Text/Choose1", "Text/Choose2"],
		"res://scenes/story/selection.tscn":["Enter", "Select/SelectView", "Model/ModelNormal"],
		"res://scenes/story/Map.tscn":["Map/Node/NodeTypeStory", "Map/Node/NodeTypeFight", "Enter"],
		"res://scenes/battle/battle_scene.tscn":["RoundSummaryPanel"],
		"res://scenes/story/settlement.tscn":["Enter", "History", "Back"]
	}
	var ok := true
	for path: String in contracts:
		var packed := load(path) as PackedScene
		if packed == null:
			ok = false
			continue
		var scene := packed.instantiate()
		for node_path: String in contracts[path]:
			if scene.get_node_or_null(node_path) == null:
				push_error("Missing %s in %s" % [node_path, path])
				ok = false
		scene.free()
	print("[%-4s] all primary scene contracts" % ("PASS" if ok else "FAIL"))
	return ok
