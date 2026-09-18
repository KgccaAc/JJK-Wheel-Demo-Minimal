extends SceneTree

func _initialize() -> void:
	var story: Node = root.get_node_or_null("StoryState")
	if story == null:
		print("NPC_DIALOGUE_ROUTE_ACCEPTANCE FAIL story_state_missing")
		quit(1)
		return
	story.call("begin_from_identity", {"displayName":"NPC路线验收角色"})
	var first: Array = story.call("npc_dialogue", "junior_sorcerer", "first_meeting") as Array
	var choices: Array = story.call("npc_route_choices", "junior_sorcerer") as Array
	var story_before: Dictionary = story.call("npc_route_story", "junior_sorcerer", "junior_personal_event") as Dictionary
	story.call("apply_npc_delta", "junior_sorcerer", {"affection":30,"trust":2}, {"junior_personal_event_done":true})
	var story_after: Dictionary = story.call("npc_route_story", "junior_sorcerer", "junior_personal_event") as Dictionary
	story.call("begin_node", "chapter1_branch")
	var page := (load("res://scenes/story/RPG.tscn") as PackedScene).instantiate() as Control
	root.add_child(page)
	await process_frame
	var branch_lines: Array = page.get("lines") as Array
	var passed := first.size() >= 2 and choices.size() >= 4 and story_before.is_empty() and not story_after.is_empty() and branch_lines.size() >= 5
	print("NPC_DIALOGUE_ROUTE_ACCEPTANCE %s dialogue=%d choices=%d exclusive=%s injected=%s" % ["PASS" if passed else "FAIL", first.size(), choices.size(), not story_after.is_empty(), branch_lines.size() >= 5])
	quit(0 if passed else 1)
