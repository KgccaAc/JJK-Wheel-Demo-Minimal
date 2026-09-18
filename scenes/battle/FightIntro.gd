extends Control

@export_range(0.0, 1.0, 0.01) var health_value: float = 0.82
@export_range(0.0, 1.0, 0.01) var energy_value: float = 0.64
@export_range(0.0, 1.0, 0.01) var guard_value: float = 0.42

const INTRO_DURATION: float = 0.55
const DECK_TRAVEL: float = 190.0
const FILL_WIDTH: float = 320.0
const MAX_COUNTER_INDICATORS: int = 10
const MAX_SPECIAL_EFFECTS: int = 10
const COUNTER_CARD_DISPLAY_WIDTH: float = 164.0
const COUNTER_CARD_SCENE: PackedScene = preload("res://ui/battle_status/resource_counter_card.tscn")
const SPECIAL_EFFECT_SCENE: PackedScene = preload("res://ui/battle_status/special_effect_badge.tscn")

@onready var _player_label: Control = $PlayerLabel
@onready var _player_deck: Control = $MyArea/MyDeck
@onready var _opponent_deck: Control = $OpponentArea/OpponentDeck
@onready var _player_status: CanvasItem = $PlayerStatusBar
@onready var _opponent_status: CanvasItem = $OpponentStatusBar
@onready var _action_buttons: Control = $ActionButtons
@onready var _buttons: Array[TextureButton] = [$ActionButtons/RoundHistory, $ActionButtons/BasicCardButton, $ActionButtons/DomainCardButton, $ActionButtons/TechniqueCardButton]
@onready var _player_fills: Array[ColorRect] = [$PlayerStatusBar/HealthFill, $PlayerStatusBar/EnergyFill, $PlayerStatusBar/GuardFill]
@onready var _opponent_fills: Array[ColorRect] = [$OpponentStatusBar/HealthFill, $OpponentStatusBar/EnergyFill, $OpponentStatusBar/GuardFill]
@onready var _player_value_labels: Array[Label] = _labels_for_fills(_player_fills)
@onready var _opponent_value_labels: Array[Label] = _labels_for_fills(_opponent_fills)
@onready var _player_counter_layer: Control = $PlayerStatusBar/ResourceCounterLayer
@onready var _player_effect_layer: Control = $PlayerStatusBar/SpecialEffectLayer
@onready var _opponent_counter_layer: Control = $OpponentStatusBar/ResourceCounterLayer
@onready var _opponent_effect_layer: Control = $OpponentStatusBar/SpecialEffectLayer
@onready var _strategy_preview: Control = $StrategySelectionPreview
@onready var _strategy_panel: Control = $StrategySelectionPreview/StrategyPanel

func _ready() -> void:
	set_status_values(health_value, energy_value, guard_value)
	_play_intro()
	for button: TextureButton in _buttons:
		button.pressed.connect(_animate_click.bind(button))
	# 流程面板由FightPresenter控制，本脚本只负责视觉呈现。

func _show_pre_battle_flow() -> void:
	await get_tree().create_timer(0.8).timeout
	_strategy_preview.visible = true
	_strategy_panel.strategy_confirmed.connect(_on_strategy_confirmed, CONNECT_ONE_SHOT)

func _on_strategy_confirmed(_strategy_name: String) -> void:
	_strategy_preview.visible = false

func set_status_values(new_health: float, new_energy: float, new_guard: float) -> void:
	health_value = clampf(new_health, 0.0, 1.0)
	energy_value = clampf(new_energy, 0.0, 1.0)
	guard_value = clampf(new_guard, 0.0, 1.0)
	var values: Array[float] = [health_value, energy_value, guard_value]
	for index: int in values.size():
		_player_fills[index].size.x = FILL_WIDTH * values[index]
		_opponent_fills[index].size.x = FILL_WIDTH * values[index]

func set_battle_status(player: Dictionary, opponent: Dictionary) -> void:
	_set_actor_fills(_player_fills, _player_value_labels, player)
	_set_actor_fills(_opponent_fills, _opponent_value_labels, opponent)
	_render_actor_indicators(player, _player_counter_layer, _player_effect_layer, false)
	_render_actor_indicators(opponent, _opponent_counter_layer, _opponent_effect_layer, true)

func _set_actor_fills(fills: Array[ColorRect], labels: Array[Label], actor: Dictionary) -> void:
	if fills.size() < 3 or labels.size() < 3:
		push_error("Status bar requires three fill controls with one value Label each.")
		return
	var values: Array[float] = [
		_safe_ratio(float(actor.get("hp", 0.0)), float(actor.get("max_hp", 1.0))),
		_safe_ratio(float(actor.get("ce", 0.0)), float(actor.get("max_ce", 1.0))),
		clampf(float(actor.get("guard", 0.0)) / 100.0, 0.0, 1.0)
	]
	for index: int in values.size():
		fills[index].size.x = FILL_WIDTH * values[index]
	labels[0].text = "%s   /   %s" % [_format_number(float(actor.get("hp", 0.0))), _format_number(float(actor.get("max_hp", 0.0)))]
	labels[1].text = "%s   /   %s" % [_format_number(float(actor.get("ce", 0.0))), _format_number(float(actor.get("max_ce", 0.0)))]
	labels[2].text = "%s   /   100" % _format_number(float(actor.get("guard", 0.0)))

func _labels_for_fills(fills: Array[ColorRect]) -> Array[Label]:
	var labels: Array[Label] = []
	for fill: ColorRect in fills:
		for child: Node in fill.get_children():
			if child is Label:
				labels.append(child as Label)
				break
	return labels

func _render_actor_indicators(actor: Dictionary, counter_layer: Control, effect_layer: Control, mirrored: bool) -> void:
	var counters: Array[Dictionary] = _counter_entries(actor)
	var counter_count: int = mini(counters.size(), MAX_COUNTER_INDICATORS)
	_ensure_indicator_slots(counter_layer, counter_count, COUNTER_CARD_SCENE, true, mirrored)
	var counter_slots: Array[Control] = []
	for candidate: Control in _control_children(counter_layer):
		if not candidate.is_in_group("summoned_preview"): counter_slots.append(candidate)
	for index: int in counter_slots.size():
		var card: Control = counter_slots[index]
		card.visible = index < counter_count
		if not card.visible:
			continue
		var entry: Dictionary = counters[index]
		card.call("bind_counter", str(entry.get("id", "")), str(entry.get("label", "")), float(entry.get("value", 0.0)))
	_render_summons(actor, counter_layer)
	var statuses: Dictionary = actor.get("statuses", {}) as Dictionary
	var status_ids: Array = statuses.keys()
	status_ids.sort()
	var status_count: int = mini(status_ids.size(), MAX_SPECIAL_EFFECTS)
	_ensure_indicator_slots(effect_layer, status_count, SPECIAL_EFFECT_SCENE, false, mirrored)
	var effect_slots: Array[Control] = _control_children(effect_layer)
	for index: int in effect_slots.size():
		var badge: Control = effect_slots[index]
		badge.visible = index < status_count
		if not badge.visible:
			continue
		var status_id: String = str(status_ids[index])
		var raw_status: Variant = statuses[status_id]
		var status: Dictionary = raw_status as Dictionary if raw_status is Dictionary else {"value": raw_status}
		badge.call("bind_effect", status_id, str(status.get("label", status_id)), status)

func _ensure_indicator_slots(layer: Control, required_count: int, scene: PackedScene, is_counter: bool, mirrored: bool) -> void:
	while layer.get_child_count() < required_count:
		var slot: Control = scene.instantiate() as Control
		var slot_position: Vector2 = _next_indicator_position(layer, 4 if is_counter else 3, Vector2(138.0, 78.0) if is_counter else Vector2(138.0, 46.0))
		layer.add_child(slot)
		slot.position = slot_position
		slot.add_to_group("runtime_indicator")
		if is_counter:
			var counter_scale: float = COUNTER_CARD_DISPLAY_WIDTH / maxf(slot.size.x, 1.0)
			slot.scale = Vector2.ONE * counter_scale
		_prepare_mirrored_control(slot, mirrored)

func _next_indicator_position(layer: Control, default_columns: int, default_step: Vector2) -> Vector2:
	var slots: Array[Control] = []
	for child: Control in _control_children(layer):
		if not child.is_in_group("summoned_preview"): slots.append(child)
	if slots.is_empty():
		return Vector2.ZERO
	var first_position: Vector2 = slots[0].position
	var x_step: float = default_step.x
	if slots.size() >= 2:
		var authored_x_step: float = slots[1].position.x - first_position.x
		if not is_zero_approx(authored_x_step):
			x_step = authored_x_step
	var columns: int = default_columns
	var y_step: float = default_step.y
	for index: int in range(1, slots.size()):
		var authored_y_step: float = slots[index].position.y - first_position.y
		if absf(authored_y_step) >= 20.0:
			columns = index
			y_step = authored_y_step
			break
	var next_index: int = slots.size()
	return first_position + Vector2((next_index % columns) * x_step, (next_index / columns) * y_step)

func _control_children(layer: Control) -> Array[Control]:
	var result: Array[Control] = []
	for child: Node in layer.get_children():
		if child is Control:
			result.append(child as Control)
	return result

func _render_summons(actor: Dictionary, layer: Control) -> void:
	var slots: Array[Control] = []
	for child: Control in _control_children(layer):
		if child.is_in_group("summoned_preview"): slots.append(child)
	var summons: Array = actor.get("summons", []) as Array
	for index: int in slots.size():
		var slot: Control = slots[index]
		if index < summons.size() and summons[index] is Dictionary and slot.has_method("bind_summon"):
			slot.call("bind_summon", summons[index] as Dictionary)
		elif slot.has_method("clear_summon"):
			slot.call("clear_summon")

func _prepare_mirrored_control(control: Control, mirrored: bool) -> void:
	if not mirrored: return
	control.pivot_offset = control.size * 0.5
	control.rotation = PI

func _counter_entries(actor: Dictionary) -> Array[Dictionary]:
	var result: Array[Dictionary] = []
	var labels: Dictionary = actor.get("counter_labels", {}) as Dictionary
	_collect_counter_entries(actor.get("counters", {}) as Dictionary, "", labels, result)
	return result

func _collect_counter_entries(values: Dictionary, prefix: String, labels: Dictionary, result: Array[Dictionary]) -> void:
	var keys: Array = values.keys()
	keys.sort()
	for raw_key: Variant in keys:
		var key: String = str(raw_key)
		# 下划线资源是源规则的维护状态（回合戳、基准、阈值），不属于
		# 玩家可读的开局计数器，不能挤占状态栏槽位。
		if key.begins_with("_"):
			continue
		var canonical_id: String = key if prefix.is_empty() else "%s.%s" % [prefix, key]
		var value: Variant = values[raw_key]
		if value is Dictionary:
			_collect_counter_entries(value as Dictionary, canonical_id, labels, result)
			continue
		if not (value is int or value is float) or float(value) <= 0.0: continue
		result.append({"id": canonical_id, "label": str(labels.get(canonical_id, key)), "value": float(value)})

func _format_number(value: float) -> String:
	if is_equal_approx(value, roundf(value)): return str(int(roundf(value)))
	return "%.1f" % value

func _safe_ratio(value: float, maximum: float) -> float:
	return clampf(value / maxf(maximum, 0.001), 0.0, 1.0)

func _play_intro() -> void:
	_player_label.pivot_offset = Vector2(_player_label.size.x * 0.5, 0.0)
	_player_label.scale = Vector2(1.0, 0.0)
	_player_status.modulate.a = 0.0
	_opponent_status.modulate.a = 0.0
	_action_buttons.modulate.a = 0.0
	var player_target: Vector2 = _player_deck.position
	var opponent_target: Vector2 = _opponent_deck.position
	_player_deck.position = player_target + Vector2(-DECK_TRAVEL, 0.0)
	_opponent_deck.position = opponent_target + Vector2(DECK_TRAVEL, 0.0)
	var tween: Tween = create_tween().set_parallel(true)
	tween.set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
	tween.tween_property(_player_label, "scale", Vector2.ONE, INTRO_DURATION)
	tween.tween_property(_player_status, "modulate:a", 1.0, 0.4).set_delay(0.2)
	tween.tween_property(_opponent_status, "modulate:a", 1.0, 0.4).set_delay(0.2)
	tween.tween_property(_action_buttons, "modulate:a", 1.0, 0.45).set_delay(0.3)
	tween.tween_property(_player_deck, "position", player_target, 0.75).set_delay(0.1)
	tween.tween_property(_opponent_deck, "position", opponent_target, 0.75).set_delay(0.1)

func _animate_click(button: TextureButton) -> void:
	var original_scale: Vector2 = button.scale
	var tween: Tween = create_tween()
	tween.set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	tween.tween_property(button, "scale", original_scale * 0.9, 0.1)
	tween.tween_property(button, "scale", original_scale, 0.16)

