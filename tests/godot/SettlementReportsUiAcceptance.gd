extends SceneTree

func _initialize() -> void:
	var story: Node = root.get_node_or_null("StoryState")
	if story == null:
		print("SETTLEMENT_REPORTS_UI_ACCEPTANCE FAIL story_state_missing")
		quit(1)
		return
	story.call("begin_from_identity", {"displayName":"结算页验收角色"})
	story.call("begin_node", "chapter1_selection")
	story.call("resolve_local", "chapter1_selection", "测试结算", "测试经历", {"xp":1}, {}, "chapter1_map")
	var scene := (load("res://scenes/story/settlement.tscn") as PackedScene).instantiate() as Control
	root.add_child(scene)
	await process_frame
	var reports := scene.get_node_or_null("Review") as BaseButton
	var history := scene.get_node_or_null("History") as BaseButton
	var passed: bool = reports != null and reports.has_meta("settlement_review_bound") and history != null and (story.get("history") as Array).size() == 1
	print("SETTLEMENT_REPORTS_UI_ACCEPTANCE %s reports=%s history=%s" % ["PASS" if passed else "FAIL", reports != null, history != null])
	quit(0 if passed else 1)
