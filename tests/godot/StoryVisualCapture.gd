extends SceneTree

const OUTPUT_DIR := "res://reports/story_screens"
const SCENES := {
	"01_identity":"res://scenes/wheel/identity.tscn",
	"02_select":"res://scenes/wheel/Select.tscn",
	"03_story_home":"res://scenes/story/StroyHome.tscn",
	"04_rpg":"res://scenes/story/RPG.tscn",
	"05_selection":"res://scenes/story/selection.tscn",
	"06_map":"res://scenes/story/Map.tscn",
	"07_battle":"res://scenes/battle/battle_scene.tscn",
	"08_settlement":"res://scenes/story/settlement.tscn"
}

func _initialize() -> void:
	call_deferred("_capture_all")

func _capture_all() -> void:
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(OUTPUT_DIR))
	var story: Node = get_root().get_node_or_null("StoryState")
	if story != null:
		story.call("begin_from_identity", {"schema":"generated-character-v2", "characterId":"capture_wheel_character", "displayName":"测试术师", "grade_label":"二级", "stats":{"cursedEnergy":"B", "control":"C", "efficiency":"C", "body":"B", "martial":"C", "talent":"A"}, "techniques":[{"id":"limitless", "name":"无下限术式"}], "techniqueFamilies":["limitless"], "cardTags":["limitless"], "specialHandTags":["limitless"], "techniquePower":"B", "answers":{"identity":"咒术师", "innateTechnique":"无下限术式"}})
	for capture_name: String in SCENES:
		if capture_name == "06_map" and story != null:
			story.call("resolve_local", "chapter1_selection", "初来乍到·一日调查", "你完成了一日调查并发现河岸残秽。", {"xp":13}, {"悟性":1}, "chapter1_map", "capture")
			story.call("commit_pending")
		if capture_name == "07_battle" and story != null:
			story.call("apply_npc_delta", "junior_sorcerer", {"affection":60, "trust":3, "respect":2}, {"junior_personal_event_done":true})
			story.call("begin_node", "chapter1_battle")
		if capture_name == "08_settlement" and story != null:
			story.call("resolve_local", "chapter1_battle", "河岸的低级咒灵", "你击溃了河岸的低级咒灵，第一次确认自己能够真正战斗。", {"hp":-12,"ce":-18,"stability":-4,"xp":16}, {"体术":2,"体质":1}, "chapter1_end", "capture", {"junior_sorcerer":{"affection":10,"trust":1,"respect":1}}, {"junior_sorcerer":{"junior_battle_completed":true,"junior_protected":true}})
		var packed := load(str(SCENES[capture_name])) as PackedScene
		var scene := packed.instantiate() as Control
		get_root().add_child(scene)
		await create_timer(1.2).timeout
		var image := get_root().get_texture().get_image()
		var error := image.save_png("%s/%s.png" % [OUTPUT_DIR, capture_name])
		print("CAPTURE %s %s" % [capture_name, error_string(error)])
		scene.queue_free()
		await process_frame
	quit()
