extends SceneTree

func _initialize() -> void:
	call_deferred("_run")

func _run() -> void:
	var strategy_scene := (load("res://scenes/battle/strategy_selection.tscn") as PackedScene).instantiate() as Control
	strategy_scene.set("embedded", true)
	root.add_child(strategy_scene)
	await process_frame
	var strategy_options := strategy_scene.get_node("StrategyContent/StrategyOptions") as Control
	var steady_art := strategy_scene.get_node("StrategyContent/StrategyOptions/SteadyArt") as Control
	var aggressive_art := strategy_scene.get_node("StrategyContent/StrategyOptions/AggressiveArt") as Control
	var steady := strategy_scene.get_node("StrategyContent/StrategyOptions/SteadyArt/SteadyButton") as Button
	var aggressive := strategy_scene.get_node("StrategyContent/StrategyOptions/AggressiveArt/AggressiveButton") as Button
	var base_steady := steady_art.scale
	var base_aggressive := aggressive_art.scale
	steady.emit_signal("pressed")
	await process_frame
	if steady_art.scale.x <= base_steady.x * 1.04 or steady_art.scale.y <= base_steady.y * 1.04:
		push_error("strategy first click did not keep selected card raised")
		quit(1)
		return
	if strategy_scene.get("armed_strategy") != "SteadyButton" or strategy_scene.get("_confirmed"):
		push_error("strategy first click changed confirmation state")
		quit(1)
		return
	aggressive.emit_signal("pressed")
	await process_frame
	if aggressive_art.scale.x <= base_aggressive.x * 1.04 or steady_art.scale.x > base_steady.x * 1.02:
		push_error("strategy selection did not transfer visual state")
		quit(1)
		return

	var initiative_scene := (load("res://scenes/battle/first_move_contest.tscn") as PackedScene).instantiate() as Control
	initiative_scene.set("embedded", true)
	root.add_child(initiative_scene)
	await process_frame
	var option := initiative_scene.get_node("ContestContent/TextureRect/ChoiceButtons/Option01") as Button
	var option_two := initiative_scene.get_node("ContestContent/TextureRect/ChoiceButtons/Option02") as Button
	var base_option := option.scale
	var base_option_two := option_two.scale
	option.emit_signal("pressed")
	# FirstMoveContest._animate_option raises the option over a 0.16s tween, and the
	# assertion below requires scale.x > base * 1.04. Waiting only 0.05s sampled the
	# tween mid-flight and raced the animation, so wait past its full duration.
	await create_timer(0.4).timeout
	if option.scale.x <= base_option.x * 1.04 or initiative_scene.get("selected_option") != "Option01" or initiative_scene.get("_confirmed"):
		push_error("initiative first click did not keep selected option raised")
		quit(1)
		return
	option_two.emit_signal("pressed")
	await create_timer(0.4).timeout
	if option.scale.x > base_option.x * 1.02 or option_two.scale.x <= base_option_two.x * 1.04 or initiative_scene.get("selected_option") != "Option02":
		push_error("initiative selection did not transfer visual state")
		quit(1)
		return
	option_two.emit_signal("pressed")
	await process_frame
	if not initiative_scene.get("_confirmed"):
		push_error("initiative second click did not confirm")
		quit(1)
		return
	print("STRATEGY_AND_INITIATIVE_SELECTION_ACCEPTANCE PASS")
	quit(0)
