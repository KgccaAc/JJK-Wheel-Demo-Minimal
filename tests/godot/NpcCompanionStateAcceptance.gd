extends SceneTree

const STATE_SCRIPT: Script = preload("res://story/StoryState.gd")

func _initialize() -> void:
	var state := STATE_SCRIPT.new() as Node
	root.add_child(state)
	await process_frame
	state.call("begin_from_identity", {"id":"npc-test", "stats":{"cursedEnergy":2, "control":2, "martial":2, "body":2, "efficiency":2, "talent":2}})
	state.call("apply_npc_delta", "junior_sorcerer", {"affection":60, "trust":3, "respect":2}, {"junior_personal_event_done":true})
	var recruited := state.call("npc_state", "junior_sorcerer") as Dictionary
	var pending := state.call("resolve_local", "npc_test", "攻略型NPC", "关系变化已记录", {}, {}, "next", "acceptance", {"junior_sorcerer":{"affection":1}}, {}) as Dictionary
	state.call("commit_pending")
	var saved := state.call("snapshot") as Dictionary
	var passed := str(recruited.get("route_stage", "")) == "recruit" and bool(recruited.get("companion", false)) and int((saved.get("npc_states", {}) as Dictionary).get("junior_sorcerer", {}).get("affection", 0)) == 61
	print("NPC_COMPANION_STATE_ACCEPTANCE %s stage=%s companion=%s affection=%s" % ["PASS" if passed else "FAIL", str(recruited.get("route_stage", "")), str(recruited.get("companion", false)), str((saved.get("npc_states", {}) as Dictionary).get("junior_sorcerer", {}).get("affection", 0))])
	state.queue_free()
	quit(0 if passed else 1)
