extends SceneTree

const OUTPUT := "res://reports/ui-audit/screenshots/battle-summon-real.png"

func _initialize() -> void:
	call_deferred("_run")

func _run() -> void:
	var scene := (load("res://scenes/battle/battle_scene.tscn") as PackedScene).instantiate()
	root.add_child(scene)
	await create_timer(1.0).timeout
	var intro := scene as Control
	var player := {"hp":100.0, "max_hp":100.0, "ce":40.0, "max_ce":40.0, "guard":0.0, "summons":[{"id":"acceptance_shikigami", "name":"验收玉犬", "hp":72.0, "max_hp":80.0, "attack":18.0, "defense":9.0, "active":true}]}
	var opponent := {"hp":100.0, "max_hp":100.0, "ce":40.0, "max_ce":40.0, "guard":0.0, "summons":[]}
	if not intro.has_method("set_battle_status"):
		push_error("battle host status projection missing")
		quit(1)
		return
	intro.call("set_battle_status", player, opponent)
	await process_frame
	# 首先让真实战斗宿主完成策略覆盖层的初始演示；截图阶段关闭覆盖层，
	# 只审查状态栏中的召唤物投影，不把独立覆盖层误当成页面缺陷。
	var strategy_preview := scene.get_node_or_null("StrategySelectionPreview") as Control
	if strategy_preview != null: strategy_preview.visible = false
	await process_frame
	var slots := scene.find_children("SummonPreview*", "Control", true, false)
	var bound: Control = null
	for candidate: Node in slots:
		if candidate is Control and (candidate as Control).visible and str((candidate as Control).get_meta("summon_snapshot", {}).get("name", "")) == "验收玉犬":
			bound = candidate as Control
			break
	var name_label := bound.get_node_or_null("PresentationRoot/CounterName") as Label if bound != null else null
	var hp_label := bound.get_node_or_null("PresentationRoot/HpAccount") as Label if bound != null else null
	var image := root.get_viewport().get_texture().get_image()
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path("res://reports/ui-audit/screenshots"))
	image.save_png(ProjectSettings.globalize_path(OUTPUT))
	var ok := bound != null and name_label != null and hp_label != null and name_label.text == "验收玉犬" and hp_label.text == "72 / 80" and bound.get_global_rect().size.x > 0.0 and bound.get_global_rect().size.y > 0.0
	print("BATTLE_SUMMON_REAL_WINDOW_ACCEPTANCE %s bound=%s name=%s hp=%s rect=%s screenshot=%s" % ["PASS" if ok else "FAIL", bound != null, name_label.text if name_label != null else "", hp_label.text if hp_label != null else "", bound.get_global_rect() if bound != null else Rect2(), OUTPUT])
	quit(0 if ok else 1)
