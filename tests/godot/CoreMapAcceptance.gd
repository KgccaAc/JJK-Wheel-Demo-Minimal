extends SceneTree

const MAP_SCENE: PackedScene = preload("res://scenes/story/Map.tscn")

func _initialize() -> void:
	var story := root.get_node_or_null("StoryState") as Node
	if story == null:
		print("CORE_MAP_ACCEPTANCE FAIL story_state_missing")
		quit(1)
	var snapshot := {"schema":"generated-character-v2", "characterId":"core_map_acceptance", "displayName":"地图验收角色", "stats":{"cursedEnergy":"B", "control":"C", "efficiency":"C", "body":"B", "martial":"C", "talent":"A"}, "answers":{"identity":"咒术师", "innateTechnique":"无下限术式"}}
	story.call("begin_from_identity", snapshot)
	story.call("begin_node", "core_high_school_campus")
	var scene := MAP_SCENE.instantiate() as Control
	root.add_child(scene)
	await process_frame
	await process_frame
	var flow := scene as Node
	var definition: Dictionary = flow.call("_map_definition", "NodeTypeDone") as Dictionary
	var title := str((scene.get_node_or_null("Map/NodeTitle") as Label).text)
	var passed := str(definition.get("node", "")) == "core_high_school_campus" and title.contains("高专在哪个校")
	print("CORE_MAP_ACCEPTANCE %s node=%s title=%s" % ["PASS" if passed else "FAIL", str(definition.get("node", "")), title])
	quit(0 if passed else 1)
