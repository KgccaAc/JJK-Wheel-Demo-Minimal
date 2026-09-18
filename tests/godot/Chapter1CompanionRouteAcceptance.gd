extends SceneTree

const RPG_SCENE: PackedScene = preload("res://scenes/story/RPG.tscn")

func _initialize() -> void:
	var story := root.get_node_or_null("StoryState") as Node
	if story == null:
		print("CHAPTER1_COMPANION_ROUTE_ACCEPTANCE FAIL story_state_missing")
		quit(1)
	story.call("begin_from_identity", {"displayName":"伙伴路线验收", "stats":{}, "answers":{}})
	var resources: Dictionary = story.get("resources") as Dictionary
	resources["xp"] = 20
	story.set("resources", resources)
	story.call("mark_flag", "river_safe_mark_seen", true)
	story.call("begin_node", "chapter1_branch")
	var scene := RPG_SCENE.instantiate() as Control
	root.add_child(scene)
	await process_frame
	await process_frame
	var choices: Array = scene.get("choices") as Array
	var recruit_index := -1
	for index: int in choices.size():
		if str((choices[index] as Dictionary).get("id", "")) == "junior_commitment": recruit_index = index
	var visible := recruit_index >= 0
	if visible: scene.call("_choose_index", recruit_index)
	await create_timer(0.8).timeout
	var pending: Dictionary = story.get("pending_result") as Dictionary
	if pending.is_empty():
		var history: Array = story.get("history") as Array
		pending = history[history.size() - 1] as Dictionary if not history.is_empty() else {}
	var delta: Dictionary = pending.get("relationship_delta", {}) as Dictionary
	var npc_delta: Dictionary = delta.get("junior_sorcerer", {}) as Dictionary
	var npc_flags: Dictionary = pending.get("npc_flags", {}) as Dictionary
	var route_ok := bool((npc_flags.get("junior_sorcerer", {}) as Dictionary).get("junior_personal_event_done", false)) and int(npc_delta.get("respect", 0)) == 2
	if not pending.is_empty(): story.call("commit_pending")
	var npc_state: Dictionary = story.call("npc_state", "junior_sorcerer") as Dictionary
	var passed := visible and route_ok and bool(npc_state.get("companion", false)) and str(npc_state.get("route_stage", "")) == "recruit"
	print("CHAPTER1_COMPANION_ROUTE_ACCEPTANCE %s visible=%s route=%s delta=%s flags=%s stage=%s companion=%s" % ["PASS" if passed else "FAIL", visible, route_ok, npc_delta, npc_flags, str(npc_state.get("route_stage", "")), npc_state.get("companion", false)])
	quit(0 if passed else 1)
