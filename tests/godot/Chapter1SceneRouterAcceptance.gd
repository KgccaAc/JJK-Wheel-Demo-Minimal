extends SceneTree

func _initialize() -> void:
	var story := root.get_node_or_null("StoryState") as Node
	if story == null or not story.has_method("scene_for_node"):
		print("CHAPTER1_SCENE_ROUTER_ACCEPTANCE FAIL story_state_missing")
		quit(1)
	story.call("begin_from_identity", {"schema":"generated-character-v2", "characterId":"scene_router", "displayName":"场景路由验收角色", "stats":{}, "answers":{}})
	var file := FileAccess.open("res://data/story/chapter1.json", FileAccess.READ)
	if file == null:
		print("CHAPTER1_SCENE_ROUTER_ACCEPTANCE FAIL chapter_missing")
		quit(1)
	var parsed: Variant = JSON.parse_string(file.get_as_text())
	var nodes: Array = (parsed as Dictionary).get("nodes", []) as Array if parsed is Dictionary else []
	var checked := 0
	var errors: Array[String] = []
	for raw: Variant in nodes:
		if not raw is Dictionary: continue
		var definition := raw as Dictionary
		var node_id := str(definition.get("id", ""))
		var scene := str(story.call("scene_for_node", node_id))
		if node_id.is_empty() or scene.is_empty() or not ResourceLoader.exists(scene):
			errors.append("%s:%s" % [node_id, scene])
		else:
			checked += 1
	var passed := checked == nodes.size() and errors.is_empty()
	print("CHAPTER1_SCENE_ROUTER_ACCEPTANCE %s checked=%d errors=%s" % ["PASS" if passed else "FAIL", checked, ";".join(errors)])
	quit(0 if passed else 1)
