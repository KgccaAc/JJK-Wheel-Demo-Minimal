extends SceneTree

var story: Node
var visited: Array[String] = []

func _initialize() -> void:
	call_deferred("_run")

func _run() -> void:
	story = root.get_node_or_null("StoryState")
	if story == null:
		print("FULL_STORY_RUN_ACCEPTANCE FAIL story_state_missing")
		quit(1)
		return
	story.call("begin_from_identity", {"displayName":"全链路验收角色", "characterId":"full-run", "grade_label":"一级", "stats":{"cursedEnergy":120,"control":110,"martial":100,"body":100,"efficiency":100,"talent":100}, "techniques":[{"id":"test","name":"验收术式"}], "cardTags":["test"]})
	var ok := _chapter_one()
	# Reset into a second deterministic run so the optional hidden-wheel branch
	# is covered as well; the final run is the one that reaches the settlement.
	if ok:
		story.call("begin_from_identity", {"displayName":"全链路分支验收角色", "characterId":"full-branch-run", "grade_label":"一级", "stats":{"cursedEnergy":120,"control":110,"martial":100,"body":100,"efficiency":100,"talent":100}})
		visited.clear()
		ok = _chapter_one_optional()
	if ok: ok = _core_main_start()
	if ok: ok = _core_shibuya()
	if ok: ok = await _core_culling_and_settlement()
	var history: Array = story.get("history") as Array
	var reports := root.get_node_or_null("SettlementReportsAcceptance")
	var scene_ok := true
	var battle_count := 0
	for node_id: String in visited:
		var definition := story.call("node_definition", node_id) as Dictionary
		var scene_path := story.call("scene_for_node", node_id) as String
		if scene_path.is_empty() or not ResourceLoader.exists(scene_path): scene_ok = false
		if str(definition.get("type", "")) == "battle": battle_count += 1
	var passed := ok and scene_ok and battle_count >= 2 and str(story.get("current_node")) == "chapter1_end" and history.size() >= 20 and visited.size() >= 20
	print("FULL_STORY_RUN_ACCEPTANCE %s visited=%d history=%d battles=%d scenes=%s current=%s" % ["PASS" if passed else "FAIL", visited.size(), history.size(), battle_count, scene_ok, str(story.get("current_node"))])
	quit(0 if passed else 1)

func _chapter_one() -> bool:
	return _resolve_choice("chapter1_intro", "accept") and _resolve_selection() and _resolve_choice("chapter1_clue", "pursue") and _resolve_battle("chapter1_battle")

func _chapter_one_optional() -> bool:
	if not _resolve_choice("chapter1_intro", "accept") or not _resolve_selection(): return false
	story.call("begin_node", "chapter1_optional_event")
	if not _resolve_random("chapter1_optional_event"): return false
	if not _resolve_branch("chapter1_branch", "protect"): return false
	return _resolve_battle("chapter1_danger")

func _resolve_selection() -> bool:
	story.call("begin_node", "chapter1_selection")
	var definition := story.call("node_definition", "chapter1_selection") as Dictionary
	var actions := definition.get("actions", {}) as Dictionary
	var resources: Dictionary = {}
	var growth: Dictionary = {}
	var log: Array[String] = []
	for slot: Variant in definition.get("timeSlots", []) as Array:
		var action := actions.get("观察", {}) as Dictionary
		var outcome := (action.get("outcomes", {}) as Dictionary).get(str(slot), {}) as Dictionary
		log.append("【%s·观察】%s" % [str(slot), str(outcome.get("text", ""))])
		_merge(resources, outcome.get("resources", {}) as Dictionary)
		_merge(growth, outcome.get("growth", {}) as Dictionary)
	var result := story.call("resolve_local", "chapter1_selection", "初来乍到·一日调查", "\n".join(log), resources, growth, "chapter1_map", "hidden_wheel") as Dictionary
	if result.is_empty(): return false
	visited.append("chapter1_selection")
	return bool(story.call("commit_pending"))

func _core_main_start() -> bool:
	var route := [["core_join_high_school", "join"], ["core_high_school_campus", "tokyo"], ["core_high_school_status", "student"], ["core_join_main_team", "join"], ["core_exchange_participation", "participate"], ["core_exchange_result", "minor"], ["core_junpei_participation", "yuji"], ["core_junpei_high_school", "save_junpei"]]
	for item: Array in route:
		if not _resolve_choice(str(item[0]), str(item[1])): return false
	return _resolve_choice("core_shibuya_participation", "participate")

func _core_shibuya() -> bool:
	var route := [["core_shibuya_faction", "high_school"], ["core_shibuya_high_school_opening", "gojo_direct"]]
	for item: Array in route:
		if not _resolve_choice(str(item[0]), str(item[1])): return false
	if not _resolve_battle("core_battle_shibuya_sukuna"): return false
	var post_battle := [["core_shibuya_sukuna_line", "revive_weak"], ["core_shibuya_sukuna_revival", "slowdown"], ["core_shibuya_worldline_state", "correction"], ["core_shibuya_after_state", "survive"]]
	for item: Array in post_battle:
		if not _resolve_choice(str(item[0]), str(item[1])): return false
	return _resolve_random("core_shibuya_outcome") and _resolve_end("core_shibuya_end")

func _core_culling_and_settlement() -> bool:
	var route := [["core_culling_gate", "guard_gate"], ["core_culling_guard_tengen", "stay"], ["core_culling_guard_tengen_result", "win"], ["core_culling_participation", "join"], ["core_culling_post_join_gate", "awakening"], ["core_culling_awakening", "awaken"], ["core_culling_location", "sendai"], ["core_culling_result", "strong"]]
	for item: Array in route:
		if not _resolve_choice(str(item[0]), str(item[1])): return false
	if not _resolve_choice("core_culling_strong_result", "alive", false): return false
	var settlement := (load("res://scenes/story/settlement.tscn") as PackedScene).instantiate() as Control
	settlement.name = "SettlementReportsAcceptance"
	root.add_child(settlement)
	await process_frame
	var review := settlement.get_node_or_null("Review") as BaseButton
	return review != null and review.has_meta("settlement_review_bound") and (story.get("history") as Array).size() >= 20

func _resolve_choice(node_id: String, choice_id: String, commit: bool = true) -> bool:
	story.call("begin_node", node_id)
	var definition := story.call("node_definition", node_id) as Dictionary
	var selected: Dictionary = {}
	for raw: Variant in definition.get("choices", []) as Array:
		if raw is Dictionary and str((raw as Dictionary).get("id", "")) == choice_id:
			selected = raw as Dictionary
			break
	if selected.is_empty(): return false
	var battle_node := str(selected.get("battleNode", ""))
	var next_node := battle_node if not battle_node.is_empty() else str(selected.get("next", definition.get("next", "")))
	var result := story.call("resolve_core_choice", node_id, str(definition.get("title", node_id)), int(definition.get("sourceWheelId", 0)), choice_id, str(selected.get("value", choice_id)), str(selected.get("text", "")), next_node, selected.get("resources", {}) as Dictionary, selected.get("growth", {}) as Dictionary, selected.get("relationshipDelta", {}) as Dictionary, selected.get("npcFlags", {}) as Dictionary, selected.get("storyFlags", {}) as Dictionary, selected.get("inventoryDelta", {}) as Dictionary) as Dictionary
	if result.is_empty(): return false
	visited.append(node_id)
	if commit: return bool(story.call("commit_pending"))
	return true

func _resolve_random(node_id: String) -> bool:
	story.call("begin_node", node_id)
	var definition := story.call("node_definition", node_id) as Dictionary
	var outcomes := definition.get("outcomes", []) as Array
	if outcomes.is_empty(): return false
	var outcome := outcomes[0] as Dictionary
	var result := story.call("resolve_local", node_id, str(outcome.get("title", definition.get("title", node_id))), str(outcome.get("text", "")), outcome.get("resources", {}) as Dictionary, outcome.get("growth", {}) as Dictionary, str(outcome.get("next", definition.get("next", ""))), "hidden_wheel", outcome.get("relationshipDelta", {}) as Dictionary, outcome.get("npcFlags", {}) as Dictionary, outcome.get("storyFlags", {}) as Dictionary, outcome.get("inventoryDelta", {}) as Dictionary) as Dictionary
	if result.is_empty(): return false
	visited.append(node_id)
	return bool(story.call("commit_pending"))

func _resolve_branch(node_id: String, choice_id: String) -> bool:
	story.call("begin_node", node_id)
	var definition := story.call("node_definition", node_id) as Dictionary
	var selected: Dictionary = {}
	for raw: Variant in definition.get("choices", []) as Array:
		if raw is Dictionary and str((raw as Dictionary).get("id", "")) == choice_id:
			selected = raw as Dictionary
			break
	if selected.is_empty(): return false
	var result := story.call("resolve_local", node_id, str(definition.get("title", node_id)), str(selected.get("text", "")), selected.get("resources", {}) as Dictionary, selected.get("growth", {}) as Dictionary, str(selected.get("next", definition.get("next", ""))), "manual_branch", selected.get("relationshipDelta", {}) as Dictionary, selected.get("npcFlags", {}) as Dictionary, selected.get("storyFlags", {}) as Dictionary, selected.get("inventoryDelta", {}) as Dictionary) as Dictionary
	if result.is_empty(): return false
	visited.append(node_id)
	return bool(story.call("commit_pending"))

func _resolve_end(node_id: String) -> bool:
	story.call("begin_node", node_id)
	var definition := story.call("node_definition", node_id) as Dictionary
	var result := story.call("resolve_local", node_id, str(definition.get("title", node_id)), "阶段收束。", {}, {}, str(definition.get("next", "")), "end") as Dictionary
	if result.is_empty(): return false
	visited.append(node_id)
	return bool(story.call("commit_pending"))

func _resolve_battle(node_id: String) -> bool:
	story.call("begin_node", node_id)
	var definition := story.call("node_definition", node_id) as Dictionary
	var rules := definition.get("battleRules", {}) as Dictionary
	var rule := rules.get("victory", {}) as Dictionary
	var result := story.call("resolve_local", node_id, str(definition.get("title", node_id)), "真实战斗胜利。", rule.get("resources", {}) as Dictionary, rule.get("growth", {}) as Dictionary, str(definition.get("next", "")), "real_battle", {}, {}, {}, {}) as Dictionary
	if result.is_empty(): return false
	visited.append(node_id)
	return bool(story.call("commit_pending"))

func _merge(target: Dictionary, source: Dictionary) -> void:
	for key: Variant in source: target[str(key)] = int(target.get(str(key), 0)) + int(source[key])
