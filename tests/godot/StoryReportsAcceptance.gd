extends SceneTree

func _initialize() -> void:
	var story: Node = root.get_node_or_null("StoryState")
	if story == null:
		print("STORY_REPORTS_ACCEPTANCE FAIL story_state_missing")
		quit(1)
		return
	story.call("begin_from_identity", {"displayName":"报告验收角色", "characterId":"reports", "stats":{"cursedEnergy":12,"control":8}})
	story.call("begin_node", "chapter1_selection")
	story.call("resolve_local", "chapter1_selection", "初来乍到", "你在仙台观察了街道。", {"xp":4,"money":-2}, {"悟性":1}, "chapter1_map", "hidden_wheel", {"junior_sorcerer":{"affection":3}}, {}, {"river_witness_found":true}, {"river_protective_talisman":1})
	story.call("commit_pending")
	var status: Dictionary = story.call("build_character_report") as Dictionary
	var experience: Dictionary = story.call("build_experience_report") as Dictionary
	var novel: Dictionary = story.call("generate_story_novel") as Dictionary
	var before: Dictionary = story.call("snapshot") as Dictionary
	var valid := str(status.get("displayName", "")) == "报告验收角色" and int((status.get("resources", {}) as Dictionary).get("xp", 0)) == 4
	valid = valid and int((status.get("inventory", {}) as Dictionary).get("river_protective_talisman", 0)) == 1
	valid = valid and int(experience.get("eventCount", 0)) == 1 and bool(experience.get("events", []).size() == 1)
	valid = valid and bool(novel.get("ok", false)) and str(novel.get("text", "")).contains("报告验收角色") and str(novel.get("text", "")).contains("初来乍到")
	var after: Dictionary = story.call("snapshot") as Dictionary
	valid = valid and JSON.stringify(before) == JSON.stringify(after)
	print("STORY_REPORTS_ACCEPTANCE %s status=%s experience=%s novel=%s immutable=%s" % ["PASS" if valid else "FAIL", status.has("resources"), experience.get("eventCount", 0), novel.get("source", ""), JSON.stringify(before) == JSON.stringify(after)])
	quit(0 if valid else 1)
