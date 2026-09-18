extends SceneTree

func _initialize() -> void:
	var story: Node = root.get_node_or_null("StoryState")
	if story == null:
		print("CHAPTER1_BATTLE_TERMINAL_ACCEPTANCE FAIL story_state_missing")
		quit(1)
		return
	story.call("begin_from_identity", {"schema":"generated-character-v2", "characterId":"battle_terminal"})
	story.call("begin_node", "chapter1_battle")
	story.call("resolve_local", "chapter1_battle", "河岸战斗", "角色在战斗中死亡。", {"hp":-100}, {}, "chapter1_end", "battle", {}, {}, {"protagonist_dead":true, "run_terminal":true})
	story.call("commit_pending")
	var flags: Dictionary = story.get("flags") as Dictionary
	var passed := bool(flags.get("protagonist_dead", false)) and bool(flags.get("run_terminal", false)) and str(story.get("current_node")) == "chapter1_end"
	print("CHAPTER1_BATTLE_TERMINAL_ACCEPTANCE %s dead=%s terminal=%s current=%s" % ["PASS" if passed else "FAIL", flags.get("protagonist_dead", false), flags.get("run_terminal", false), str(story.get("current_node"))])
	quit(0 if passed else 1)
