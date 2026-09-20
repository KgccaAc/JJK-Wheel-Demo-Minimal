extends SceneTree

const SCENE_PATH := "res://scenes/community/community.tscn"

func _initialize() -> void:
	call_deferred("_run")

func _run() -> void:
	var packed := load(SCENE_PATH) as PackedScene
	var failures: PackedStringArray = []
	if packed == null:
		failures.append("community_scene_load_failed")
	else:
		var page := packed.instantiate() as Control
		root.add_child(page)
		await process_frame
		for index: int in 3:
			var card := page.get_node_or_null("VotePage/TopicList/Topic%02d" % (index + 1)) as Control
			if card == null:
				failures.append("missing_topic_%02d" % (index + 1))
				continue
			var bar := card.get_node_or_null("BarSlot") as Control
			for label_name: String in ["Status", "Name", "Meta"]:
				var label := card.get_node_or_null(label_name) as Control
				if label != null and bar.get_rect().intersects(label.get_rect()):
					failures.append("topic_%02d_bar_overlaps_%s" % [index + 1, label_name])
		var title := page.get_node_or_null("VotePage/Background/Header/Title") as Label
		if title != null and title.text == "角色选择": failures.append("vote_title_is_character_selection")
	var passed := failures.is_empty()
	print("COMMUNITY_LAYOUT_ACCEPTANCE %s failures=%s" % ["PASS" if passed else "FAIL", failures])
	quit(0 if passed else 1)
