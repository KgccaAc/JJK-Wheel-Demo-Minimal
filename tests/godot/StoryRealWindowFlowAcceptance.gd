extends SceneTree

const OUTPUT_DIR := "res://reports/full-flow/screenshots"
const REPORT_PATH := "res://reports/full-flow/full-flow-latest.json"
const STORY_HOME := "res://scenes/story/StroyHome.tscn"
const PROFILE_BUILDER_SCRIPT: Script = preload("res://battle/data/CharacterProfileBuilder.gd")

var failures: Array[String] = []
var screenshots: Array[String] = []
var account: Node
var original_cards: Array = []
var original_active_card_id := ""
var original_storage_path := ""

func _initialize() -> void:
	call_deferred("_run")

func _run() -> void:
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(OUTPUT_DIR))
	var story := root.get_node_or_null("StoryState")
	account = root.get_node_or_null("AccountState")
	if story == null or account == null:
		_finish(false, "autoload_missing")
		return
	original_cards = account.get("_cards") as Array
	original_active_card_id = str(account.get("_active_card_id"))
	original_storage_path = str(account.get("_storage_path"))
	account.call("use_test_storage", "user://story-real-window-account.cfg")
	account.call("clear_for_test")
	account.call("create_local_normal_card")
	var login_profile: Dictionary = (PROFILE_BUILDER_SCRIPT.new() as RefCounted).call("build", "gojo_satoru_shinjuku") as Dictionary
	login_profile["id"] = "login-card-story-hero"
	login_profile["characterId"] = "login-card-story-hero"
	login_profile["displayName"] = "登录卡验收角色"
	login_profile["grade_label"] = "特级"
	account.call("append_local_character_snapshot", login_profile)
	login_profile["id"] = "wheel-story-hero"
	login_profile["characterId"] = "wheel-story-hero"
	login_profile["displayName"] = "转盘长姓名验收角色"
	login_profile["grade_label"] = "特级"
	story.call("begin_from_identity", login_profile)

	if not await _identity_to_story_home(story):
		_finish(false, "identity_to_story_home_failed")
		return
	if not await _story_home_to_rpg(story):
		_finish(false, "story_home_to_rpg_failed")
		return
	if not await _rpg_to_selection():
		_finish(false, "rpg_to_selection_failed")
		return
	if not await _selection_to_settlement():
		_finish(false, "selection_to_settlement_failed")
		return
	if not await _settlement_to_map(false):
		_finish(false, "first_settlement_to_map_failed")
		return
	if not await _map_clue_to_battle():
		_finish(false, "map_to_battle_failed")
		return
	if not await _battle_to_final_settlement():
		_finish(false, "battle_to_settlement_failed")
		return
	if not await _settlement_to_map(true):
		_finish(false, "final_settlement_to_map_failed")
		return
	await _verify_story_home_routes()
	_finish(failures.is_empty(), "completed")

func _identity_to_story_home(story: Node) -> bool:
	if not await _load_scene("res://scenes/wheel/identity.tscn"): return false
	await _capture("01_identity")
	var identity := current_scene
	var name_label := identity.get_node_or_null("CharacterCard/Name") as Label
	_check(name_label != null and identity.get_node_or_null("CharacterCard/Name/NameEditor") == null, "identity_runtime_name_editor_present")
	if name_label == null: return false
	var next := identity.get_node_or_null("Next") as BaseButton
	if next == null: return false
	await _click(next)
	if not await _wait_scene("res://scenes/wheel/Select.tscn", 2.5): return false
	await _capture("02_select")
	var story_button := current_scene.get_node_or_null("TextureButton") as BaseButton
	if story_button == null: return false
	await _click(story_button)
	return await _wait_scene(STORY_HOME, 2.5)

func _story_home_to_rpg(story: Node) -> bool:
	await _capture("03_story_home")
	var page := current_scene
	var forum := page.get_node_or_null("Background/BottomNav/ForumButton") as TextureButton
	var chapter := page.get_node_or_null("Chapter/Cheaper") as Label
	_check(forum != null and forum.texture_normal != null and str(forum.texture_normal.resource_path).contains("选中状态论坛"), "story_home_forum_not_selected")
	_check(chapter != null and chapter.text == "未开始", "story_home_chapter_not_unstarted")
	var more := page.get_node_or_null("Background/Header/MoreButton") as BaseButton
	var user := page.get_node_or_null("Background/Header/UserButton") as BaseButton
	if more == null or user == null: return false
	await _click(more)
	await process_frame
	var settings := page.get_node_or_null("ClientSettings") as AcceptDialog
	_check(settings != null and settings.visible, "story_home_more_not_opened")
	if settings != null: settings.hide()
	await _click(user)
	await process_frame
	var user_panel := page.get_node_or_null("UserPanelOverlay") as Control
	_check(user_panel != null and user_panel.visible, "story_home_user_not_opened")
	if user_panel != null:
		user_panel.queue_free()
		await process_frame
	var notice := page.get_node_or_null("ClientNotice") as AcceptDialog
	if notice != null: notice.hide()
	var start := page.get_node_or_null("Start") as BaseButton
	if start == null: return false
	await _click(start)
	return await _wait_scene("res://scenes/story/RPG.tscn", 3.0)

func _rpg_to_selection() -> bool:
	await _capture("04_rpg")
	var page := current_scene
	var text_panel := page.get_node_or_null("Text") as Control
	var next := page.get_node_or_null("Text/TextureButton") as BaseButton
	var speaker := page.get_node_or_null("Text/Speaker/Label") as Label
	var choose1 := page.get_node_or_null("Text/Choose1") as BaseButton
	var choose2 := page.get_node_or_null("Text/Choose2") as BaseButton
	if text_panel == null or next == null or speaker == null or choose1 == null or choose2 == null: return false
	_check(next.get_global_rect().intersection(text_panel.get_global_rect()).size.x >= text_panel.get_global_rect().size.x * 0.95, "rpg_text_hit_area_too_small")
	_check(speaker.horizontal_alignment == HORIZONTAL_ALIGNMENT_CENTER and speaker.vertical_alignment == VERTICAL_ALIGNMENT_CENTER, "rpg_speaker_not_centered")
	var guard := 0
	while next.visible and guard < 30:
		await _click(next)
		await create_timer(0.06).timeout
		guard += 1
	_check(choose1.visible and choose2.visible, "rpg_choices_never_appeared")
	_check(not (choose1.get_node("IfFight") as Control).visible and not (choose2.get_node("IfFight") as Control).visible, "rpg_nonbattle_choice_marked_fight")
	if not choose1.visible: return false
	await _click(choose1)
	return await _wait_scene("res://scenes/story/selection.tscn", 3.0)

func _selection_to_settlement() -> bool:
	await _capture("05_selection")
	var actions := ["SelectView", "SelectFight", "SelectFight2", "SelectFight3"]
	for slot: int in 4:
		var page := current_scene
		var action := page.get_node_or_null("Select/" + actions[slot]) as BaseButton
		var enter := page.get_node_or_null("Enter") as BaseButton
		if action == null or enter == null: return false
		await _click(action)
		await _click(enter)
		await create_timer(0.15).timeout
		_check(bool(page.get("result_ready")) and int(page.get("slot_index")) == slot, "selection_result_missing_slot_%d" % slot)
		if slot == 0:
			await _capture("06_selection_result")
			await create_timer(1.35).timeout
			_check(bool(page.get("result_ready")) and int(page.get("slot_index")) == 0, "selection_result_auto_advanced")
		await _click(enter)
		if slot < 3:
			await create_timer(0.82).timeout
			_check(is_instance_valid(page) and int(page.get("slot_index")) == slot + 1, "selection_time_not_advanced_%d" % slot)
	if not await _wait_scene("res://scenes/story/settlement.tscn", 3.0): return false
	return true

func _settlement_to_map(expect_finished: bool) -> bool:
	await _capture("07_final_settlement" if expect_finished else "07_settlement")
	var page := current_scene
	var reflect := page.get_node_or_null("Reflect/Label") as Label
	var review := page.get_node_or_null("Review") as BaseButton
	var history := page.get_node_or_null("History") as BaseButton
	var enter := page.get_node_or_null("Enter") as BaseButton
	if reflect == null or review == null or history == null or enter == null: return false
	_check(reflect.text.length() <= 180, "settlement_reflect_not_summary")
	await _click(review)
	await process_frame
	var notice := page.get_node_or_null("ClientNotice") as AcceptDialog
	_check(notice != null and notice.dialog_text.contains("角色数值报告") and notice.dialog_text.contains("小说生成"), "settlement_review_missing_reports")
	if notice != null: notice.hide()
	await _click(history)
	await process_frame
	notice = page.get_node_or_null("ClientNotice") as AcceptDialog
	_check(notice != null and notice.dialog_text.contains("经历事件报告"), "settlement_history_missing")
	if notice != null: notice.hide()
	await _click(enter)
	if not await _wait_scene("res://scenes/story/Map.tscn", 3.0): return false
	await _capture("08_final_map" if expect_finished else "08_map")
	var chapter_status := current_scene.get_node_or_null("Chapter/ChapterNow/Status") as Label
	_check(chapter_status != null and chapter_status.text == ("已完成" if expect_finished else "进行中"), "map_chapter_status_mismatch")
	if expect_finished:
		var overlays := current_scene.find_children("CompletedGrayOverlay", "ColorRect", true, false)
		var visible_overlay := false
		for overlay: Node in overlays:
			if (overlay as Control).visible: visible_overlay = true
		_check(visible_overlay, "map_completed_overlay_missing")
	return true

func _map_clue_to_battle() -> bool:
	var story_node := current_scene.get_node_or_null("Map/Node/NodeTypeStory") as BaseButton
	var enter := current_scene.get_node_or_null("Enter") as BaseButton
	if story_node == null or enter == null: return false
	await _click(story_node)
	await _click(enter)
	if not await _wait_scene("res://scenes/story/RPG.tscn", 3.0): return false
	var next := current_scene.get_node_or_null("Text/TextureButton") as BaseButton
	var choose1 := current_scene.get_node_or_null("Text/Choose1") as BaseButton
	if next == null or choose1 == null: return false
	var guard := 0
	while next.visible and guard < 24:
		await _click(next)
		await create_timer(0.06).timeout
		guard += 1
	if not choose1.visible: return false
	await _click(choose1)
	if not await _wait_scene("res://scenes/story/settlement.tscn", 3.0): return false
	var settle_enter := current_scene.get_node_or_null("Enter") as BaseButton
	if settle_enter == null: return false
	await _click(settle_enter)
	if not await _wait_scene("res://scenes/story/Map.tscn", 3.0): return false
	var fight_node := current_scene.get_node_or_null("Map/Node/NodeTypeFight") as BaseButton
	enter = current_scene.get_node_or_null("Enter") as BaseButton
	if fight_node == null or enter == null: return false
	await _click(fight_node)
	await _click(enter)
	return await _wait_scene("res://scenes/battle/battle_scene.tscn", 4.0)

func _battle_to_final_settlement() -> bool:
	await create_timer(1.2).timeout
	await _capture("09_battle")
	var presenter := current_scene.get_node_or_null("FightPresenter")
	var session: RefCounted = presenter.get("_session") as RefCounted if presenter != null else null
	var battle_state: Dictionary = session.call("get_state_snapshot") as Dictionary if session != null else {}
	_check(session != null and (battle_state.get("actors", []) as Array).size() == 2 and not str(session.call("get_phase")).is_empty(), "battle_presenter_not_initialized")
	if presenter == null: return false
	presenter.call("_finish_story_battle", "left")
	return await _wait_scene("res://scenes/story/settlement.tscn", 3.0)

func _verify_story_home_routes() -> void:
	var routes := {
		"HomeButton":"res://scenes/home/home.tscn",
		"CharacterButton":"res://scenes/roster/roster_picker.tscn",
		"BattleButton":"res://scenes/battle/battle_scene.tscn",
		"ForumButton":"res://scenes/community/community.tscn",
		"ArchiveButton":"res://scenes/online/online_room.tscn"
	}
	for button_name: String in routes:
		if not await _load_scene(STORY_HOME):
			_check(false, "story_home_reload_failed_%s" % button_name)
			continue
		var button := current_scene.get_node_or_null("Background/BottomNav/" + button_name) as BaseButton
		if button == null:
			_check(false, "story_home_nav_missing_%s" % button_name)
			continue
		await _click(button)
		_check(await _wait_scene(str(routes[button_name]), 3.0), "story_home_nav_wrong_%s" % button_name)

func _load_scene(path: String) -> bool:
	var error := change_scene_to_file(path)
	if error != OK:
		_check(false, "scene_load_error_%s_%s" % [path, error_string(error)])
		return false
	return await _wait_scene(path, 3.0)

func _wait_scene(path: String, timeout: float) -> bool:
	var elapsed := 0.0
	while elapsed < timeout:
		await process_frame
		if current_scene != null and current_scene.scene_file_path.to_lower() == path.to_lower():
			await create_timer(0.12).timeout
			return true
		await create_timer(0.04).timeout
		elapsed += 0.04
	_check(false, "scene_timeout_%s_current_%s" % [path, current_scene.scene_file_path if current_scene != null else "none"])
	return false

func _click(control: Control) -> void:
	var point := control.get_global_rect().get_center()
	var viewport := control.get_viewport()
	var motion := InputEventMouseMotion.new()
	motion.position = point
	motion.global_position = point
	viewport.push_input(motion, true)
	await process_frame
	var event := InputEventMouseButton.new()
	event.position = point
	event.global_position = point
	event.button_index = MOUSE_BUTTON_LEFT
	event.button_mask = MOUSE_BUTTON_MASK_LEFT
	event.pressed = true
	viewport.push_input(event, true)
	event = event.duplicate() as InputEventMouseButton
	event.pressed = false
	event.button_mask = 0
	viewport.push_input(event, true)
	await process_frame

func _capture(name: String) -> void:
	# PageEntrance staggers major panels; capture after the last authored delay so
	# the screenshots prove the usable page rather than an in-between blank frame.
	await create_timer(0.9).timeout
	await process_frame
	if DisplayServer.get_name() == "headless": return
	var relative := "reports/full-flow/screenshots/%s.png" % name
	var image := root.get_texture().get_image()
	if image == null:
		return
	var error := image.save_png("res://" + relative)
	if error == OK: screenshots.append(relative)
	else: _check(false, "screenshot_failed_%s" % name)

func _check(condition: bool, code: String) -> void:
	if not condition:
		failures.append(code)
		push_error(code)

func _finish(passed: bool, reason: String) -> void:
	if account != null:
		account.call("clear_for_test")
		account.call("use_test_storage", original_storage_path)
		account.set("_cards", original_cards)
		account.set("_active_card_id", original_active_card_id)
	var report := {
		"schema":"godot-full-flow-v2",
		"generated_at":Time.get_datetime_string_from_system(true),
		"status":"passed" if passed else "failed",
		"reason":reason,
		"failures":failures,
		"screenshots":screenshots,
		"journey":["Identity","Select","StoryHome","RPG","Selection×4","Settlement","Map","RPG","Battle","Settlement","Map"],
		"input":"rendered-window mouse events"
	}
	var file := FileAccess.open(REPORT_PATH, FileAccess.WRITE)
	if file != null: file.store_string(JSON.stringify(report, "  "))
	print("STORY_REAL_WINDOW_FLOW_ACCEPTANCE %s failures=%s screenshots=%d" % ["PASS" if passed else "FAIL", failures, screenshots.size()])
	quit(0 if passed else 1)
