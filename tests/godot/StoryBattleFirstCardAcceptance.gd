extends SceneTree

const SESSION_SCRIPT: Script = preload("res://battle/core/BattleFlowSession.gd")
const ADAPTER_SCRIPT: Script = preload("res://story/StoryBattleAdapter.gd")

const SNAPSHOT: Dictionary = {
	"schema":"generated-character-v2",
	"characterId":"story_first_card_acceptance",
	"displayName":"故事首牌验收角色",
	"stats":{"cursedEnergy":"B", "control":"C", "efficiency":"C", "body":"B", "martial":"B", "talent":"A"},
	"techniques":[{"id":"limitless", "name":"无下限术式"}],
	"techniqueFamilies":["limitless"],
	"cardTags":["limitless"],
	"specialHandTags":["limitless"],
	"techniquePower":"B"
}

func _initialize() -> void:
	call_deferred("_run")

func _run() -> void:
	var story: Node = root.get_node_or_null("StoryState") as Node
	if story == null:
		_fail("story_state_missing")
		return
	var failures: Array[String] = []
	for node_id: String in ["chapter1_battle", "chapter1_danger"]:
		var definition: Dictionary = story.call("node_definition", node_id) as Dictionary
		var opponent_id: String = ADAPTER_SCRIPT.opponent_id_for_definition(definition)
		var session: RefCounted = SESSION_SCRIPT.new()
		var result: Dictionary = session.start_story_offline(ADAPTER_SCRIPT.build_snapshot_from_character(SNAPSHOT), opponent_id, 20260919 + failures.size(), true) if ADAPTER_SCRIPT.has_method("build_snapshot_from_character") else session.start_story_offline(SNAPSHOT, opponent_id, 20260919 + failures.size(), true)
		if not bool(result.get("ok", false)):
			failures.append("%s:start:%s" % [node_id, str(result.get("error", "unknown"))])
			continue
		var opening: Dictionary = session.get_state_snapshot()
		var actors: Array = opening.get("actors", []) as Array
		if actors.size() != 2:
			failures.append("%s:actors" % node_id)
			continue
		for side: int in 2:
			var actor: Dictionary = actors[side] as Dictionary
			var hand: Array = (actor.get("zones", {}) as Dictionary).get("hand", []) as Array
			if hand.size() < 2: failures.append("%s:side%d_hand=%d" % [node_id, side, hand.size()])
		var left_hand: Array = ((actors[0] as Dictionary).get("zones", {}) as Dictionary).get("hand", []) as Array
		var right_hand: Array = ((actors[1] as Dictionary).get("zones", {}) as Dictionary).get("hand", []) as Array
		var left_discard_ids: Array = [str((left_hand[0] as Dictionary).get("instance_id", "")), str((left_hand[1] as Dictionary).get("instance_id", ""))]
		var right_discard_ids: Array = [str((right_hand[0] as Dictionary).get("instance_id", "")), str((right_hand[1] as Dictionary).get("instance_id", ""))]
		var discard_left: Dictionary = session.discard_cards(0, left_discard_ids, int(session.get_state_snapshot().get("revision", 0)))
		if not bool(discard_left.get("ok", false)): failures.append("%s:discard_left:%s" % [node_id, str(discard_left.get("error", "unknown"))])
		var discard_right: Dictionary = session.discard_cards(1, right_discard_ids, int(session.get_state_snapshot().get("revision", 0)))
		if not bool(discard_right.get("ok", false)): failures.append("%s:discard_right:%s" % [node_id, str(discard_right.get("error", "unknown"))])
		var initiative_left: Dictionary = session.submit_initiative(0, 0, int(session.get_state_snapshot().get("revision", 0)))
		if not bool(initiative_left.get("ok", false)): failures.append("%s:initiative_left:%s" % [node_id, str(initiative_left.get("error", "unknown"))])
		var initiative_right: Dictionary = session.submit_initiative(1, 0, int(session.get_state_snapshot().get("revision", 0)))
		if not bool(initiative_right.get("ok", false)): failures.append("%s:initiative_right:%s" % [node_id, str(initiative_right.get("error", "unknown"))])
		var ready: Dictionary = session.get_state_snapshot()
		var player_hand: Array = ((ready.get("actors", []) as Array)[0] as Dictionary).get("zones", {}).get("hand", []) as Array
		var player_card: Dictionary = {}
		for raw_card: Variant in player_hand:
			if raw_card is Dictionary and bool(session.validate_play({"actor_index":0, "card_instance_ids":[str((raw_card as Dictionary).get("instance_id", ""))], "domain_instance_ids":[]}).get("ok", false)):
				player_card = raw_card as Dictionary
				break
		if player_card.is_empty():
			failures.append("%s:player_no_valid_card" % node_id)
			continue
		var enemy_hand: Array = (((session.get_state_snapshot().get("actors", []) as Array)[1] as Dictionary).get("zones", {}) as Dictionary).get("hand", []) as Array
		for raw_enemy: Variant in enemy_hand:
			if raw_enemy is Dictionary:
				var enemy_card: Dictionary = raw_enemy as Dictionary
				var enemy_effect: Variant = enemy_card.get("effect", {})
				if enemy_effect is Dictionary and not ((enemy_effect as Dictionary).get("special", null) is Dictionary):
					failures.append("%s:enemy_card_special_not_dictionary:%s" % [node_id, str(enemy_card.get("id", ""))])
		var cpu: Dictionary = session.choose_cpu_play()
		var play_left: Dictionary = session.submit_play(0, [str(player_card.get("instance_id", ""))], [], int(session.get_state_snapshot().get("revision", 0)))
		if not bool(play_left.get("ok", false)): failures.append("%s:play_left:%s" % [node_id, str(play_left.get("error", "unknown"))])
		var play_right: Dictionary = session.submit_play(1, cpu.get("card_instance_ids", []) as Array, cpu.get("domain_instance_ids", []) as Array, int(session.get_state_snapshot().get("revision", 0)))
		if not bool(play_right.get("ok", false)): failures.append("%s:play_right:%s" % [node_id, str(play_right.get("error", "unknown"))])
		var resolved: Dictionary = session.resolve_round(int(session.get_state_snapshot().get("revision", 0)))
		if not bool(resolved.get("ok", false)): failures.append("%s:resolve:%s" % [node_id, str(resolved.get("error", "unknown"))])
		if not ((resolved.get("round_package", {}) as Dictionary).has("after_state")): failures.append("%s:round_package_missing" % node_id)
	var passed: bool = failures.is_empty()
	print("STORY_BATTLE_FIRST_CARD_ACCEPTANCE %s failures=%s" % ["PASS" if passed else "FAIL", ";".join(failures)])
	quit(0 if passed else 1)

func _fail(reason: String) -> void:
	print("STORY_BATTLE_FIRST_CARD_ACCEPTANCE FAIL failures=%s" % reason)
	quit(1)
