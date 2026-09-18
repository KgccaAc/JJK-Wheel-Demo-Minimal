extends SceneTree

func _initialize() -> void:
	var story := root.get_node_or_null("StoryState") as Node
	if story == null:
		print("CHAPTER1_BATTLE_CONTRACT_ACCEPTANCE FAIL story_state_missing")
		quit(1)
	story.call("begin_from_identity", {"displayName":"战斗契约验收", "stats":{}, "answers":{}})
	var ids := ["chapter1_battle", "chapter1_danger", "core_battle_shibuya_sukuna", "core_battle_shibuya_dagon", "core_battle_shibuya_choso", "core_battle_shibuya_hanami_jogo", "core_battle_shibuya_mahito", "core_battle_shibuya_kenjaku_choso", "core_battle_shibuya_smallpox", "core_battle_shibuya_haruta"]
	var errors: Array[String] = []
	for id: String in ids:
		var definition: Dictionary = story.call("node_definition", id) as Dictionary
		var contract: Dictionary = definition.get("runtimeContract", {}) as Dictionary
		var outcomes: Array = contract.get("battleRuleOutcomes", []) as Array
		if outcomes.size() != 3 or not outcomes.has("victory") or not outcomes.has("retreat") or not outcomes.has("defeat"):
			errors.append(id)
	var passed := errors.is_empty()
	print("CHAPTER1_BATTLE_CONTRACT_ACCEPTANCE %s checked=%d errors=%s" % ["PASS" if passed else "FAIL", ids.size(), ";".join(errors)])
	quit(0 if passed else 1)
