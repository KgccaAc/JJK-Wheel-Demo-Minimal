extends SceneTree

func _initialize() -> void:
	var story := root.get_node_or_null("StoryState") as Node
	if story == null or not story.has_method("battle_context"):
		print("STORY_BATTLE_CONTEXT_ACCEPTANCE FAIL story_state_missing")
		quit(1)
	story.call("begin_from_identity", {"schema":"generated-character-v2", "characterId":"battle_context", "displayName":"战斗契约验收", "stats":{}, "answers":{}})
	var file := FileAccess.open("res://data/story/chapter1.json", FileAccess.READ)
	var parsed: Variant = JSON.parse_string(file.get_as_text()) if file != null else null
	var nodes: Array = (parsed as Dictionary).get("nodes", []) as Array if parsed is Dictionary else []
	var checked := 0
	var errors: Array[String] = []
	for raw: Variant in nodes:
		if not raw is Dictionary: continue
		var definition := raw as Dictionary
		if str(definition.get("type", "")) != "battle": continue
		var id := str(definition.get("id", ""))
		var context := story.call("battle_context", id) as Dictionary
		if context.is_empty() or str(context.get("node_id", "")) != id or str(context.get("opponent_id", "")).is_empty() or str(context.get("next_node", "")).is_empty() or bool(context.get("ai_allowed", true)):
			errors.append(id)
		else:
			checked += 1
	var passed := checked == 10 and errors.is_empty()
	print("STORY_BATTLE_CONTEXT_ACCEPTANCE %s checked=%d errors=%s" % ["PASS" if passed else "FAIL", checked, ";".join(errors)])
	quit(0 if passed else 1)
