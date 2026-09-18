extends SceneTree

const SESSION_SCRIPT: Script = preload("res://battle/core/BattleFlowSession.gd")
const PROJECTOR_SCRIPT: Script = preload("res://account/LoginCardCharacterProjector.gd")

func _initialize() -> void:
	var snapshot := {
		"schema":"generated-character-v2", "characterId":"acceptance_wheel_character", "displayName":"转盘验收角色",
		"stats":{"cursedEnergy":"B", "control":"C", "efficiency":"C", "body":"B", "martial":"C", "talent":"A"},
		"techniques":[{"id":"limitless", "name":"无下限术式"}], "techniqueFamilies":["limitless"],
		"cardTags":["limitless"], "specialHandTags":["limitless"], "techniquePower":"B"
	}
	var profile: Dictionary = PROJECTOR_SCRIPT.project(snapshot)
	var session: RefCounted = SESSION_SCRIPT.new()
	var result: Dictionary = session.start_story_offline(snapshot, "kechizu_origin_candidate", 20260915, true)
	var state: Dictionary = session.get_state_snapshot() if bool(result.get("ok", false)) else {}
	var actors: Array = state.get("actors", []) as Array
	var player: Dictionary = actors[0] as Dictionary if not actors.is_empty() else {}
	var player_profile: Dictionary = player.get("profile", {}) as Dictionary
	var pool: Array = state.get("normal_hand", []) as Array
	var tagged_cards := 0
	for raw: Variant in pool:
		if raw is Dictionary and ((raw as Dictionary).get("tags", []) as Array).has("limitless"): tagged_cards += 1
	var ok := bool(result.get("ok", false)) and bool(profile.get("snapshot_valid", false)) and str(player_profile.get("id", "")) == "acceptance_wheel_character"
	ok = ok and (player_profile.get("techniqueFamilies", []) as Array).has("limitless") and (player_profile.get("specialHandTags", []) as Array).has("limitless") and pool.size() > 0 and tagged_cards > 0
	print("[%-4s] wheel snapshot reaches battle profile and card dealing" % ("PASS" if ok else "FAIL"))
	print("STORY_BATTLE_CHARACTER_ACCEPTANCE %s hand=%d tagged=%d" % ["PASS" if ok else "FAIL", pool.size(), tagged_cards])
	quit(0 if ok else 1)
