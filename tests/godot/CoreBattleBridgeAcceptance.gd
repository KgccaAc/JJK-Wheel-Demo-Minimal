extends SceneTree

const RPG_SCENE: PackedScene = preload("res://scenes/story/RPG.tscn")

func _initialize() -> void:
	var story := root.get_node_or_null("StoryState") as Node
	if story == null:
		print("CORE_BATTLE_BRIDGE_ACCEPTANCE FAIL story_state_missing")
		quit(1)
		return
	story.call("begin_from_identity", {"schema":"generated-character-v2", "characterId":"core_battle_bridge", "displayName":"核心战斗验收角色", "stats":{"cursedEnergy":"A", "control":"B", "efficiency":"B", "body":"B", "martial":"B", "talent":"A"}, "answers":{"identity":"咒术师"}, "techniques":[{"id":"limitless", "name":"无下限术式"}], "techniqueFamilies":["limitless"], "cardTags":["limitless"], "specialHandTags":["limitless"], "techniquePower":"B"})
	story.call("begin_node", "core_shibuya_high_school_impact")
	var scene := RPG_SCENE.instantiate() as Control
	root.add_child(scene)
	await process_frame
	await process_frame
	var choices: Array = scene.get("choices") as Array
	var configured := choices.size() == 6 and str((choices[3] as Dictionary).get("battleNode", "")) == "core_battle_shibuya_sukuna"
	if configured: scene.call("_choose_index", 3)
	await create_timer(0.9).timeout
	var history: Array = story.get("history") as Array
	var latest: Dictionary = history[history.size() - 1] as Dictionary if not history.is_empty() else {}
	var entered := str(story.get("current_node")) == "core_battle_shibuya_sukuna"
	var committed := str(latest.get("node_id", "")) == "core_shibuya_high_school_impact" and str(latest.get("next_node", "")) == "core_battle_shibuya_sukuna"
	var battle_definition: Dictionary = story.call("node_definition", "core_battle_shibuya_sukuna") as Dictionary
	var passed: bool = configured and entered and committed and str(battle_definition.get("type", "")) == "battle"
	print("CORE_BATTLE_BRIDGE_ACCEPTANCE %s configured=%s entered=%s committed=%s current=%s" % ["PASS" if passed else "FAIL", configured, entered, committed, str(story.get("current_node"))])
	quit(0 if passed else 1)
