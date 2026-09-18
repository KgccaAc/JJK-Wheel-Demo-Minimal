extends SceneTree

const STATE_SCRIPT: Script = preload("res://story/StoryState.gd")
const ADAPTER_SCRIPT: Script = preload("res://story/StoryBattleAdapter.gd")
const SESSION_SCRIPT: Script = preload("res://battle/core/BattleFlowSession.gd")

func _initialize() -> void:
	var story := STATE_SCRIPT.new() as Node
	root.add_child(story)
	await process_frame
	var snapshot := {"schema":"generated-character-v2", "characterId":"companion_battle_character", "displayName":"伙伴验收角色", "stats":{"cursedEnergy":"B", "control":"C", "efficiency":"C", "body":"B", "martial":"C", "talent":"A"}, "techniques":[{"id":"limitless", "name":"无下限术式"}], "techniqueFamilies":["limitless"], "cardTags":["limitless"], "specialHandTags":["limitless"], "techniquePower":"B"}
	story.call("begin_from_identity", snapshot)
	story.call("apply_npc_delta", "junior_sorcerer", {"affection":60, "trust":3, "respect":2}, {"junior_personal_event_done":true})
	var battle_snapshot: Dictionary = ADAPTER_SCRIPT.build_snapshot(story) as Dictionary
	var custom_cards: Array = battle_snapshot.get("customHandCards", []) as Array
	var support_found := false
	for raw: Variant in custom_cards:
		if raw is Dictionary and str((raw as Dictionary).get("id", "")) == "companion_junior_protective_intervention": support_found = true
	var session: RefCounted = SESSION_SCRIPT.new()
	var result: Dictionary = session.start_story_offline(battle_snapshot, "kechizu_origin_candidate", 20260916, true)
	var state: Dictionary = session.get_state_snapshot() if bool(result.get("ok", false)) else {}
	var player: Dictionary = (state.get("actors", []) as Array)[0] as Dictionary if (state.get("actors", []) as Array).size() > 0 else {}
	var player_cards: Array = (player.get("zones", {}) as Dictionary).get("hand", []) as Array
	var dealt_support := false
	var support_instance := ""
	for raw: Variant in player_cards:
		if raw is Dictionary and str((raw as Dictionary).get("id", "")) == "companion_junior_protective_intervention": dealt_support = true; support_instance = str((raw as Dictionary).get("instance_id", ""))
	var guard_after := 0.0
	var resolve_error := ""
	if dealt_support:
		var player_discards: Array = []
		for raw: Variant in player_cards:
			if raw is Dictionary and str((raw as Dictionary).get("instance_id", "")) != support_instance and player_discards.size() < 2: player_discards.append(str((raw as Dictionary).get("instance_id", "")))
		var opponent_hand: Array = ((session.state.actors[1] as Dictionary).get("zones", {}) as Dictionary).get("hand", []) as Array
		var opponent_discards: Array = []
		for index: int in 2: opponent_discards.append(str((opponent_hand[index] as Dictionary).get("instance_id", "")))
		session.discard_cards(0, player_discards, session.state.revision)
		session.discard_cards(1, opponent_discards, session.state.revision)
		session.submit_initiative(0, 0, session.state.revision)
		session.submit_initiative(1, 0, session.state.revision)
		session.submit_play(0, [support_instance], [], session.state.revision)
		session.submit_play(1, [], [], session.state.revision)
		var resolved: Dictionary = session.resolve_round(session.state.revision)
		resolve_error = str(resolved.get("error", ""))
		guard_after = float((session.state.actors[0] as Dictionary).get("guard", 0.0)) if bool(resolved.get("ok", false)) else 0.0
	var passed := support_found and dealt_support and guard_after >= 40.0 and bool(result.get("ok", false))
	print("COMPANION_BATTLE_ACCEPTANCE %s injected=%s dealt=%s guard=%.1f error=%s" % ["PASS" if passed else "FAIL", support_found, dealt_support, guard_after, resolve_error])
	story.queue_free()
	quit(0 if passed else 1)
