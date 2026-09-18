extends SceneTree

const RPG_SCENE: PackedScene = preload("res://scenes/story/RPG.tscn")

func _initialize() -> void:
	var story := root.get_node_or_null("StoryState") as Node
	if story == null:
		print("SHIBUYA_OUTCOME_ACCEPTANCE FAIL story_state_missing")
		quit(1)
	story.call("begin_from_identity", _battle_snapshot("shibuya_outcome", "涩谷结果验收角色"))
	var rescue := await _play_node(story, "core_shibuya_gojo_rescue", 1)
	var bridge := await _play_node(story, "core_shibuya_gojo_state_bridge", 1)
	var plan := await _play_node(story, "core_shibuya_kenjaku_plan_state", 2)
	var worldline := await _play_node(story, "core_shibuya_worldline_state", 0)
	var sukuna := await _play_node(story, "core_shibuya_sukuna_line", 1)
	var revival := await _play_node(story, "core_shibuya_sukuna_revival", 0)
	var after := await _play_node(story, "core_shibuya_after_state", 0)
	var outcome := await _play_node(story, "core_shibuya_outcome", 0)
	var high_pass := _choice_ok(rescue, 150, "五条封印，但抢到狱门疆", "core_shibuya_gojo_state_bridge") and _choice_ok(bridge, 0, "五条被封印但狱门疆被高专夺回", "core_shibuya_kenjaku_plan_state") and _choice_ok(plan, 0, "羂索逃走，原著大体继续", "core_shibuya_worldline_state") and _choice_ok(worldline, 0, "原著修正力回归，后续仍大体发生", "core_shibuya_after_state") and _choice_ok(sukuna, 152, "依旧复活，但实力大减", "core_shibuya_sukuna_revival") and _choice_ok(revival, 153, "被五条当减速带", "core_shibuya_worldline_state") and _choice_ok(after, 69, "重伤存活（不能参加死灭回游）", "core_shibuya_outcome") and str(outcome.get("source", "")) == "hidden_wheel" and not str(outcome.get("title", "")).is_empty() and str(outcome.get("next_node", "")) == "core_shibuya_end" and int((after.get("resource_delta", {}) as Dictionary).get("hp", 0)) == -45
	story.call("begin_from_identity", _battle_snapshot("shibuya_non_high_school", "非高专结果验收角色"))
	var non_high := await _play_node(story, "core_shibuya_non_high_school", 4)
	var non_battle_ok := _finish_battle_bridge(story, non_high)
	var non_after := await _play_node(story, "core_shibuya_after_state", 1)
	var non_outcome := await _play_node(story, "core_shibuya_outcome", 0)
	var non_pass := non_battle_ok and _choice_ok(non_high, 98, "对战春太", "core_battle_shibuya_haruta") and _choice_ok(non_after, 69, "存活", "core_shibuya_outcome") and str(non_outcome.get("source", "")) == "hidden_wheel" and str(non_outcome.get("next_node", "")) == "core_shibuya_end"
	var passed := high_pass and non_pass
	print("SHIBUYA_OUTCOME_ACCEPTANCE %s high=%s non_high=%s current=%s" % ["PASS" if passed else "FAIL", high_pass, non_pass, str(story.get("current_node"))])
	quit(0 if passed else 1)

func _play_node(story: Node, node_id: String, option_index: int) -> Dictionary:
	story.call("begin_node", node_id)
	var scene := RPG_SCENE.instantiate() as Control
	root.add_child(scene)
	await process_frame
	await process_frame
	var choices: Array = scene.get("choices") as Array if scene.get("choices") is Array else []
	if choices.is_empty():
		print("SHIBUYA_OUTCOME_DEBUG node=%s definition=%s" % [node_id, story.call("node_definition", node_id)])
	if option_index >= choices.size(): return {}
	scene.call("_choose_index", option_index)
	await create_timer(0.8).timeout
	var history: Array = story.get("history") as Array
	return history[history.size() - 1] as Dictionary if not history.is_empty() else {}

func _choice_ok(result: Dictionary, wheel_id: int, value: String, next_node: String) -> bool:
	var choice: Dictionary = result.get("core_choice", {}) as Dictionary
	return int(choice.get("wheel_id", 0)) == wheel_id and str(choice.get("value", "")) == value and str(result.get("next_node", "")) == next_node

func _battle_snapshot(character_id: String, display_name: String) -> Dictionary:
	return {"schema":"generated-character-v2", "characterId":character_id, "displayName":display_name, "stats":{"cursedEnergy":"B", "control":"C", "efficiency":"C", "body":"B", "martial":"C", "talent":"A"}, "answers":{"identity":"咒术师"}, "techniques":[{"id":"limitless", "name":"无下限术式"}], "techniqueFamilies":["limitless"], "cardTags":["limitless"], "specialHandTags":["limitless"], "techniquePower":"B"}

func _finish_battle_bridge(story: Node, choice_result: Dictionary) -> bool:
	var battle_node := str(choice_result.get("next_node", ""))
	if not battle_node.begins_with("core_battle_"): return false
	var definition: Dictionary = story.call("node_definition", battle_node) as Dictionary
	if str(definition.get("type", "")) != "battle": return false
	story.call("begin_node", battle_node)
	story.call("resolve_local", battle_node, str(definition.get("title", "核心战斗")), "测试战斗完成。", {"xp":10}, {}, str(definition.get("next", "")), "battle_acceptance")
	story.call("commit_pending")
	return str(story.get("current_node")) == str(definition.get("next", ""))
