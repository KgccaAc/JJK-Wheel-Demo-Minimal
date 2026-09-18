class_name StoryStateService
extends Node

signal changed(snapshot: Dictionary)

const RESOURCE_KEYS := ["hp", "ce", "xp", "stability", "money"]
const GROWTH_KEYS := ["咒力总量", "咒力操纵", "体术", "体质", "咒力效率", "悟性"]

var resources: Dictionary = {"hp": 100, "ce": 100, "xp": 0, "stability": 100, "money": 100}
var growth: Dictionary = {"咒力总量": 0, "咒力操纵": 0, "体术": 0, "体质": 0, "咒力效率": 0, "悟性": 0}
var flags: Dictionary = {"rpg_intro_done": false, "selection_done": false, "battle_intro_done": false}
var current_node := "chapter1_intro"
var chapter := "chapter1"
var difficulty := "story"
var mode := "basic"
var run_seed: int = 0
var history: Array[Dictionary] = []
var character: Dictionary = {}
var pending_result: Dictionary = {}
var core_results: Dictionary = {}
var npc_states: Dictionary = {}
var npc_data: Dictionary = {}
var npc_dialogue_data: Dictionary = {}
var inventory: Dictionary = {}
var story_ai_provider: RefCounted
var save_version := 2
var chapter_data: Dictionary = {}
var chapter_validation: Dictionary = {"ok": false, "errors": ["not_loaded"]}
var core_timeline_validation: Dictionary = {"ok": false, "errors": ["not_loaded"]}
const SAVE_PATH := "user://story-state-v1.json"

func _ready() -> void:
	chapter_data = _load_chapter_data()
	npc_data = _load_npc_data()
	npc_dialogue_data = _load_npc_dialogue_data()
	chapter_validation = _validate_chapter_data()
	core_timeline_validation = _validate_core_timeline()

func begin_from_identity(snapshot: Dictionary = {}) -> void:
	character = snapshot.duplicate(true)
	run_seed = int(Time.get_unix_time_from_system()) ^ hash(str(snapshot.get("characterId", "")))
	resources = {"hp": 100, "ce": 100, "xp": 0, "stability": 100, "money": 100}
	var stats: Dictionary = snapshot.get("stats", snapshot.get("baseStats", {})) as Dictionary
	growth = {
		"咒力总量": int(stats.get("cursedEnergy", 0)),
		"咒力操纵": int(stats.get("control", 0)),
		"体术": int(stats.get("martial", 0)),
		"体质": int(stats.get("body", 0)),
		"咒力效率": int(stats.get("efficiency", 0)),
		"悟性": int(stats.get("talent", 0))
	}
	flags = {"rpg_intro_done": false, "selection_done": false, "battle_intro_done": false}
	var answer_map: Dictionary = snapshot.get("answers", snapshot.get("sourceAnswers", {})) as Dictionary
	flags["has_technique"] = not (snapshot.get("techniques", []) as Array).is_empty() or str(answer_map.get("hasInnateTechnique", "")) == "是" or not str(answer_map.get("familyInnateTechnique", "")).is_empty()
	var grade_label := str(snapshot.get("grade_label", snapshot.get("gradeLabel", answer_map.get("grade", ""))))
	flags["is_special_grade"] = grade_label.contains("特级") or grade_label.to_lower().contains("special")
	flags["is_weak_grade"] = grade_label in ["辅助", "四级", "三级"] or grade_label.to_lower() in ["support", "grade4", "grade3"]
	flags["culling_game_participation_blocked"] = false
	current_node = "chapter1_intro"
	history.clear()
	pending_result.clear()
	core_results.clear()
	npc_states = _default_npc_states()
	inventory.clear()
	chapter_data = _load_chapter_data()
	npc_data = _load_npc_data()
	npc_dialogue_data = _load_npc_dialogue_data()
	chapter_validation = _validate_chapter_data()
	core_timeline_validation = _validate_core_timeline()
	_emit()

func configure_story(selected_difficulty: String, selected_mode: String) -> void:
	difficulty = selected_difficulty
	mode = "ai" if selected_mode == "ai" else "basic"
	_emit()

func set_story_ai_provider(provider: RefCounted) -> void:
	## 仅替换普通节点的 AI 提案器；核心节点永远由 RPG 手动流程处理。
	story_ai_provider = provider

func get_story_ai_provider() -> RefCounted:
	return story_ai_provider

## AI is a narrative assistant for ordinary nodes. Keep state authority local:
## only whitelisted resource/growth deltas and a bounded text payload survive.
func sanitize_story_ai_outcome(raw: Dictionary) -> Dictionary:
	var clean: Dictionary = {}
	var text := str(raw.get("text", "")).strip_edges()
	if not text.is_empty(): clean["text"] = text.left(800)
	var resources_clean: Dictionary = {}
	var resources_raw: Dictionary = raw.get("resources", raw.get("resourceDelta", {})) as Dictionary
	for key: String in RESOURCE_KEYS:
		if resources_raw.has(key): resources_clean[key] = clampi(int(resources_raw[key]), -50, 50)
	if not resources_clean.is_empty(): clean["resources"] = resources_clean
	var growth_clean: Dictionary = {}
	var growth_raw: Dictionary = raw.get("growth", raw.get("growthDelta", {})) as Dictionary
	for key: String in GROWTH_KEYS:
		if growth_raw.has(key): growth_clean[key] = clampi(int(growth_raw[key]), -3, 3)
	if not growth_clean.is_empty(): clean["growth"] = growth_clean
	return clean

## Read-only end-of-run reports. They are built from committed state so a report
## can never grant rewards, advance a node, or alter a relationship.
func build_character_report() -> Dictionary:
	var npc_report: Dictionary = {}
	for npc_id: Variant in npc_states:
		npc_report[str(npc_id)] = (npc_states[npc_id] as Dictionary).duplicate(true)
	return {
		"displayName": str(character.get("displayName", "未命名角色")),
		"character": character.duplicate(true),
		"resources": resources.duplicate(true),
		"growth": growth.duplicate(true),
		"inventory": inventory.duplicate(true),
		"npcStates": npc_report,
		"flags": flags.duplicate(true),
		"coreResults": core_results.duplicate(true),
		"chapter": chapter,
		"difficulty": difficulty,
		"mode": mode
	}

func build_experience_report() -> Dictionary:
	var events: Array[Dictionary] = []
	for item: Variant in history:
		if item is Dictionary:
			events.append((item as Dictionary).duplicate(true))
	return {
		"chapter": chapter,
		"eventCount": events.size(),
		"events": events,
		"currentNode": current_node,
		"terminal": bool(flags.get("run_terminal", false))
	}

func generate_story_novel() -> Dictionary:
	var context := {
		"character": character.duplicate(true),
		"resources": resources.duplicate(true),
		"growth": growth.duplicate(true),
		"history": history.duplicate(true),
		"npcStates": npc_states.duplicate(true),
		"chapter": chapter
	}
	if story_ai_provider != null and story_ai_provider.has_method("generate_novel"):
		var proposal: Dictionary = story_ai_provider.generate_novel(context) as Dictionary
		if bool(proposal.get("ok", false)) and not str(proposal.get("text", "")).strip_edges().is_empty():
			return {"ok":true, "source":"ai", "text":str(proposal.get("text", "")).left(20000)}
	return {"ok":true, "source":"local", "text":_generate_local_story_novel()}

func _generate_local_story_novel() -> String:
	var name := str(character.get("displayName", "无名术师"))
	var lines: Array[String] = ["《%s：%s》" % [name, chapter], "", "第一节　被撕开的日常", "%s 的故事从一场无法解释的记忆断片开始。" % name]
	for index: int in history.size():
		var event := history[index] as Dictionary
		var title := str(event.get("title", "未命名经历"))
		var text := str(event.get("text", "本次经历没有留下文字记录。"))
		var source := str(event.get("source", "local"))
		lines.append("")
		lines.append("第%d幕　%s" % [index + 1, title])
		lines.append(text)
		if source == "hidden_wheel": lines.append("命运在看不见的转盘上偏转了一格。")
		elif source == "real_battle" or source == "battle": lines.append("这一次，答案由真正的战斗写下。")
	var npc_lines: Array[String] = []
	for npc_id: Variant in npc_states:
		var state := npc_states[npc_id] as Dictionary
		if bool(state.get("companion", false)):
			npc_lines.append("%s 成为了同行者。" % str(npc_id))
	if not npc_lines.is_empty():
		lines.append("")
		lines.append("同行者")
		lines.append("\n".join(npc_lines))
	lines.append("")
	lines.append("尾声")
	lines.append("经历被保存为一条仍在继续的时间线。当前节点：%s。" % current_node)
	return "\n".join(lines)

func clear_run() -> void:
	resources = {"hp": 100, "ce": 100, "xp": 0, "stability": 100, "money": 100}
	growth = {"咒力总量": 0, "咒力操纵": 0, "体术": 0, "体质": 0, "咒力效率": 0, "悟性": 0}
	flags = {"rpg_intro_done": false, "selection_done": false, "battle_intro_done": false}
	current_node = "chapter1_intro"
	run_seed = 0
	history.clear()
	character.clear()
	pending_result.clear()
	core_results.clear()
	npc_states = _default_npc_states()
	inventory.clear()
	_emit()

func node_definition(node_id: String) -> Dictionary:
	for raw: Variant in chapter_data.get("nodes", []):
		if raw is Dictionary and str((raw as Dictionary).get("id", "")) == node_id:
			var definition := (raw as Dictionary).duplicate(true)
			definition["runtimeContract"] = node_contract(definition)
			return definition
	return {}

func node_contract(definition: Dictionary) -> Dictionary:
	## 页面只依赖这份规范化契约，节点数据仍由 chapter1.json 负责生成。
	var node_type := str(definition.get("type", ""))
	var resolution := "manual"
	if node_type == "random": resolution = "hidden_wheel"
	elif node_type == "selection": resolution = "time_slot_local"
	elif node_type == "battle": resolution = "real_battle"
	elif node_type == "map": resolution = "map_route"
	elif node_type == "settlement": resolution = "settlement"
	elif node_type == "end": resolution = "terminal_or_continuation"
	return {
		"id": str(definition.get("id", "")),
		"type": node_type,
		"title": str(definition.get("title", "")),
		"scene": str(definition.get("scene", "")),
		"resolution": resolution,
		"manualChoice": node_type == "branch" or (node_type == "rpg" and not bool(definition.get("aiMayResolve", false))),
		"aiAllowed": node_type in ["selection", "random"],
		"next": str(definition.get("next", "")),
		"choiceCount": (definition.get("choices", []) as Array).size(),
		"outcomeCount": (definition.get("outcomes", []) as Array).size(),
		"battleRuleOutcomes": (definition.get("battleRules", {}) as Dictionary).keys()
	}

func current_node_definition() -> Dictionary:
	return node_definition(current_node)

## Resolve the presentation scene for any story node. Content authors only need
## to declare a node type/scene in chapter data; callers should use this method
## instead of maintaining an ID-specific routing table.
func scene_for_node(node_id: String = "") -> String:
	var id := current_node if node_id.is_empty() else node_id
	var definition := node_definition(id)
	if definition.is_empty(): return ""
	var declared := str(definition.get("scene", ""))
	if not declared.is_empty() and ResourceLoader.exists(declared): return declared
	match str(definition.get("type", "")):
		"battle": return "res://scenes/battle/battle_scene.tscn"
		"selection": return "res://scenes/story/selection.tscn"
		"map": return "res://scenes/story/Map.tscn"
		"settlement": return "res://scenes/story/settlement.tscn"
		"rpg", "random", "branch", "core_reserved": return "res://scenes/story/RPG.tscn"
		"end": return "res://scenes/story/Map.tscn"
		_: return ""

## Stable context shared by the story battle presenter, settlement and tests.
## The node data remains authoritative; presentation code does not infer routes.
func battle_context(node_id: String = "") -> Dictionary:
	var id := current_node if node_id.is_empty() else node_id
	var definition := node_definition(id)
	if str(definition.get("type", "")) != "battle": return {}
	var adapter: Script = preload("res://story/StoryBattleAdapter.gd")
	return {
		"node_id": id,
		"title": str(definition.get("title", "战斗节点")),
		"battle_profile": str(definition.get("battleProfile", "")),
		"opponent_id": adapter.opponent_id_for_definition(definition),
		"next_node": str(definition.get("next", "")),
		"critical": bool(definition.get("critical", false)),
		"source_role": str(definition.get("sourceRole", "")),
		"source_wheel_id": int(definition.get("sourceWheelId", 0)),
		"ai_allowed": false
	}

func battle_result_rules(node_id: String, outcome: String, hp_ratio: float, ce_ratio: float) -> Dictionary:
	var definition := node_definition(node_id)
	var configured: Dictionary = definition.get("battleRules", {}) as Dictionary
	var rule: Dictionary = configured.get(outcome, {}) as Dictionary
	if rule.is_empty():
		rule = {"xp":16 if outcome == "victory" else (6 if outcome == "retreat" else 2), "stability":-3 if outcome == "victory" else (-8 if outcome == "retreat" else -10), "growth":{"体术":2,"体质":1} if outcome == "victory" else {"体质":1}}
	var result := {"resources":{"hp":-roundi((1.0 - hp_ratio) * 30.0), "ce":-roundi((1.0 - ce_ratio) * 24.0), "xp":int(rule.get("xp", 0)), "stability":int(rule.get("stability", 0))}, "growth":(rule.get("growth", {}) as Dictionary).duplicate(true)}
	return result

func _load_chapter_data() -> Dictionary:
	var file := FileAccess.open("res://data/story/chapter1.json", FileAccess.READ)
	if file == null: return {}
	var parsed: Variant = JSON.parse_string(file.get_as_text())
	return parsed as Dictionary if parsed is Dictionary else {}

func _validate_chapter_data() -> Dictionary:
	var errors: Array[String] = []
	var by_id: Dictionary = {}
	for raw: Variant in chapter_data.get("nodes", []):
		if not raw is Dictionary: continue
		var node := raw as Dictionary
		var node_id := str(node.get("id", ""))
		if node_id.is_empty() or by_id.has(node_id):
			errors.append("duplicate_or_empty:%s" % node_id)
			continue
		by_id[node_id] = node
		if str(node.get("scene", "")).is_empty(): errors.append("scene_missing:%s" % node_id)
		if bool(node.get("critical", false)) and bool(node.get("aiMayResolve", true)): errors.append("critical_ai:%s" % node_id)
		for raw_choice: Variant in node.get("choices", []):
			if raw_choice is Dictionary:
				var target := str((raw_choice as Dictionary).get("next", ""))
				if not target.is_empty() and not by_id.has(target):
					# Links are checked again after all nodes are indexed below.
					pass
		if str(node.get("type", "")) == "random":
			var total_weight := 0
			for raw_outcome: Variant in node.get("outcomes", []):
				if raw_outcome is Dictionary: total_weight += maxi(0, int((raw_outcome as Dictionary).get("weight", 0)))
			if total_weight <= 0: errors.append("random_weight_missing:%s" % node_id)
		if str(node.get("type", "")) == "selection":
			var slots: Array = node.get("timeSlots", []) as Array
			if slots.size() != 4: errors.append("selection_slots:%s" % node_id)
			var actions: Dictionary = node.get("actions", {}) as Dictionary
			if actions.is_empty(): errors.append("selection_actions_missing:%s" % node_id)
			for action_id: Variant in actions:
				var action := actions[action_id] as Dictionary
				var outcomes: Dictionary = action.get("outcomes", {}) as Dictionary
				for slot: Variant in slots:
					if not outcomes.has(slot): errors.append("selection_outcome_missing:%s:%s:%s" % [node_id, str(action_id), str(slot)])
	for raw_map: Variant in chapter_data.get("mapNodes", []):
		if raw_map is Dictionary:
			var map_node := raw_map as Dictionary
			var map_target := str(map_node.get("node", ""))
			if map_target.is_empty() or not by_id.has(map_target): errors.append("map_target_missing:%s" % map_target)
			var required := str(map_node.get("requires", ""))
			if not required.is_empty() and not by_id.has(required): errors.append("map_requirement_missing:%s" % required)
			for required_any: Variant in map_node.get("requiresAny", []):
				if not by_id.has(str(required_any)): errors.append("map_requirement_missing:%s" % str(required_any))
	for raw: Variant in chapter_data.get("nodes", []):
		if not raw is Dictionary: continue
		var node := raw as Dictionary
		var node_id := str(node.get("id", ""))
		for target: String in [str(node.get("next", ""))]:
			if not target.is_empty() and not by_id.has(target): errors.append("dangling:%s->%s" % [node_id, target])
		for raw_choice: Variant in node.get("choices", []):
			if raw_choice is Dictionary:
				var target := str((raw_choice as Dictionary).get("next", ""))
				if not target.is_empty() and not by_id.has(target): errors.append("dangling:%s->%s" % [node_id, target])
				_validate_delta_keys((raw_choice as Dictionary).get("resources", {}) as Dictionary, RESOURCE_KEYS, "resource:%s" % node_id, errors)
				_validate_delta_keys((raw_choice as Dictionary).get("growth", {}) as Dictionary, GROWTH_KEYS, "growth:%s" % node_id, errors)
		for key: Variant in (node.get("actions", {}) as Dictionary):
			var action := (node.get("actions", {}) as Dictionary)[key] as Dictionary
			for slot: Variant in (action.get("outcomes", {}) as Dictionary):
				var outcome := (action.get("outcomes", {}) as Dictionary)[slot] as Dictionary
				_validate_delta_keys(outcome.get("resources", {}) as Dictionary, RESOURCE_KEYS, "resource:%s" % node_id, errors)
				_validate_delta_keys(outcome.get("growth", {}) as Dictionary, GROWTH_KEYS, "growth:%s" % node_id, errors)
		_validate_delta_keys(node.get("resources", {}) as Dictionary, RESOURCE_KEYS, "resource:%s" % node_id, errors)
		_validate_delta_keys(node.get("growth", {}) as Dictionary, GROWTH_KEYS, "growth:%s" % node_id, errors)
		if str(node.get("type", "")) == "battle":
			var battle_rules: Dictionary = node.get("battleRules", {}) as Dictionary
			if battle_rules.is_empty(): errors.append("battle_rules_missing:%s" % node_id)
			for outcome: Variant in battle_rules:
				if str(outcome) not in ["victory", "retreat", "defeat"]:
					errors.append("battle_outcome:%s:%s" % [node_id, str(outcome)])
					continue
				var rule: Dictionary = battle_rules[outcome] as Dictionary
				_validate_delta_keys(rule.get("resources", {}) as Dictionary, RESOURCE_KEYS, "battle_resource:%s" % node_id, errors)
				_validate_delta_keys(rule.get("growth", {}) as Dictionary, GROWTH_KEYS, "battle_growth:%s" % node_id, errors)
	return {"ok": errors.is_empty(), "errors": errors, "nodes": by_id.size()}

func _validate_delta_keys(delta: Dictionary, allowed: Array, context: String, errors: Array[String]) -> void:
	for key: Variant in delta:
		if str(key) not in allowed: errors.append("unknown_key:%s:%s" % [context, str(key)])

func _validate_core_timeline() -> Dictionary:
	var errors: Array[String] = []
	var source_file := FileAccess.open("res://data/story/core-timeline-main-start-shibuya.json", FileAccess.READ)
	if source_file == null: return {"ok": false, "errors": ["source_file_missing"]}
	var parsed: Variant = JSON.parse_string(source_file.get_as_text())
	if not parsed is Dictionary: return {"ok": false, "errors": ["source_json_invalid"]}
	var source := parsed as Dictionary
	var expected := {
		"joinHighSchool":"core_join_high_school", "highSchoolCampus":"core_high_school_campus", "highSchoolStatus":"core_high_school_status",
		"joinMainTeamMainStart":"core_join_main_team", "exchangeEventParticipation":"core_exchange_participation", "exchangeEventOutcome":"core_exchange_result",
		"junpeiParticipation":"core_junpei_participation", "junpeiHighSchoolOutcome":"core_junpei_high_school", "junpeiMahitoOutcome":"core_junpei_mahito",
		"participatesShibuya":"core_shibuya_participation", "shibuyaFaction":"core_shibuya_faction", "shibuyaHighSchoolOpening":"core_shibuya_high_school_opening",
		"shibuyaHighSchoolImpact":"core_shibuya_high_school_impact", "shibuyaGojoRescueResult":"core_shibuya_gojo_rescue", "shibuyaSealFailureResult":"core_shibuya_seal_failure",
		"shibuyaSukunaAfterGojoLine":"core_shibuya_sukuna_line", "shibuyaSukunaAfterGojoRevival":"core_shibuya_sukuna_revival",
		"shibuyaAlternateProcess":"core_shibuya_non_high_school", "shibuyaAfterState":"core_shibuya_after_state", "shibuyaOutcome":"core_shibuya_outcome"
		,"guardTengen":"core_culling_guard_tengen", "guardTengenResult":"core_culling_guard_tengen_result", "cullingGameParticipation":"core_culling_participation",
		"cullingAwakening":"core_culling_awakening", "cullingReincarnation":"core_culling_reincarnation", "cullingSpecialLocation":"core_culling_special_location",
		"cullingLocation":"core_culling_location", "cullingWeakResult":"core_culling_weak_result", "cullingResult":"core_culling_strong_result",
		"cullingGameGate":"core_culling_gate", "cullingGameAlteredOutcome":"core_culling_altered_outcome"
	}
	var chapter_by_id: Dictionary = {}
	for raw: Variant in chapter_data.get("nodes", []):
		if raw is Dictionary: chapter_by_id[str((raw as Dictionary).get("id", ""))] = raw as Dictionary
	var source_order: Array[String] = []
	for period_raw: Variant in source.get("periods", []):
		if not period_raw is Dictionary: continue
		for raw_node: Variant in (period_raw as Dictionary).get("nodes", []):
			if not raw_node is Dictionary: continue
			var source_node := raw_node as Dictionary
			var source_id := str(source_node.get("nodeId", ""))
			if not expected.has(source_id): continue
			var project_id := str(expected[source_id])
			if not chapter_by_id.has(project_id):
				errors.append("missing:%s->%s" % [source_id, project_id]); continue
			var project_node := chapter_by_id[project_id] as Dictionary
			var source_wheel := int(source_node.get("wheelId", 0))
			var project_wheel := int(project_node.get("sourceWheelId", 0))
			if source_wheel > 0 and project_wheel != source_wheel: errors.append("wheel:%s=%d!=%d" % [source_id, project_wheel, source_wheel])
			if bool(project_node.get("aiMayResolve", true)): errors.append("ai_enabled:%s" % project_id)
			source_order.append(project_id)
	var previous_index := -1
	for project_id: String in source_order:
		var current_index := int(chapter_data.get("nodes", []).find(chapter_by_id[project_id]))
		if current_index < previous_index: errors.append("order:%s" % project_id)
		previous_index = current_index
	return {"ok": errors.is_empty(), "errors": errors, "checked": source_order.size()}

func begin_node(node_id: String) -> bool:
	if node_id.is_empty() or node_definition(node_id).is_empty() or not pending_result.is_empty():
		return false
	# A terminal run may still point the map at chapter1_end so the player can
	# inspect the completed route; all other nodes remain blocked.
	if bool(flags.get("run_terminal", false)) and node_id != "chapter1_end": return false
	current_node = node_id
	_emit()
	return true

func resolve_local(node_id: String, title: String, result_text: String, resource_delta: Dictionary = {}, growth_delta: Dictionary = {}, next_node: String = "", source: String = "local", relationship_delta: Dictionary = {}, npc_flags: Dictionary = {}, story_flags: Dictionary = {}, inventory_delta: Dictionary = {}) -> Dictionary:
	if not pending_result.is_empty(): return pending_result.duplicate(true)
	var before := resources.duplicate(true)
	var resource_after := before.duplicate(true)
	var growth_before := growth.duplicate(true)
	var growth_after := growth_before.duplicate(true)
	var inventory_before := inventory.duplicate(true)
	var inventory_after := _project_inventory(inventory_before, inventory_delta)
	for key: String in RESOURCE_KEYS:
		if resource_delta.has(key): resource_after[key] = maxi(0, int(resource_after.get(key, 0)) + int(resource_delta[key]))
	for key: String in GROWTH_KEYS:
		if growth_delta.has(key): growth_after[key] = maxi(0, int(growth_after.get(key, 0)) + int(growth_delta[key]))
	pending_result = {"node_id": node_id, "title": title, "text": result_text, "resource_delta": resource_delta.duplicate(true), "growth_delta": growth_delta.duplicate(true), "relationship_delta": relationship_delta.duplicate(true), "npc_flags": npc_flags.duplicate(true), "story_flags": story_flags.duplicate(true), "inventory_delta": inventory_delta.duplicate(true), "inventory_before": inventory_before, "inventory_after": inventory_after, "resources_before": before, "resources_after": resource_after, "growth_before": growth_before, "growth_after": growth_after, "next_node": next_node if not next_node.is_empty() else node_id, "source": source, "resolved_at": Time.get_datetime_string_from_system()}
	_emit()
	return pending_result.duplicate(true)

func resolve_core_choice(node_id: String, title: String, wheel_id: int, option_id: String, value: String, result_text: String, next_node: String = "", resource_delta: Dictionary = {}, growth_delta: Dictionary = {}, relationship_delta: Dictionary = {}, npc_flags: Dictionary = {}, story_flags: Dictionary = {}, inventory_delta: Dictionary = {}) -> Dictionary:
	if node_id.is_empty() or value.is_empty() or not pending_result.is_empty(): return {}
	var result := resolve_local(node_id, title, result_text, resource_delta, growth_delta, next_node, "core_wheel_manual", relationship_delta, npc_flags, story_flags, inventory_delta)
	result["core_choice"] = {"wheel_id": wheel_id, "option_id": option_id, "value": value}
	pending_result["core_choice"] = result["core_choice"]
	_emit()
	return pending_result.duplicate(true)

func commit_pending() -> bool:
	if pending_result.is_empty(): return false
	var result := pending_result.duplicate(true)
	resources = result.get("resources_after", resources).duplicate(true)
	growth = result.get("growth_after", growth).duplicate(true)
	current_node = str(result.get("next_node", current_node))
	history.append(result)
	var core_choice: Dictionary = result.get("core_choice", {}) as Dictionary
	if not core_choice.is_empty():
		core_results[str(result.get("node_id", ""))] = core_choice.duplicate(true)
	_apply_npc_result(result.get("relationship_delta", {}) as Dictionary, result.get("npc_flags", {}) as Dictionary)
	if result.has("inventory_after"):
		inventory = (result.get("inventory_after", inventory) as Dictionary).duplicate(true)
	else:
		_apply_inventory_delta(result.get("inventory_delta", {}) as Dictionary)
	for key: Variant in (result.get("story_flags", {}) as Dictionary):
		flags[str(key)] = (result.get("story_flags", {}) as Dictionary)[key]
	pending_result.clear()
	save()
	_emit()
	return true

func discard_pending() -> void:
	pending_result.clear()
	_emit()

func apply_result(node_id: String, title: String, result_text: String, resource_delta: Dictionary = {}, growth_delta: Dictionary = {}, next_node: String = "") -> void:
	resolve_local(node_id, title, result_text, resource_delta, growth_delta, next_node)
	commit_pending()

func mark_flag(key: String, value: Variant = true) -> void:
	flags[key] = value
	_emit()

func npc_definition(npc_id: String) -> Dictionary:
	for raw: Variant in npc_data.get("npcs", []):
		if raw is Dictionary and str((raw as Dictionary).get("id", "")) == npc_id:
			return (raw as Dictionary).duplicate(true)
	return {}

func npc_state(npc_id: String) -> Dictionary:
	return (npc_states.get(npc_id, {}) as Dictionary).duplicate(true)

func npc_dialogue(npc_id: String, stage: String = "") -> Array[Dictionary]:
	var route: Dictionary = (npc_dialogue_data.get("routes", {}) as Dictionary).get(npc_id, {}) as Dictionary
	var selected_stage := stage
	if selected_stage.is_empty(): selected_stage = str(npc_states.get(npc_id, {}).get("route_stage", "unknown"))
	var raw_lines: Array = (route.get("dialogue", {}) as Dictionary).get(selected_stage, []) as Array
	var lines: Array[Dictionary] = []
	for raw: Variant in raw_lines:
		if raw is Dictionary: lines.append((raw as Dictionary).duplicate(true))
	return lines

func npc_route_choices(npc_id: String) -> Array[Dictionary]:
	var route: Dictionary = (npc_dialogue_data.get("routes", {}) as Dictionary).get(npc_id, {}) as Dictionary
	var choices: Array[Dictionary] = []
	var state := npc_states.get(npc_id, {}) as Dictionary
	var stage := str(state.get("route_stage", "unknown"))
	for raw: Variant in route.get("攻略Choices", []):
		if not raw is Dictionary: continue
		var choice := (raw as Dictionary).duplicate(true)
		var requirements := choice.get("requirements", {}) as Dictionary
		var stages: Array = requirements.get("stageIn", []) as Array
		choice["available"] = stages.is_empty() or stages.has(stage)
		choices.append(choice)
	return choices

func npc_route_story(npc_id: String, story_id: String = "") -> Dictionary:
	var route: Dictionary = (npc_dialogue_data.get("routes", {}) as Dictionary).get(npc_id, {}) as Dictionary
	var state := npc_states.get(npc_id, {}) as Dictionary
	var affection := int(state.get("affection", 0))
	var trust := int(state.get("trust", 0))
	var respect := int(state.get("respect", 0))
	for raw: Variant in route.get("routeStories", []):
		if not raw is Dictionary: continue
		var story := raw as Dictionary
		if not story_id.is_empty() and str(story.get("id", "")) != story_id: continue
		var requirements := story.get("requirements", {}) as Dictionary
		if affection < int(requirements.get("affection", 0)) or trust < int(requirements.get("trust", 0)) or respect < int(requirements.get("respect", 0)): continue
		var valid := true
		for flag: Variant in requirements.get("flags", []) as Array:
			if not bool((state.get("flags", {}) as Dictionary).get(str(flag), false)): valid = false; break
		if valid: return story.duplicate(true)
	return {}

func apply_npc_delta(npc_id: String, delta: Dictionary = {}, flags_delta: Dictionary = {}) -> Dictionary:
	if npc_id.is_empty(): return {}
	var current: Dictionary = npc_states.get(npc_id, {"affection": 0, "trust": 0, "respect": 0, "compatibility": 0, "flags": {}, "route_stage": "unknown", "companion": false}).duplicate(true)
	for key: String in ["affection", "trust", "respect", "compatibility"]:
		if delta.has(key):
			var maximum := 100 if key == "affection" else 5
			var minimum := -3 if key == "compatibility" else 0
			current[key] = clampi(int(current.get(key, 0)) + int(delta[key]), minimum, maximum)
	var npc_flags: Dictionary = current.get("flags", {}) as Dictionary
	for key: Variant in flags_delta: npc_flags[str(key)] = flags_delta[key]
	current["flags"] = npc_flags
	current["route_stage"] = _npc_route_stage(npc_id, current)
	current["companion"] = current["route_stage"] in ["temporary_partner", "recruit"]
	npc_states[npc_id] = current
	_emit()
	return current.duplicate(true)

func snapshot() -> Dictionary:
	return {"schema_version": save_version, "resources": resources.duplicate(true), "growth": growth.duplicate(true), "flags": flags.duplicate(true), "core_results": core_results.duplicate(true), "npc_states": npc_states.duplicate(true), "inventory": inventory.duplicate(true), "chapter_validation": chapter_validation.duplicate(true), "core_timeline_validation": core_timeline_validation.duplicate(true), "run_seed": run_seed, "current_node": current_node, "chapter": chapter, "difficulty": difficulty, "mode": mode, "history": history.duplicate(true), "character": character.duplicate(true), "pending_result": pending_result.duplicate(true)}

func save() -> bool:
	var file := FileAccess.open(SAVE_PATH, FileAccess.WRITE)
	if file == null: return false
	file.store_string(JSON.stringify(snapshot()))
	return true

func load_saved() -> bool:
	var file := FileAccess.open(SAVE_PATH, FileAccess.READ)
	if file == null: return false
	var parsed: Variant = JSON.parse_string(file.get_as_text())
	if not parsed is Dictionary: return false
	var data := parsed as Dictionary
	resources = (data.get("resources", resources) as Dictionary).duplicate(true)
	growth = (data.get("growth", growth) as Dictionary).duplicate(true)
	flags = (data.get("flags", flags) as Dictionary).duplicate(true)
	core_results = (data.get("core_results", {}) as Dictionary).duplicate(true)
	npc_states = (data.get("npc_states", _default_npc_states()) as Dictionary).duplicate(true)
	inventory = (data.get("inventory", {}) as Dictionary).duplicate(true)
	run_seed = int(data.get("run_seed", run_seed))
	current_node = str(data.get("current_node", current_node))
	chapter = str(data.get("chapter", chapter))
	difficulty = str(data.get("difficulty", difficulty))
	mode = str(data.get("mode", mode))
	history.assign(data.get("history", []))
	character = (data.get("character", {}) as Dictionary).duplicate(true)
	pending_result.clear()
	_emit()
	return true

func _load_npc_data() -> Dictionary:
	var file := FileAccess.open("res://data/story/npcs.json", FileAccess.READ)
	if file == null: return {"npcs": []}
	var parsed: Variant = JSON.parse_string(file.get_as_text())
	return parsed as Dictionary if parsed is Dictionary else {"npcs": []}

func _load_npc_dialogue_data() -> Dictionary:
	var file := FileAccess.open("res://data/story/npc_dialogue.json", FileAccess.READ)
	if file == null: return {"routes": {}}
	var parsed: Variant = JSON.parse_string(file.get_as_text())
	return parsed as Dictionary if parsed is Dictionary else {"routes": {}}

func _default_npc_states() -> Dictionary:
	var result: Dictionary = {}
	for raw: Variant in npc_data.get("npcs", []):
		if raw is Dictionary:
			var npc := raw as Dictionary
			var affinity: Dictionary = npc.get("affinity", {}) as Dictionary
			result[str(npc.get("id", ""))] = {"affection": int(affinity.get("affection", 0)), "trust": int(affinity.get("trust", 0)), "respect": int(affinity.get("respect", 0)), "compatibility": int(affinity.get("compatibility", 0)), "flags": {}, "route_stage": str(npc.get("initialState", "unknown")), "companion": false}
	return result

func _apply_npc_result(relationship_delta: Dictionary, npc_flags: Dictionary) -> void:
	for npc_id: Variant in relationship_delta:
		apply_npc_delta(str(npc_id), relationship_delta[npc_id] as Dictionary, npc_flags.get(str(npc_id), {}) as Dictionary)

func _apply_inventory_delta(delta: Dictionary) -> void:
	inventory = _project_inventory(inventory, delta)

func _project_inventory(before: Dictionary, delta: Dictionary) -> Dictionary:
	var projected := before.duplicate(true)
	for item_id: Variant in delta:
		var next_count := maxi(0, int(projected.get(str(item_id), 0)) + int(delta[item_id]))
		if next_count == 0: projected.erase(str(item_id))
		else: projected[str(item_id)] = next_count
	return projected

func _npc_route_stage(npc_id: String, state: Dictionary) -> String:
	var definition := npc_definition(npc_id)
	var route_flags: Dictionary = state.get("flags", {}) as Dictionary
	var affection := int(state.get("affection", 0))
	var trust := int(state.get("trust", 0))
	var respect := int(state.get("respect", 0))
	var matched := str(definition.get("initialState", "unknown"))
	for raw: Variant in definition.get("routeStages", []):
		if not raw is Dictionary: continue
		var route := raw as Dictionary
		var requirements: Dictionary = route.get("requirements", {}) as Dictionary
		if affection < int(requirements.get("affection", 0)) or trust < int(requirements.get("trust", 0)) or respect < int(requirements.get("respect", 0)): continue
		var required_flags: Array = requirements.get("flags", []) as Array
		var valid := true
		for flag: Variant in required_flags:
			if not bool(route_flags.get(str(flag), false)): valid = false; break
		if valid: matched = str(route.get("id", matched))
	return matched

func _emit() -> void:
	changed.emit(snapshot())
