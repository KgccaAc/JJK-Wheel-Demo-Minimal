extends SceneTree

func _initialize() -> void:
	call_deferred("_run")

func _run() -> void:
	var story: Node = root.get_node_or_null("StoryState")
	if story == null:
		print("STORY_UI_CONTRACT_ACCEPTANCE FAIL story_state_missing")
		quit(1)
		return
	story.call("begin_from_identity", {
		"displayName":"一个很长的角色姓名测试",
		"characterId":"ui-contract",
		"grade_label":"特级",
		"gender":"女",
		"age":"18岁",
		"stats":{"cursedEnergy":100,"control":90,"martial":80,"body":70,"efficiency":60,"talent":50},
		"answers":{"gender":"女","age":"18岁","startTime":"剧情开始时期","camp":"咒术师","traits":["六眼","两面四臂"],"cursedTools":["狱门疆"],"hobbies":["喜欢收集旧书"]}
	})
	var identity := (load("res://scenes/wheel/Identity.tscn") as PackedScene).instantiate() as Control
	root.add_child(identity)
	await process_frame
	var level := identity.get_node_or_null("Level") as TextureRect
	var name_label := identity.get_node_or_null("CharacterCard/Name") as Label
	var camp := identity.get_node_or_null("Identity/CampLabel/Camp") as Label
	var special := identity.get_node_or_null("Report/Special/Special") as Label
	var tools := identity.get_node_or_null("Report/Special2/Special") as Label
	var shadow := identity.get_node_or_null("CharacterCard/Picture") as TextureRect
	var level_ok := level != null and level.texture != null and str(level.texture.resource_path).ends_with("评级印章/EX.png")
	var fields_ok := name_label != null and camp != null and special != null and tools != null and name_label.text.contains("长的角色") and camp.text == "咒术师" and special.text.contains("六眼") and tools.text.contains("狱门疆") and not special.text.contains("null") and not tools.text.contains("null")
	var shadow_ok := shadow != null and shadow.texture != null and str(shadow.texture.resource_path).contains("少女剪影.png")
	var story_home := (load("res://scenes/story/StroyHome.tscn") as PackedScene).instantiate() as Control
	root.add_child(story_home)
	await process_frame
	var forum := story_home.get_node_or_null("Background/BottomNav/ForumButton") as TextureButton
	var chapter := story_home.get_node_or_null("Chapter/Cheaper") as Label
	var nav_ok := forum != null and forum.texture_normal != null and story_home.get_node_or_null("CharacterTable/StoryCharacterPicker") == null and chapter != null
	var passed := level_ok and fields_ok and shadow_ok and nav_ok
	print("STORY_UI_CONTRACT_ACCEPTANCE %s level=%s fields=%s shadow=%s nav=%s" % ["PASS" if passed else "FAIL", level_ok, fields_ok, shadow_ok, nav_ok])
	quit(0 if passed else 1)
