extends SceneTree

const SCENE_PATH: String = "res://scenes/battle/character_selection.tscn"
const OUTPUT: String = "res://reports/ui-audit/screenshots/character-selection-stat-value-real.png"

func _initialize() -> void:
	call_deferred("_run")

func _run() -> void:
	var packed: PackedScene = load(SCENE_PATH) as PackedScene
	if packed == null:
		push_error("character_selection_scene_load_failed")
		quit(1)
		return
	var page: Control = packed.instantiate() as Control
	root.add_child(page)
	await process_frame
	await create_timer(0.8).timeout
	var failures: PackedStringArray = []
	for card_path: String in ["CharacterContent/PlayerCharacterSlots/PlayerCharacter", "CharacterContent/OpponentCharacterSlots/OpponentCharacter"]:
		var card: Control = page.get_node(card_path) as Control
		for index: int in 6:
			var stat_path: String = "%s/RichTextLabel%s" % [card_path, "" if index == 0 else str(index + 1)]
			var stat_node: RichTextLabel = page.get_node_or_null(stat_path) as RichTextLabel
			var grade_label: Label = stat_node.get_node_or_null("Label") as Label if stat_node != null else null
			var value_label: Label = stat_node.get_node_or_null("Label2") as Label if stat_node != null else null
			if stat_node == null or grade_label == null or value_label == null:
				failures.append("missing_stat_nodes_%s_%d" % [card_path, index])
				continue
			if stat_node.text.contains("实值"):
				failures.append("inline_value_caption_overlaps_grade_%s_%d" % [card_path, index])
			if not value_label.text.contains("实值"):
				failures.append("value_caption_missing_%s_%d" % [card_path, index])
			if grade_label.get_global_rect().intersects(value_label.get_global_rect()):
				failures.append("grade_value_rect_overlap_%s_%d" % [card_path, index])
			var stat_rect: Rect2 = stat_node.get_global_rect()
			var value_rect: Rect2 = value_label.get_global_rect()
			if not stat_rect.encloses(value_rect):
				failures.append("value_outside_stat_card_%s_%d" % [card_path, index])
			if value_label.get_combined_minimum_size().x > value_label.size.x + 1.0:
				failures.append("value_text_overflow_%s_%d" % [card_path, index])
			# The value is a second information row, not a right-side badge. Keep
			# both rows centered in the authored tile so a long grade cannot push
			# the value off-center or make it look attached to the wrong stat.
			var tile_center_x: float = stat_node.size.x * 0.5
			var grade_center_x: float = grade_label.position.x + grade_label.size.x * 0.5
			var value_center_x: float = value_label.position.x + value_label.size.x * 0.5
			if absf(grade_center_x - tile_center_x) > 8.0:
				failures.append("grade_not_centered_%s_%d" % [card_path, index])
			if absf(value_center_x - tile_center_x) > 8.0:
				failures.append("value_not_centered_%s_%d" % [card_path, index])
			if grade_label.get_theme_font_size("font_size") < 28:
				failures.append("grade_too_small_%s_%d" % [card_path, index])
			if value_label.get_theme_font_size("font_size") < 11:
				failures.append("value_too_small_%s_%d" % [card_path, index])
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path("res://reports/ui-audit/screenshots"))
	var image: Image = root.get_texture().get_image()
	var save_error: Error = image.save_png(ProjectSettings.globalize_path(OUTPUT))
	if save_error != OK:
		failures.append("screenshot_save_failed")
	var passed: bool = failures.is_empty()
	print("CHARACTER_STAT_VALUE_VISUAL_ACCEPTANCE %s failures=%s screenshot=%s" % ["PASS" if passed else "FAIL", failures, OUTPUT])
	quit(0 if passed else 1)
