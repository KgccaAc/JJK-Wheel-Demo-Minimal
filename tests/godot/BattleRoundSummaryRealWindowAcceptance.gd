extends SceneTree

const OUTPUT := "res://reports/ui-audit/screenshots/battle-round-summary-real.png"
const SURFACE_SCRIPT: Script = preload("res://battle/ui/FightAcceptanceSurface.gd")

func _initialize() -> void:
	call_deferred("_run")

func _run() -> void:
	var scene := (load("res://scenes/battle/battle_scene.tscn") as PackedScene).instantiate()
	root.add_child(scene)
	await create_timer(1.0).timeout
	var presenter := scene.get_node_or_null("FightPresenter") as Control
	if presenter == null:
		push_error("battle presenter missing")
		quit(1)
		return
	SURFACE_SCRIPT.prepare_play_hand(presenter)
	await process_frame
	SURFACE_SCRIPT.select_first_card(presenter)
	await process_frame
	SURFACE_SCRIPT.resolve_selected(presenter)
	await create_timer(1.2).timeout
	var summary := scene.get_node_or_null("RoundSummaryPanel") as Control
	var body := summary.get_node_or_null("Margin/Content/Body") as RichTextLabel if summary != null else null
	var image := get_root().get_viewport().get_texture().get_image()
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path("res://reports/ui-audit/screenshots"))
	image.save_png(ProjectSettings.globalize_path(OUTPUT))
	var ok := summary != null and summary.visible and body != null and body.text.contains("对方意图") and body.text.contains("伤害来源")
	print("BATTLE_ROUND_SUMMARY_REAL_WINDOW_ACCEPTANCE %s visible=%s body=%s screenshot=%s" % ["PASS" if ok else "FAIL", summary.visible if summary != null else false, body.text.replace("\n", " | ") if body != null else "", OUTPUT])
	quit(0 if ok else 1)
