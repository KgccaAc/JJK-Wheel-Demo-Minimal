extends SceneTree

func _initialize() -> void:
	var session: RefCounted = (load("res://data/wheel/WheelFlowSession.gd") as Script).new() as RefCounted
	var result: Dictionary = session.call("run_to_grade", 20260913) as Dictionary
	if not bool(result.get("ok", false)):
		push_error("wheel auto-rank failed: %s" % JSON.stringify(result))
		quit(1)
		return
	if (result.get("grade", {}) as Dictionary).is_empty():
		push_error("wheel auto-rank returned no grade")
		quit(1)
		return
	if (result.get("answers", {}) as Dictionary).is_empty():
		push_error("wheel auto-rank returned no answers")
		quit(1)
		return
	var wheel_scene: PackedScene = load("res://scenes/wheel/wheel.tscn") as PackedScene
	var wheel_page: Control = wheel_scene.instantiate() as Control
	root.add_child(wheel_page)
	await process_frame
	if int(wheel_page.call("get_wheel_count")) <= 50:
		push_error("wheel page did not load the full wheel catalog")
		quit(1)
		return
	wheel_page.call("_on_rank_pressed")
	await process_frame
	var page_rank: Dictionary = wheel_page.get("_rank_result") as Dictionary
	if page_rank.is_empty() or str(page_rank.get("grade_label", "")).is_empty():
		push_error("wheel page auto-rank did not publish a grade")
		quit(1)
		return
	print("WHEEL_AUTO_RANK_ACCEPTANCE_PASS grade=%s steps=%s" % [str((result.get("grade", {}) as Dictionary).get("grade_label", "")), str(result.get("steps", 0))])
	quit(0)
