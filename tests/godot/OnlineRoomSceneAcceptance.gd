extends SceneTree

func _initialize() -> void:
	call_deferred("_run")

func _run() -> void:
	var scene := (load("res://scenes/online/online_room.tscn") as PackedScene).instantiate() as Control
	root.add_child(scene)
	await process_frame
	var region := scene.get_node_or_null("MatchmakingPage/Basic/InteractiveLayer/ServerRegion") as OptionButton
	var passed := region != null and region.item_count >= 2 and region.selected == int(scene.get("_server_index")) and region.selected < region.item_count
	print("ONLINE_ROOM_SCENE_ACCEPTANCE %s count=%d selected=%d" % ["PASS" if passed else "FAIL", region.item_count if region != null else -1, region.selected if region != null else -1])
	quit(0 if passed else 1)
