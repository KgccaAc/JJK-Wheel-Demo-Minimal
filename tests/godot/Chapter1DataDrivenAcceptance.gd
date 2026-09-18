extends SceneTree

const RPG_SCENE: PackedScene = preload("res://scenes/story/RPG.tscn")

func _initialize() -> void:
	var story: Node = root.get_node_or_null("StoryState")
	if story == null:
		print("CHAPTER1_DATA_DRIVEN_ACCEPTANCE FAIL story_state_missing")
		quit(1)
		return
	story.call("begin_from_identity", {"schema":"generated-character-v2", "characterId":"data_driven", "displayName":"数据驱动验收角色", "stats":{"cursedEnergy":100}})
	var intro_definition: Dictionary = story.call("node_definition", "chapter1_intro") as Dictionary
	var intro_choices: Array = intro_definition.get("choices", []) as Array
	var intro_ok := intro_choices.size() == 2 and str((intro_choices[0] as Dictionary).get("next", "")) == "chapter1_selection"
	story.call("begin_node", "chapter1_clue")
	var clue := RPG_SCENE.instantiate() as Control
	root.add_child(clue)
	await process_frame
	await process_frame
	var choices: Array = clue.get("choices") as Array
	var choice_ok := choices.size() == 2 and str((choices[0] as Dictionary).get("next", "")) == "chapter1_battle"
	clue.call("_choose_index", 0)
	await create_timer(1.6).timeout
	var pending: Dictionary = story.get("pending_result") as Dictionary
	var history: Array = story.get("history") as Array
	var result: Dictionary = history[history.size() - 1] as Dictionary if not history.is_empty() else {}
	var result_ok := str(result.get("node_id", "")) == "chapter1_clue" and str(result.get("source", "")) == "story_choice" and int((result.get("resource_delta", {}) as Dictionary).get("ce", 0)) == -5
	var passed := intro_ok and choice_ok and result_ok
	print("CHAPTER1_DATA_DRIVEN_ACCEPTANCE %s intro=%s clue_choices=%s result=%s" % ["PASS" if passed else "FAIL", intro_ok, choice_ok, result_ok])
	quit(0 if passed else 1)
