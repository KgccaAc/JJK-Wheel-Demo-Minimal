extends SceneTree

func _initialize() -> void:
	call_deferred("_run")

func _run() -> void:
	var scene := (load("res://scenes/community/community.tscn") as PackedScene).instantiate() as Control
	root.add_child(scene)
	await process_frame
	var vote := scene.get_node_or_null("VotePage")
	var controls_ok := vote != null and vote.get("_pro_fill") != null and vote.get("_con_fill") != null and vote.get("_topic_pro_fill") != null and vote.get("_topic_con_fill") != null
	if controls_ok:
		vote.call("select_topic", &"topic_02", false)
		vote.call("set_faction_balance", 64.0, 36.0, false)
	var topic_title := scene.get_node_or_null("VotePage/CurrentTopic/TitleArt/Title") as Label
	var rendered := topic_title != null and topic_title.text.contains("积分赛")
	var passed := controls_ok and rendered
	print("COMMUNITY_SCENE_ACCEPTANCE %s controls=%s rendered=%s" % ["PASS" if passed else "FAIL", controls_ok, rendered])
	quit(0 if passed else 1)
