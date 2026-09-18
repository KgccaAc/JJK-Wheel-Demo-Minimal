extends SceneTree

var failures: Array[String] = []

func _initialize() -> void:
	call_deferred("_run")

func _run() -> void:
	await _test_settlement_review()
	await _test_completed_map_cta()
	await _test_battle_strategy_guidance()
	await _test_identity_meta_grid()
	await _test_selection_feedback()
	await _test_rpg_continue_affordance()
	print("STORY_PRESENTATION_AUDIT_ACCEPTANCE %s failures=%s" % ["PASS" if failures.is_empty() else "FAIL", failures])
	quit(0 if failures.is_empty() else 1)

func _test_settlement_review() -> void:
	var story := root.get_node_or_null("StoryState")
	if story == null:
		_fail("settlement_story_state_missing")
		return
	story.call("begin_from_identity", {"displayName":"长结算验收角色"})
	story.call("begin_node", "chapter1_selection")
	story.call("resolve_local", "chapter1_selection", "一日调查结算", "这是一段足以覆盖图片下方边界的长经历文本。".repeat(8), {"xp": 6, "stability": -3}, {}, "chapter1_map")
	var page := (load("res://scenes/story/settlement.tscn") as PackedScene).instantiate() as Control
	root.add_child(page)
	await process_frame
	var body := page.get_node_or_null("Reflect/Label") as Label
	_check(body != null and not body.text.is_empty(), "settlement_review_missing_authored_label")
	page.queue_free()
	await process_frame

func _test_completed_map_cta() -> void:
	var story := root.get_node_or_null("StoryState")
	if story == null: return
	story.call("begin_from_identity", {"displayName":"终章验收角色"})
	story.set("current_node", "chapter1_end")
	var flags: Dictionary = story.get("flags") as Dictionary
	flags["chapter1_end"] = true
	story.set("flags", flags)
	var page := (load("res://scenes/story/Map.tscn") as PackedScene).instantiate() as Control
	root.add_child(page)
	await process_frame
	var title := page.get_node_or_null("Enter/Title") as Label
	_check(title != null and title.text == "查看第一章结局", "completed_map_cta_not_conclusion")
	_check(page.get_node_or_null("ChapterEndSummary") == null, "completed_map_runtime_summary_present")
	page.queue_free()
	await process_frame

func _test_battle_strategy_guidance() -> void:
	var page := (load("res://scenes/battle/strategy_selection.tscn") as PackedScene).instantiate() as Control
	root.add_child(page)
	await process_frame
	_check(page.get_node_or_null("StrategyContent/Guidance") == null and page.get_node_or_null("StrategyContent/SelectionStatus") == null, "battle_strategy_runtime_text_present")
	_check(page.get_node_or_null("StrategyContent/ConfirmButton") == null, "battle_strategy_runtime_button_present")
	page.queue_free()
	await process_frame

func _test_identity_meta_grid() -> void:
	var story := root.get_node_or_null("StoryState")
	if story == null: return
	story.call("begin_from_identity", {"displayName":"身份栅格验收角色", "answers":{"gender":"女", "age":"刚满十八岁又三个月", "startTime":"剧情开始时期", "camp":"咒术师"}})
	var page := (load("res://scenes/wheel/identity.tscn") as PackedScene).instantiate() as Control
	root.add_child(page)
	await process_frame
	_check(page.get_node_or_null("CharacterCard/MetaGrid") == null, "identity_runtime_meta_grid_present")
	_check(page.get_node_or_null("CharacterCard/Sex") != null and page.get_node_or_null("CharacterCard/Age") != null and page.get_node_or_null("CharacterCard/Time") != null and page.get_node_or_null("CharacterCard/Camp") != null, "identity_authored_meta_fields_missing")
	page.queue_free()
	await process_frame

func _test_selection_feedback() -> void:
	var story := root.get_node_or_null("StoryState")
	if story == null: return
	story.call("begin_from_identity", {"displayName":"行动反馈验收角色"})
	var page := (load("res://scenes/story/selection.tscn") as PackedScene).instantiate() as Control
	root.add_child(page)
	await process_frame
	_check(page.get_node_or_null("Scene/ActionFeedback") == null, "selection_runtime_feedback_present")
	_check(page.get_node_or_null("Select/SelectView/ActionTitle") == null, "selection_runtime_title_present")
	page.queue_free()
	await process_frame

func _test_rpg_continue_affordance() -> void:
	var story := root.get_node_or_null("StoryState")
	if story == null: return
	story.call("begin_from_identity", {"displayName":"RPG提示验收角色"})
	story.call("begin_node", "chapter1_intro")
	var page := (load("res://scenes/story/RPG.tscn") as PackedScene).instantiate() as Control
	root.add_child(page)
	await process_frame
	_check(page.get_node_or_null("Text/ContinueHint") == null and page.get_node_or_null("Text/ContinueHintPlate") == null, "rpg_runtime_hint_present")
	page.queue_free()

func _check(condition: bool, code: String) -> void:
	if not condition: _fail(code)

func _fail(code: String) -> void:
	failures.append(code)
