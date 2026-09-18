extends SceneTree

const MAP_SCENE: PackedScene = preload("res://scenes/story/Map.tscn")

func _initialize() -> void:
	var story := root.get_node_or_null("StoryState") as Node
	if story == null:
		print("CHAPTER1_MAP_ROUTE_ACCEPTANCE FAIL story_state_missing")
		quit(1)
		return
	var normal_ok := await _route_unlocks_done(story, "chapter1_battle")
	var danger_ok := await _route_unlocks_done(story, "chapter1_danger")
	var passed := normal_ok and danger_ok
	print("CHAPTER1_MAP_ROUTE_ACCEPTANCE %s normal=%s danger=%s" % ["PASS" if passed else "FAIL", normal_ok, danger_ok])
	quit(0 if passed else 1)

func _route_unlocks_done(story: Node, completed_node: String) -> bool:
	story.call("begin_from_identity", {"schema":"generated-character-v2", "characterId":"map_route_%s" % completed_node})
	story.call("begin_node", completed_node)
	story.call("resolve_local", completed_node, "路线结算", "测试路线完成。", {}, {}, "chapter1_end", "acceptance")
	story.call("commit_pending")
	var map := MAP_SCENE.instantiate() as Control
	root.add_child(map)
	await process_frame
	await process_frame
	var locks: Dictionary = map.get("node_locked") as Dictionary
	var selected := str(map.get("selected_node"))
	var unlocked := not bool(locks.get("NodeTypeDone", true)) and selected == "NodeTypeDone"
	map.queue_free()
	await process_frame
	return unlocked
