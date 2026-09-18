extends SceneTree

const STATE_SCRIPT: Script = preload("res://story/StoryState.gd")
const RPG_SCENE: PackedScene = preload("res://scenes/story/RPG.tscn")

func _initialize() -> void:
	var story := root.get_node_or_null("StoryState") as Node
	if story == null:
		print("CORE_RPG_ACCEPTANCE FAIL story_state_missing")
		quit(1)
	await process_frame
	var snapshot := {"schema":"generated-character-v2", "characterId":"core_rpg_acceptance", "displayName":"核心节点验收角色", "stats":{"cursedEnergy":"B", "control":"C", "efficiency":"C", "body":"B", "martial":"C", "talent":"A"}, "answers":{"identity":"咒术师", "innateTechnique":"无下限术式"}, "techniques":[{"id":"limitless", "name":"无下限术式"}], "techniqueFamilies":["limitless"], "cardTags":["limitless"], "specialHandTags":["limitless"], "techniquePower":"B"}
	story.call("begin_from_identity", snapshot)
	story.call("begin_node", "core_join_high_school")
	var scene := RPG_SCENE.instantiate() as Control
	root.add_child(scene)
	await process_frame
	await process_frame
	var flow := scene as Node
	var lines: Array = flow.get("lines") as Array
	var choices: Array = flow.get("choices") as Array
	var section := str((scene.get_node_or_null("Section/Label") as Label).text)
	var loaded := lines.size() == 3 and choices.size() == 2 and section.contains("W145")
	flow.call("_choose", "accept")
	await create_timer(0.8).timeout
	var history: Array = story.get("history") as Array
	var result: Dictionary = history[history.size() - 1] as Dictionary if not history.is_empty() else {}
	var core_choice: Dictionary = result.get("core_choice", {}) as Dictionary
	var passed := loaded and str(core_choice.get("wheel_id", "")) == "145" and str(core_choice.get("value", "")) == "是" and str(result.get("next_node", "")) == "core_high_school_campus"
	print("CORE_RPG_ACCEPTANCE %s loaded=%s wheel=%s value=%s next=%s" % ["PASS" if passed else "FAIL", loaded, str(core_choice.get("wheel_id", "")), str(core_choice.get("value", "")), str(result.get("next_node", ""))])
	quit(0 if passed else 1)
