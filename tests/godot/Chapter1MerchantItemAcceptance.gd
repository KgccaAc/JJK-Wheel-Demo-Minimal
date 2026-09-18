extends SceneTree

const ADAPTER: Script = preload("res://story/StoryBattleAdapter.gd")

func _initialize() -> void:
	var story: Node = root.get_node_or_null("StoryState")
	if story == null:
		print("CHAPTER1_MERCHANT_ITEM_ACCEPTANCE FAIL story_state_missing")
		quit(1)
		return
	story.call("begin_from_identity", {"schema":"generated-character-v2", "characterId":"merchant_item"})
	story.call("begin_node", "chapter1_optional_event")
	story.call("resolve_local", "chapter1_optional_event", "咒具商人的试探", "获得护符。", {"money":-15}, {}, "chapter1_branch", "hidden_wheel", {}, {}, {"river_tool_obtained":true}, {"river_protective_talisman":1})
	story.call("commit_pending")
	var snapshot: Dictionary = ADAPTER.build_snapshot(story)
	var cards: Array = snapshot.get("customHandCards", []) as Array
	var found := false
	for raw: Variant in cards:
		if raw is Dictionary and str((raw as Dictionary).get("id", "")) == "river_protective_talisman": found = true
	var passed := int((story.get("inventory") as Dictionary).get("river_protective_talisman", 0)) == 1 and found
	print("CHAPTER1_MERCHANT_ITEM_ACCEPTANCE %s inventory=%s card=%s" % ["PASS" if passed else "FAIL", story.get("inventory"), found])
	quit(0 if passed else 1)
