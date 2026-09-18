extends SceneTree

func _initialize() -> void:
	call_deferred("_run")

func _run() -> void:
	var manifest_file := FileAccess.open("res://data/story/chapter1_background_plan.json", FileAccess.READ)
	var design_file := FileAccess.open("res://docs/story/chapter1-content-design.md", FileAccess.READ)
	var dialogue_file := FileAccess.open("res://data/story/npc_dialogue.json", FileAccess.READ)
	var manifest_ok := manifest_file != null
	var design_ok := design_file != null
	var dialogue_ok := dialogue_file != null
	var background_count := 0
	var npc_route_count := 0
	if manifest_ok:
		var manifest: Variant = JSON.parse_string(manifest_file.get_as_text())
		manifest_ok = manifest is Dictionary and str((manifest as Dictionary).get("schema", "")) == "story-background-plan-v1"
		background_count = ((manifest as Dictionary).get("backgrounds", []) as Array).size() if manifest_ok else 0
		manifest_ok = manifest_ok and background_count >= 18
	if design_ok:
		var design: String = design_file.get_as_text()
		design_ok = design.contains("Galgame") and design.contains("初级术师") and design.contains("结算")
	if dialogue_ok:
		var dialogue: Variant = JSON.parse_string(dialogue_file.get_as_text())
		var routes := (dialogue as Dictionary).get("routes", {}) as Dictionary if dialogue is Dictionary else {}
		npc_route_count = routes.size()
		dialogue_ok = dialogue is Dictionary and routes.has("junior_sorcerer") and routes.has("river_witness") and routes.has("cursed_tool_trader")
	var story: Node = root.get_node_or_null("StoryState")
	var report_ok := false
	var runtime_dialogue_ok := false
	if story != null:
		story.call("begin_from_identity", {"displayName":"内容包验收角色", "characterId":"content-package", "stats":{}})
		var witness_lines: Array = story.call("npc_dialogue", "river_witness") as Array
		var trader_lines: Array = story.call("npc_dialogue", "cursed_tool_trader") as Array
		runtime_dialogue_ok = witness_lines.size() >= 2 and trader_lines.size() >= 3
		story.call("resolve_local", "chapter1_intro", "内容包验收", "内容包路径可达。", {"xp":1}, {"悟性":1}, "chapter1_selection", "acceptance")
		story.call("commit_pending")
		var character_report: Dictionary = story.call("build_character_report") as Dictionary
		var experience_report: Dictionary = story.call("build_experience_report") as Dictionary
		report_ok = character_report.has("npcStates") and int(experience_report.get("eventCount", 0)) >= 1
	var passed := manifest_ok and design_ok and dialogue_ok and runtime_dialogue_ok and report_ok
	print("CHAPTER1_CONTENT_PACKAGE_ACCEPTANCE %s backgrounds=%d routes=%d design=%s runtime_dialogue=%s reports=%s" % ["PASS" if passed else "FAIL", background_count, npc_route_count, design_ok, runtime_dialogue_ok, report_ok])
	quit(0 if passed else 1)
