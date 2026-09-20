extends SceneTree

const OUTPUT_DIR := "res://reports/all-pages/screenshots"
const REPORT_PATH := "res://reports/all-pages/all-pages-latest.json"
const PAGES: Array[Dictionary] = [
	{"id":"01_login", "scene":"res://scenes/auth/auth_login.tscn"},
	{"id":"02_home", "scene":"res://scenes/home/home.tscn"},
	{"id":"03_wheel", "scene":"res://scenes/wheel/wheel.tscn"},
	{"id":"04_identity", "scene":"res://scenes/wheel/identity.tscn"},
	{"id":"05_mode_select", "scene":"res://scenes/wheel/Select.tscn"},
	{"id":"06_story_home", "scene":"res://scenes/story/StroyHome.tscn"},
	{"id":"07_rpg", "scene":"res://scenes/story/RPG.tscn"},
	{"id":"08_selection", "scene":"res://scenes/story/selection.tscn"},
	{"id":"09_settlement", "scene":"res://scenes/story/settlement.tscn"},
	{"id":"10_map", "scene":"res://scenes/story/Map.tscn"},
	{"id":"11_roster", "scene":"res://scenes/roster/roster_picker.tscn"},
	{"id":"12_community", "scene":"res://scenes/community/community.tscn"},
	{"id":"13_community_vote", "scene":"res://scenes/community/community_vote.tscn"},
	{"id":"14_community_discussion", "scene":"res://scenes/community/community_discussion.tscn"},
	{"id":"15_battle_character_selection", "scene":"res://scenes/battle/character_selection.tscn"},
	{"id":"16_battle", "scene":"res://scenes/battle/battle_scene.tscn"},
	{"id":"18_strategy", "scene":"res://scenes/battle/strategy_selection.tscn"},
	{"id":"19_first_move", "scene":"res://scenes/battle/first_move_contest.tscn"},
	{"id":"20_summoned", "scene":"res://scenes/battle/preview_summoned.tscn"},
	{"id":"21_round_summary", "scene":"res://scenes/battle/round_summary_panel.tscn"},
	{"id":"22_online", "scene":"res://scenes/online/online_room.tscn"},
	{"id":"23_online_room", "scene":"res://scenes/online/room_page.tscn"},
	{"id":"24_matchmaking", "scene":"res://scenes/online/matchmaking_page.tscn"},
	{"id":"25_profile", "scene":"res://scenes/profile/profile_page.tscn"},
]

var results: Array[Dictionary] = []

func _initialize() -> void:
	call_deferred("_capture_all")

func _capture_all() -> void:
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(OUTPUT_DIR))
	_prepare_state()
	for page: Dictionary in PAGES:
		await _capture_page(page)
	var failures: Array[Dictionary] = results.filter(func(row: Dictionary) -> bool: return str(row.get("status", "")) != "passed")
	var report: Dictionary = {
		"schema":"jjk-all-pages-visual-capture-v1",
		"generated_at":Time.get_datetime_string_from_system(true),
		"viewport":{"width":root.size.x, "height":root.size.y},
		"pages":results,
		"total":results.size(),
		"passed":results.size() - failures.size(),
		"failed":failures.size(),
		"status":"passed" if failures.is_empty() else "failed",
	}
	var file: FileAccess = FileAccess.open(REPORT_PATH, FileAccess.WRITE)
	if file != null:
		file.store_string(JSON.stringify(report, "  "))
		file.close()
	print("ALL_PAGES_VISUAL_CAPTURE %s pages=%d failures=%d" % ["PASS" if failures.is_empty() else "FAIL", results.size(), failures.size()])
	quit(0 if failures.is_empty() else 1)

func _prepare_state() -> void:
	var account: Node = root.get_node_or_null("AccountState")
	if account != null:
		account.call("use_test_storage", "user://all-pages-visual-account.cfg")
		account.call("clear_for_test")
		account.call("create_local_normal_card")
	var story: Node = root.get_node_or_null("StoryState")
	if story == null:
		return
	story.call("begin_from_identity", {
		"schema":"generated-character-v2",
		"characterId":"all-pages-wheel-character",
		"displayName":"全页面审核术师",
		"grade_label":"一级",
		"stats":{"cursedEnergy":"A", "control":"B", "efficiency":"B", "body":"B", "martial":"B", "talent":"A"},
		"techniques":[{"id":"limitless", "name":"无下限术式"}],
		"techniqueFamilies":["limitless"],
		"cardTags":["limitless"],
		"specialHandTags":["limitless"],
		"answers":{"identity":"咒术师", "innateTechnique":"无下限术式", "camp":"咒术高专"},
	})
	story.call("begin_node", "chapter1_battle")
	story.call("resolve_local", "chapter1_battle", "页面审核结算", "用于验证结算页面的审核记录。", {"xp":8}, {"悟性":1}, "chapter1_end", "visual_capture")

func _capture_page(page: Dictionary) -> void:
	var scene_path: String = str(page.get("scene", ""))
	var capture_id: String = str(page.get("id", "page"))
	var packed: PackedScene = load(scene_path) as PackedScene
	if packed == null:
		results.append({"id":capture_id, "scene":scene_path, "status":"load_failed"})
		return
	var instance: Node = packed.instantiate()
	root.add_child(instance)
	await process_frame
	await process_frame
	await create_timer(1.2).timeout
	var relative_path: String = "%s/%s.png" % [OUTPUT_DIR, capture_id]
	var window_texture := root.get_texture()
	if window_texture == null:
		results.append({"id":capture_id, "scene":scene_path, "status":"capture_failed", "error":"window_texture_unavailable"})
		instance.queue_free()
		await process_frame
		return
	var error: Error = window_texture.get_image().save_png(relative_path)
	results.append({
		"id":capture_id,
		"scene":scene_path,
		"screenshot":relative_path.trim_prefix("res://"),
		"status":"passed" if error == OK else "capture_failed",
		"error":error_string(error) if error != OK else "",
	})
	instance.queue_free()
	await process_frame
