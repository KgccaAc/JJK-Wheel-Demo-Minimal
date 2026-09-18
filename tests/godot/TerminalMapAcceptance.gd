extends SceneTree

const MAP_SCENE: PackedScene = preload("res://scenes/story/Map.tscn")

func _initialize() -> void:
	var story: Node = root.get_node_or_null("StoryState")
	if story == null:
		print("TERMINAL_MAP_ACCEPTANCE FAIL story_state_missing")
		quit(1)
		return
	story.call("begin_from_identity", {"schema":"generated-character-v2", "characterId":"terminal_map", "displayName":"终止地图验收角色"})
	story.call("mark_flag", "run_terminal", true)
	story.call("begin_node", "chapter1_end")
	var map := MAP_SCENE.instantiate() as Control
	root.add_child(map)
	await process_frame
	await process_frame
	var before := str(story.get("current_node"))
	map.call("_enter_selected_node")
	await process_frame
	var after := str(story.get("current_node"))
	var subtitle := map.get_node_or_null("Map/NodeSubTitle") as Label
	var passed := before == "chapter1_end" and after == before and subtitle != null and subtitle.text.contains("已终止")
	print("TERMINAL_MAP_ACCEPTANCE %s current=%s subtitle=%s" % ["PASS" if passed else "FAIL", after, subtitle.text if subtitle != null else "missing"])
	quit(0 if passed else 1)
