extends SceneTree

const BATTLE_SCENE: PackedScene = preload("res://scenes/battle/battle_scene.tscn")
const SCREENSHOT_PATH: String = "res://reports/ui-audit/screenshots/opponent-response-card-name.png"

func _initialize() -> void:
	call_deferred("_run")

func _run() -> void:
	var scene: Control = BATTLE_SCENE.instantiate() as Control
	root.add_child(scene)
	await create_timer(1.2).timeout

	var presenter: Control = scene.get_node("FightPresenter") as Control
	var layer: Control = scene.get_node("OpponentResponseLayer") as Control
	var strategy_preview: Control = scene.get_node_or_null("StrategySelectionPreview") as Control
	if strategy_preview != null:
		strategy_preview.visible = false
	var cards: Array = [
		{"id":"acceptance-technique", "name":"验收术式", "type":"technique", "tags":["technique"]},
		{"id":"acceptance-basic", "displayName":"第二张牌", "type":"basic"}
	]
	presenter.call("_spawn_opponent_response_cards", cards)
	await process_frame

	var responses: Array[TextureRect] = []
	for child: Node in layer.get_children():
		if child is TextureRect:
			responses.append(child as TextureRect)
	var labels_ok: bool = responses.size() == cards.size()
	var expected_names: Array[String] = ["验收术式", "第二张牌"]
	for index: int in responses.size():
		var response: TextureRect = responses[index]
		var label: Label = response.get_node_or_null("NameLabel") as Label
		labels_ok = labels_ok and label != null and label.text == expected_names[index]
		labels_ok = labels_ok and is_equal_approx(response.size.x, 106.0) and is_equal_approx(response.size.y, 68.0)

	# Clearing the normal hand must not remove the previous-round opponent cards.
	presenter.call("_clear_hand_nodes")
	await process_frame
	var persists: bool = layer.get_children().filter(func(child: Node) -> bool: return child is TextureRect).size() == cards.size()
	await create_timer(0.5).timeout
	var screenshot_saved: bool = false
	if DisplayServer.get_name() != "headless":
		var viewport_texture: Texture2D = root.get_viewport().get_texture()
		if viewport_texture != null:
			var screenshot: Image = viewport_texture.get_image()
			if screenshot != null:
				DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path("res://reports/ui-audit/screenshots"))
				screenshot_saved = screenshot.save_png(ProjectSettings.globalize_path(SCREENSHOT_PATH)) == OK

	# The old `scenes/fight/` presenter (a mirror kept only for the migration diff) was
	# removed once the `scenes/battle/` presenter became the single production path, so the
	# previous `mirrored` cross-check is gone. Assert on the live presenter directly instead.
	var battle_source: String = FileAccess.get_file_as_string("res://scenes/battle/FightPresenter.gd")
	var source_ok: bool = battle_source.contains("NameLabel")
	var ok: bool = labels_ok and persists and source_ok
	print("OPPONENT_RESPONSE_CARD_NAME_ACCEPTANCE %s responses=%d labels=%s persists=%s source_ok=%s screenshot_saved=%s screenshot=%s" % ["PASS" if ok else "FAIL", responses.size(), labels_ok, persists, source_ok, screenshot_saved, SCREENSHOT_PATH])
	quit(0 if ok else 1)
