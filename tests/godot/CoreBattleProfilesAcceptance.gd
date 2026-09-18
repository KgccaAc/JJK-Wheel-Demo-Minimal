extends SceneTree

const SESSION_SCRIPT: Script = preload("res://battle/core/BattleFlowSession.gd")
const ADAPTER_SCRIPT: Script = preload("res://story/StoryBattleAdapter.gd")

func _initialize() -> void:
	var story := root.get_node_or_null("StoryState") as Node
	if story == null:
		print("CORE_BATTLE_PROFILES_ACCEPTANCE FAIL story_state_missing")
		quit(1)
	story.call("begin_from_identity", {"schema":"generated-character-v2", "characterId":"core_profiles", "displayName":"核心战斗全量验收", "stats":{"cursedEnergy":"A", "control":"B", "efficiency":"B", "body":"B", "martial":"B", "talent":"A"}, "answers":{"identity":"咒术师"}, "techniques":[{"id":"limitless", "name":"无下限术式"}], "techniqueFamilies":["limitless"], "cardTags":["limitless"], "specialHandTags":["limitless"], "techniquePower":"B"})
	var file := FileAccess.open("res://data/story/chapter1.json", FileAccess.READ)
	var parsed: Variant = JSON.parse_string(file.get_as_text()) if file != null else null
	var nodes: Array = (parsed as Dictionary).get("nodes", []) as Array if parsed is Dictionary else []
	var checked := 0
	var errors: Array[String] = []
	for raw: Variant in nodes:
		if not raw is Dictionary: continue
		var definition := raw as Dictionary
		var node_id := str(definition.get("id", ""))
		if not node_id.begins_with("core_battle_"): continue
		var profile := str(definition.get("battleProfile", ""))
		var opponent: String = str(ADAPTER_SCRIPT.opponent_id_for_definition(definition))
		if opponent.is_empty():
			errors.append("%s:profile_missing" % node_id)
			continue
		story.call("begin_node", node_id)
		var session: RefCounted = SESSION_SCRIPT.new()
		var result: Dictionary = session.start_story_offline(ADAPTER_SCRIPT.build_snapshot(story), opponent, 20260917 + checked, true)
		if not bool(result.get("ok", false)):
			errors.append("%s:%s" % [node_id, str(result.get("error", "start_failed"))])
		else:
			var snapshot: Dictionary = session.get_state_snapshot()
			var actors: Array = snapshot.get("actors", []) as Array
			var hand: Array = snapshot.get("normal_hand", []) as Array
			if actors.size() != 2 or hand.is_empty(): errors.append("%s:state_incomplete" % node_id)
		checked += 1
		story.call("clear_run")
		story.call("begin_from_identity", {"schema":"generated-character-v2", "characterId":"core_profiles_%d" % checked, "displayName":"核心战斗验收", "stats":{"cursedEnergy":"A", "control":"B", "efficiency":"B", "body":"B", "martial":"B", "talent":"A"}, "answers":{"identity":"咒术师"}, "techniques":[{"id":"limitless", "name":"无下限术式"}], "techniqueFamilies":["limitless"], "cardTags":["limitless"], "specialHandTags":["limitless"], "techniquePower":"B"})
	var passed := checked == 8 and errors.is_empty()
	print("CORE_BATTLE_PROFILES_ACCEPTANCE %s checked=%d errors=%s" % ["PASS" if passed else "FAIL", checked, ";".join(errors)])
	quit(0 if passed else 1)
