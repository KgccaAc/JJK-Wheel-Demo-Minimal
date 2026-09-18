extends SceneTree

var _pressed: bool = false

func _initialize() -> void:
	print("POST_STRATEGY_TEST_START")
	var fight: Control = (load("res://scenes/battle/battle_scene.tscn") as PackedScene).instantiate() as Control
	get_root().add_child(fight)
	await create_timer(1.0).timeout
	print("POST_STRATEGY_STARTUP_WAIT_COMPLETE")
	var presenter: Control = fight.get_node("FightPresenter") as Control
	var preview: Control = fight.get_node("StrategySelectionPreview") as Control
	var strategy: Button = fight.get_node("StrategySelectionPreview/StrategyPanel/StrategyContent/StrategyOptions/SteadyArt/SteadyButton") as Button
	if not preview.is_visible_in_tree():
		push_error("strategy preview did not open during the real battle startup")
		quit(1)
		return
	strategy.pressed.connect(func() -> void: pass)
	await _click(strategy)
	await process_frame
	await _click(strategy)
	await process_frame
	await create_timer(1.2).timeout
	var session: RefCounted = presenter.get("_session") as RefCounted
	print("post-strategy phase=%s preview_visible=%s" % [str(session.get_phase()), preview.visible])
	if str(session.get_phase()) != "DISCARD" or preview.visible:
		push_error("strategy confirmation did not leave the strategy phase")
		quit(1)
		return
	var hand: Control = fight.get_node("HandCardLayer") as Control
	var card: TextureButton = null
	for child: Node in hand.get_children():
		if child is TextureButton and (child as TextureButton).is_visible_in_tree():
			card = child as TextureButton
			break
	if card == null:
		push_error("post-strategy hand card was not rendered")
		quit(1)
		return
	var overlap_card: TextureButton = null
	for candidate: Node in hand.get_children():
		if candidate is TextureButton:
			var candidate_card: TextureButton = candidate as TextureButton
			print("post-strategy hand candidate=%s rect=%s" % [candidate_card.name, candidate_card.get_global_rect()])
			if candidate_card.is_visible_in_tree() and candidate_card.get_global_rect().get_center().y >= (fight.get_node("MyArea") as Control).get_global_rect().position.y:
				overlap_card = candidate_card
				break
	if overlap_card == null:
		# This seed can leave only one playable card. Move it into the authored
		# MyArea overlap band so the test still exercises the real blocker.
		overlap_card = card
	var original_overlap_position: Vector2 = overlap_card.position
	overlap_card.position = Vector2(500.0, 700.0)
	var overlap_motion: InputEventMouseMotion = InputEventMouseMotion.new()
	overlap_motion.position = overlap_card.get_global_rect().get_center()
	overlap_motion.global_position = overlap_motion.position
	get_root().push_input(overlap_motion, true)
	await process_frame
	var overlap_hovered: Control = get_root().get_viewport().gui_get_hovered_control()
	print("post-strategy overlap card=%s card_rect=%s my_area=%s hovered=%s" % [overlap_card.name, overlap_card.get_global_rect(), (fight.get_node("MyArea") as Control).get_global_rect(), overlap_hovered.get_path() if overlap_hovered != null else "<none>"])
	if overlap_hovered != overlap_card:
		_print_blockers(fight, overlap_card.get_global_rect().get_center())
		push_error("post-strategy hand card under MyArea did not win pointer hit testing")
		quit(1)
		return
	_pressed = false
	overlap_card.gui_input.connect(func(_event: InputEvent) -> void: _pressed = true)
	await _click(overlap_card)
	await process_frame
	if not _pressed:
		push_error("post-strategy hand card under MyArea did not receive click input")
		quit(1)
		return
	overlap_card.position = original_overlap_position
	card.gui_input.connect(func(_event: InputEvent) -> void: _pressed = true)
	print("post-strategy card rect=%s phase=%s action_parent_rect=%s action_parent_filter=%s" % [card.get_global_rect(), str(presenter.get("_phase")), (fight.get_node("ActionButtons") as Control).get_global_rect(), (fight.get_node("ActionButtons") as Control).mouse_filter])
	_print_blockers(fight, card.get_global_rect().get_center())
	await _click(card)
	await process_frame
	if not _pressed:
		var hovered: Control = get_root().get_viewport().gui_get_hovered_control()
		print("post-strategy diagnostics card_rect=%s card_tree=%s card_filter=%s hovered=%s" % [card.get_global_rect(), card.is_visible_in_tree(), card.mouse_filter, hovered.get_path() if hovered != null else "<none>"])
		_print_blockers(fight, card.get_global_rect().get_center())
		push_error("post-strategy hand card did not receive mouse input")
		quit(1)
		return
	_pressed = false
	var basic_button: TextureButton = fight.get_node("ActionButtons/BasicCardButton") as TextureButton
	print("post-strategy action phase=%s hand_phase=%s has_hand=%s mode=%s action_visible=%s action_modulate=%s" % [str(session.get_phase()), str(presenter.get("_phase")), presenter.get("_has_hand_data"), str(presenter.get("_current_mode")), basic_button.is_visible_in_tree(), basic_button.modulate])
	for probe: Vector2 in [Vector2(600, 700), Vector2(900, 700), Vector2(1300, 860), Vector2(700, 860), Vector2(800, 300)]:
		var probe_motion: InputEventMouseMotion = InputEventMouseMotion.new()
		probe_motion.position = probe
		probe_motion.global_position = probe
		get_root().push_input(probe_motion, true)
		await process_frame
		var probe_hovered: Control = get_root().get_viewport().gui_get_hovered_control()
		print("post-strategy probe=%s hovered=%s" % [probe, probe_hovered.get_path() if probe_hovered != null else "<none>"])
	basic_button.pressed.connect(func() -> void: _pressed = true)
	await _click(basic_button)
	await process_frame
	if not _pressed:
		var hovered: Control = get_root().get_viewport().gui_get_hovered_control()
		print("post-strategy diagnostics basic_rect=%s basic_tree=%s basic_filter=%s basic_disabled=%s hovered=%s" % [basic_button.get_global_rect(), basic_button.is_visible_in_tree(), basic_button.mouse_filter, basic_button.disabled, hovered.get_path() if hovered != null else "<none>"])
		_print_blockers(fight, basic_button.get_global_rect().get_center())
		push_error("post-strategy basic-card action did not receive mouse input")
		quit(1)
		return
	print("BATTLE_POST_STRATEGY_INPUT_PASS phase=%s" % str(presenter.get("_session").get_phase()))
	quit(0)

func _click(button: BaseButton) -> void:
	var motion: InputEventMouseMotion = InputEventMouseMotion.new()
	motion.position = button.get_global_rect().get_center()
	motion.global_position = motion.position
	get_root().push_input(motion, true)
	await process_frame
	var event: InputEventMouseButton = InputEventMouseButton.new()
	event.position = button.get_global_rect().get_center()
	event.global_position = event.position
	event.button_index = MOUSE_BUTTON_LEFT
	event.pressed = true
	event.button_mask = MOUSE_BUTTON_MASK_LEFT
	get_root().push_input(event, true)
	event = event.duplicate() as InputEventMouseButton
	event.pressed = false
	event.button_mask = 0
	get_root().push_input(event, true)

func _print_blockers(node: Node, point: Vector2) -> void:
	if node is Control:
		var control: Control = node as Control
		if control.is_visible_in_tree() and control.get_global_rect().has_point(point) and control.mouse_filter != Control.MOUSE_FILTER_IGNORE:
			var is_disabled: bool = control.disabled if control is BaseButton else false
			print("candidate path=%s type=%s z=%d filter=%d disabled=%s" % [control.get_path(), control.get_class(), control.z_index, control.mouse_filter, is_disabled])
	for child: Node in node.get_children():
		_print_blockers(child, point)
