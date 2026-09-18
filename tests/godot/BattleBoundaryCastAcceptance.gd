extends SceneTree

func _initialize() -> void:
	var coordinator: RefCounted = (load("res://scenes/battle/BattleFlowCoordinator.gd") as Script).new()
	var response := coordinator.call("_consume_authority_response", &"acceptance", {"ok":true,"data":null,"visible_state":[],"battle_state":null}) as Dictionary
	var safe := response is Dictionary and bool(response.get("ok", false))
	print("BATTLE_BOUNDARY_CAST_ACCEPTANCE %s response=%s" % ["PASS" if safe else "FAIL", response.get("ok", false)])
	quit(0 if safe else 1)
