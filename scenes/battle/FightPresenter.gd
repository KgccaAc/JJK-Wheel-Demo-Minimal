extends Control

const UI: Script = preload("res://ui/ClientUi.gd")

const DEFAULT_PLAYER_ID: String = "gojo_satoru_shinjuku"
const DEFAULT_OPPONENT_ID: String = "sukuna_heian_or_shinjuku"
const MATCH_SEED: int = 20260902
const DATA_REPOSITORY_SCRIPT: Script = preload("res://battle/data/BattleDataRepository.gd")
const CARD_VIEW_MODEL_FACTORY_SCRIPT: Script = preload("res://battle/data/CardViewModelFactory.gd")
const CARD_AVAILABILITY_SERVICE_SCRIPT: Script = preload("res://battle/data/CardAvailabilityService.gd")
const BATTLE_STATE_SCRIPT: Script = preload("res://battle/core/BattleState.gd")
const FLOW_COORDINATOR_SCRIPT: Script = preload("res://scenes/battle/BattleFlowCoordinator.gd")
const ONLINE_BATTLE_CONTEXT_SCRIPT: Script = preload("res://battle/online/OnlineBattleContext.gd")
const STORY_BATTLE_ADAPTER: Script = preload("res://story/StoryBattleAdapter.gd")
const BASIC_CARD_FACE: Texture2D = preload("res://art/fight/基本牌.png")
const TECHNIQUE_CARD_FACE: Texture2D = preload("res://art/fight/术式牌牌面.png")
const DOMAIN_CARD_FACE: Texture2D = preload("res://art/fight/领域牌牌面.png")
const BASIC_CARD_SCENE: PackedScene = preload("res://ui/battle_cards/basic_card.tscn")
const TECHNIQUE_CARD_SCENE: PackedScene = preload("res://ui/battle_cards/technique_card.tscn")
const DOMAIN_CARD_SCENE: PackedScene = preload("res://ui/battle_cards/domain_card.tscn")
const CARD_DISPLAY_HEIGHT: float = 372.0

enum HandPhase { CLOSED, OPENING, OPEN, CLOSING, RESOLVING }

@onready var _session: BattleFlowSession = BattleFlowSession.new()
@onready var _flow: RefCounted = FLOW_COORDINATOR_SCRIPT.new()
@onready var _hand_layer: Control = $"../HandCardLayer"
@onready var _opponent_layer: Control = $"../OpponentResponseLayer"
@onready var _discard_prompt: Label = $"../DiscardPrompt"
@onready var _discard_overlay: ColorRect = $"../DiscardDropOverlay"
@onready var _hit_effect: ColorRect = $"../HitEffect"
@onready var _left_domain_panel: TextureRect = $"../DominArea/DomainArea2"
@onready var _right_domain_panel: TextureRect = $"../DominArea/DomainArea"
@onready var _left_domain_text: Label = $"../DominArea/DomainArea2/DomainText"
@onready var _right_domain_text: Label = $"../DominArea/DomainArea/DomainText"
@onready var _opponent_count: Label = $"../OpponentArea/OpponentHandCount"
@onready var _player_name: Label = $"../PlayerLabel/PlayerName"
@onready var _opponent_title: Label = $"../OpponentArea/Title"
@onready var _battle_log: RichTextLabel = $"../BattleLog"
@onready var _history_button: TextureButton = $"../ActionButtons/RoundHistory"
@onready var _basic_button: TextureButton = $"../ActionButtons/BasicCardButton"
@onready var _domain_button: TextureButton = $"../ActionButtons/DomainCardButton"
@onready var _technique_button: TextureButton = $"../ActionButtons/TechniqueCardButton"
@onready var _round_summary_panel: Control = $"../RoundSummaryPanel"
@onready var _exit_button: Button = $"../PlayerLabel/ExitButton"

var _phase: HandPhase = HandPhase.CLOSED
var _hand_open: bool = false
var _current_mode: StringName = &"normal"
var _queued_mode: StringName = &""
var _queued_close_requested: bool = false
var _discard_phase: bool = false
var _has_hand_data: bool = false
var _cards_by_mode: Dictionary = {&"normal": [], &"technique": [], &"domain": []}
var _hand_cards: Array[TextureButton] = []
var _selected_cards: Array[TextureButton] = []
var _table_cards: Array[TextureButton] = []
var _opponent_response_cards: Array[TextureRect] = []
var _left_domain_home: Vector2 = Vector2.ZERO
var _right_domain_home: Vector2 = Vector2.ZERO
var _domain_panels_activated: bool = false
var _hit_effect_triggered: bool = false
var _discard_in_progress_id: int = 0
var _data: RefCounted = DATA_REPOSITORY_SCRIPT.new()
var _card_view_models: RefCounted = CARD_VIEW_MODEL_FACTORY_SCRIPT.new()
var _card_availability: RefCounted = CARD_AVAILABILITY_SERVICE_SCRIPT.new()
var _hidden_card_diagnostics: Array[Dictionary] = []
var _initial_deal_started_offscreen: bool = false
var _hand_tween: Tween
var _flow_panel: Control
var _auto_advance_ticket: int = 0
var _last_domain_active: Array[bool] = [false, false]
var _rendered_domain_active: Array[bool] = [false, false]
var _online_input_battle: bool = false
var _online_local_side: int = 0
const INITIATIVE_SCENE: PackedScene = preload("res://scenes/battle/first_move_contest.tscn")

func _ready() -> void:
	_prepare_domain_panels()
	# Presenter 只渲染和播放动画；跨面板阶段推进统一交给流程编排器。
	_flow.attach(_session)
	_session.battle_loaded.connect(_on_battle_loaded)
	_session.hand_updated.connect(_on_hand_updated)
	_session.resources_changed.connect(_on_resources_changed)
	_session.battle_log_added.connect(_append_log)
	_session.battle_error.connect(_on_battle_error)
	_session.turn_resolved.connect(_on_turn_resolved)
	_session.state_committed.connect(func(_state: Variant) -> void:
		_flow.sync_from_session()
		_play_new_domain_expansion_sounds()
		call_deferred("_sync_flow")
	)
	var strategy: Control = get_node("../StrategySelectionPreview/StrategyPanel")
	strategy.set("embedded", true)
	strategy.strategy_confirmed.connect(_confirm_strategy)
	_round_summary_panel.z_index = 80
	_set_action_controls_enabled(false)
	_basic_button.pressed.connect(_request_hand_mode.bind(&"normal"))
	_domain_button.pressed.connect(_request_hand_mode.bind(&"domain"))
	_technique_button.pressed.connect(_request_hand_mode.bind(&"technique"))
	_history_button.pressed.connect(_resolve_history)
	_exit_button.pressed.connect(_exit_battle)
	_exit_button.tooltip_text = "退出当前战斗"
	call_deferred("_start_fixed_battle")

func _process(_delta: float) -> void:
	if not _online_input_battle: return
	if _flow.pump_online_socket():
		if _session.get_phase() == &"DEAL" and _phase == HandPhase.OPEN: _finish_online_resolution_visuals()
		_sync_flow()

func _start_fixed_battle() -> void:
	if bool(ONLINE_BATTLE_CONTEXT_SCRIPT.call("is_active")):
		_start_online_battle()
		return
	var player_id: String = DEFAULT_PLAYER_ID
	var opponent_id: String = DEFAULT_OPPONENT_ID
	var story: Node = get_node_or_null("/root/StoryState")
	var selection: Node = get_node_or_null("/root/SelectionState")
	if selection != null and not _is_story_battle():
		if selection.has_method("get_player_id"): player_id = str(selection.call("get_player_id"))
		if selection.has_method("get_opponent_id"): opponent_id = str(selection.call("get_opponent_id"))
	_audio_call(&"play_battle_music", [player_id, opponent_id])
	var result: Dictionary
	if _is_story_battle() and story != null:
		var context: Dictionary = story.call("battle_context", str(story.get("current_node"))) as Dictionary if story.has_method("battle_context") else {}
		opponent_id = str(context.get("opponent_id", "kechizu_origin_candidate"))
		result = _session.start_story_offline(STORY_BATTLE_ADAPTER.build_snapshot(story), opponent_id, MATCH_SEED, false)
	else:
		result = _session.start_fixed_offline(player_id, opponent_id, MATCH_SEED, false)
	if not bool(result.get("ok", false)):
		_report_boundary_error("BATTLE_INIT_FAILED", "BATTLE", "战斗初始化失败（角色 %s vs %s）：%s" % [player_id, opponent_id, str(result.get("error", "unknown"))], {"operation":"start_offline_battle"})
		return
	_flow.sync_from_session()
	_sync_flow()

func _start_online_battle() -> void:
	# 角色快照只用于确认本地视角。实际初始状态、私有手牌和后续结算都从
	# 权威 Worker bootstrap / round_result 获得，不能由客户端本地发牌。
	_online_input_battle = true
	var context: Dictionary = ONLINE_BATTLE_CONTEXT_SCRIPT.call("snapshot") as Dictionary
	var sides: Dictionary = _resolve_online_room_sides(context)
	if not bool(sides.get("ok", false)):
		_online_input_battle = false
		_report_boundary_error("ROOM_PLAYER_IDENTITY_INVALID", "ROOM", "联机房间玩家身份无法匹配：%s" % str(sides.get("error", "invalid_room_players")), {"operation":"resolve_room_sides"})
		return
	var player_id: String = str(sides.get("player_id", DEFAULT_PLAYER_ID))
	var opponent_id: String = str(sides.get("opponent_id", DEFAULT_OPPONENT_ID))
	_online_local_side = int(sides.get("local_side", 0))
	# BattleState actor indexes are the room's canonical order: [host, guest].
	# The local side is only an input/rendering cursor; it must not reorder the
	# session actors or both clients will submit to the wrong character.
	var actor_zero_id: String = str(sides.get("actor_zero_id", player_id))
	var actor_one_id: String = str(sides.get("actor_one_id", opponent_id))
	if actor_zero_id == actor_one_id:
		_online_input_battle = false
		_report_boundary_error("ROOM_DUPLICATE_CHARACTER", "ROOM", "联机房间两侧角色 ID 相同，拒绝使用房主角色重复开战：%s" % actor_zero_id, {"operation":"resolve_room_sides"})
		return
	print("[online-battle] local_side=%d local=%s opponent=%s actors=[%s,%s]" % [_online_local_side, player_id, opponent_id, actor_zero_id, actor_one_id])
	_audio_call(&"play_battle_music", [player_id, opponent_id])
	var room_players: Array = _array(_dictionary(context.get("room", {})).get("players", []))
	var result: Dictionary = _session.start_online_placeholder(room_players, MATCH_SEED) if _session.has_method("start_online_placeholder") else {"ok":false, "error":"online_placeholder_unavailable"}
	if not bool(result.get("ok", false)):
		_report_boundary_error("ONLINE_BATTLE_INIT_FAILED", "BATTLE", "联机战斗初始化失败：%s" % str(result.get("error", "unknown")), {"operation":"start_online_battle"})
		return
	_flow.set_online_input_mode(true)
	var configured: Dictionary = _flow.configure_online_input(context)
	if not bool(configured.get("ok", false)):
		_report_boundary_error("ONLINE_CONFIG_FAILED", "NETWORK", "联机 V3 配置失败：%s" % str(configured.get("error", "unknown")), {"operation":"configure_online_input"})
		return
	var bootstrap: Dictionary = _flow.bootstrap_online_state()
	if not bool(bootstrap.get("ok", false)):
		_report_boundary_error("ONLINE_BOOTSTRAP_FAILED", "NETWORK", "联机 V3 初始状态同步失败：%s" % str(bootstrap.get("error", "unknown")), {"operation":"bootstrap_online_state"})
		return
	# Placeholder actors only carry room ids.  Bootstrap replaces them with the
	# authority snapshot, so refresh labels/statuses once from that real profile
	# instead of leaving the initial English implementation id on screen.
	_on_battle_loaded(_session.get_state_snapshot())
	print("[online-battle] configured room=%s local_identity=%s side=%d" % [str(_dictionary(context.get("room", {})).get("room_id", "")), str(context.get("local_player_id", "")), _online_local_side])
	_flow.sync_from_session()
	_append_log("[color=#d9c7a2]联机 V3：等待双方提交策略输入[/color]")
	_sync_flow()

func _resolve_online_room_sides(context: Dictionary) -> Dictionary:
	var room: Dictionary = _dictionary(context.get("room", {}))
	var room_players: Array = _array(room.get("players", []))
	if room_players.size() != 2:
		return {"ok":false, "error":"room_players_not_ready"}
	var local_network_id: String = str(context.get("local_player_id", "")).strip_edges()
	if local_network_id.is_empty():
		return {"ok":false, "error":"local_player_identity_missing"}
	var local_side: int = -1
	for index: int in room_players.size():
		var entry: Variant = room_players[index]
		if entry is Dictionary and str((entry as Dictionary).get("player_id", "")).strip_edges() == local_network_id:
			local_side = index
			break
	if local_side < 0:
		return {"ok":false, "error":"local_player_not_in_room"}
	var opponent_side: int = 1 - local_side
	var local_entry: Dictionary = _dictionary(room_players[local_side])
	var opponent_entry: Dictionary = _dictionary(room_players[opponent_side])
	var player_id: String = str(local_entry.get("character_id", "")).strip_edges()
	var opponent_id: String = str(opponent_entry.get("character_id", "")).strip_edges()
	if player_id.is_empty() or opponent_id.is_empty():
		return {"ok":false, "error":"room_character_selection_missing"}
	return {
		"ok":true,
		"local_side":local_side,
		"player_id":player_id,
		"opponent_id":opponent_id,
		"actor_zero_id":str(_dictionary(room_players[0]).get("character_id", "")).strip_edges(),
		"actor_one_id":str(_dictionary(room_players[1]).get("character_id", "")).strip_edges()
	}

func _report_boundary_error(code: String, category: String, message: String, context: Dictionary = {}) -> void:
	var service: Node = get_node_or_null("/root/ErrorService")
	if service != null and service.has_method("report"):
		service.call("report", code, category, message, "战斗操作失败，请查看错误编号并重试。", context)
	push_error(message)

func _finish_online_resolution_visuals() -> void:
	if _phase == HandPhase.RESOLVING:
		_phase = HandPhase.OPEN
		_hand_open = true
	if not _selected_cards.is_empty(): _play_hit_effect("回合结算")
	_spawn_opponent_response_cards(_opponent_response_actions())
	_refresh_domain_panels_from_state()
	_clear_hand_nodes()
	_phase = HandPhase.CLOSED
	_hand_open = false
	var saved: Dictionary = _session.save_round_package()
	if not bool(saved.get("ok", false)):
		_append_log("回合记录保存失败：" + str(saved.get("error", "")))

func _on_battle_loaded(state: Dictionary) -> void:
	var actors: Array = state.get("actors", [])
	if actors.size() < 2: return
	_player_name.text = _actor_name(_local_actor(actors), "玩家")
	_opponent_title.text = _actor_name(_opponent_actor(actors), "对手")
	if _is_story_battle():
		var story: Node = get_node_or_null("/root/StoryState")
		var character: Dictionary = story.get("character") as Dictionary if story != null else {}
		var story_node_id := str(story.get("current_node")) if story != null else ""
		var story_definition: Dictionary = story.call("node_definition", story_node_id) as Dictionary if story != null and story.has_method("node_definition") else {}
		_player_name.text = str(character.get("displayName", "转盘角色 · %s" % str(character.get("grade_label", "未定"))))
		_opponent_title.text = _story_opponent_title(story_definition, story_node_id)
		_opponent_count.text = "对手手牌 %d" % _opponent_normal_hand().size()
	# Pass canonical room order; _update_statuses performs the single local-view
	# projection.  Pre-projecting here would invert the guest view a second time.
	_update_statuses(actors)
	_last_domain_active = _active_domain_flags(actors)
	_rendered_domain_active = _last_domain_active.duplicate()
	var story_state := get_node_or_null("/root/StoryState") as Node
	var story_node_id := str(story_state.get("current_node")) if story_state != null else ""
	var story_definition: Dictionary = story_state.call("node_definition", story_node_id) as Dictionary if story_state != null and story_state.has_method("node_definition") else {}
	var story_log_title := "故事战斗：%s" % _story_opponent_title(story_definition, story_node_id)
	_battle_log.text = "[color=#d9c7a2]%s[/color]" % (story_log_title if _is_story_battle() else "离线对局已加载")
	_round_summary_panel.visible = false

func _on_turn_resolved(result: Dictionary) -> void:
	if _round_summary_panel.has_method("show_round_package"):
		_round_summary_panel.call("show_round_package", result.get("round_package", {}))
	_round_summary_panel.visible = true
	_round_summary_panel.move_to_front()
	# 纪要是已提交 RoundPackage 的展示：自动进入下一回合，但不隐藏它；
	# 下一次结算会原位刷新。非终局纪要不拦截鼠标，不能妨碍自动发牌后的操作。
	if _session.get_phase() != &"FINISHED":
		_auto_advance_ticket += 1
		_auto_continue_round(_auto_advance_ticket)

func _auto_continue_round(ticket: int) -> void:
	await get_tree().create_timer(1.0).timeout
	if ticket != _auto_advance_ticket or _session.get_phase() != &"DEAL": return
	_continue_round(true)

func _actor_name(actor: Dictionary, fallback: String) -> String:
	var profile: Dictionary = actor.get("profile", {}) as Dictionary
	# Character ids/canonical names are often English implementation keys.  A
	# login-card displayName is the player-facing name and must survive V3's
	# projected opponent profile as well as the local full profile.
	var display_name: String = str(actor.get("displayName", profile.get("displayName", profile.get("display_name", "")))).strip_edges()
	if not display_name.is_empty():
		return display_name
	return str(actor.get("name", profile.get("name", fallback)))

func _on_hand_updated(normal_hand: Array, domain_hand: Array) -> void:
	# The session owns card truth. This method only rebuilds category projections
	# and updates the view according to the current hand animation phase.
	# Signal aliases are actor 0.  In online V3 the guest can be actor 1.
	var local_normal: Array = _local_normal_hand()
	var local_domain: Array = _local_domain_hand()
	_cards_by_mode[&"normal"] = _cards_for_category(local_normal, &"basic")
	_cards_by_mode[&"technique"] = _cards_for_category(local_normal, &"technique")
	_cards_by_mode[&"combined"] = local_normal.duplicate(true)
	_cards_by_mode[&"domain"] = _cards_for_category(local_domain, &"domain")
	_discard_phase = bool(_session.get_state_snapshot().get("overflow_discard_required", false))
	_current_mode = _normalized_hand_mode(_current_mode)
	_update_discard_prompt(local_normal)
	if _session.get_phase() not in [&"DISCARD", &"PLAY"]: return
	if not _has_hand_data:
		_has_hand_data = true
		_request_hand_mode(_current_mode, true)
	elif _phase == HandPhase.OPEN:
		_refresh_open_hand()
	elif _phase == HandPhase.CLOSED:
		_request_hand_mode(_current_mode, true)

func _cards_for_category(cards: Array, category: StringName) -> Array[Dictionary]:
	var result: Array[Dictionary] = []
	var profile: Dictionary = _player_profile()
	for card: Dictionary in cards:
		if _card_view_models.classify(card, profile) == category: result.append(card)
	return result

func _player_profile() -> Dictionary:
	var actors: Array = _session.get_state_snapshot().get("actors", []) as Array
	var side: int = _online_local_side if _online_input_battle else 0
	return _dictionary(_dictionary(actors[side]).get("profile", {})) if side >= 0 and actors.size() > side else {}

## Preview follows the active ruleset. V3 receives a BattleState snapshot so
## CardAvailabilityService and the formal resolver use exactly the same
## scaling, mitigation, and DSL read path. Legacy sessions keep their existing
## CardAvailabilityResult contract until their state explicitly opts in.
func _evaluate_card_availability(card: Dictionary) -> Variant:
	var snapshot: Dictionary = _session.get_state_snapshot()
	var actor_index: int = _online_local_side if _online_input_battle else 0
	if str(snapshot.get("ruleset_version", "")) == "battle-rules-v3":
		var v3_state: BattleState = BATTLE_STATE_SCRIPT.new() as BattleState
		v3_state.restore_canonical_snapshot(snapshot)
		return _card_availability.evaluate_v3(card, v3_state, actor_index, _selected_card_data())
	return _card_availability.evaluate(card, snapshot, actor_index, _selected_card_data())

func _local_normal_hand() -> Array:
	var actors: Array = _session.get_state_snapshot().get("actors", []) as Array
	var side: int = _online_local_side if _online_input_battle else 0
	return _array(_dictionary(_dictionary(actors[side]).get("zones", {})).get("hand", [])) if side >= 0 and actors.size() > side else []

func _opponent_normal_hand() -> Array:
	var actors: Array = _session.get_state_snapshot().get("actors", []) as Array
	var side: int = 1 - _online_local_side if _online_input_battle else 1
	return _array(_dictionary(_dictionary(actors[side]).get("zones", {})).get("hand", [])) if side >= 0 and actors.size() > side else []

func _local_actor(actors: Array) -> Dictionary:
	var side: int = _online_local_side if _online_input_battle else 0
	return actors[side] as Dictionary if actors.size() > side and actors[side] is Dictionary else {}

func _opponent_actor(actors: Array) -> Dictionary:
	var side: int = 1 - _online_local_side if _online_input_battle else 1
	return actors[side] as Dictionary if actors.size() > side and actors[side] is Dictionary else {}

func _local_domain_hand() -> Array:
	var actors: Array = _session.get_state_snapshot().get("actors", []) as Array
	var side: int = _online_local_side if _online_input_battle else 0
	return _array(_dictionary(_dictionary(actors[side]).get("zones", {})).get("domain", [])) if side >= 0 and actors.size() > side else []

func _normalized_hand_mode(requested_mode: StringName) -> StringName:
	if _discard_phase: return &"combined"
	if requested_mode == &"normal" and (_cards_by_mode.get(&"normal", []) as Array).is_empty() and not (_cards_by_mode.get(&"technique", []) as Array).is_empty():
		return &"technique"
	return requested_mode

func _request_hand_mode(next_mode: StringName, force_open: bool = false) -> void:
	# A mode request is a toggle when the current hand is open; during an
	# animation it is queued so only one close/open transition can run at once.
	if not _has_hand_data and not (_phase == HandPhase.RESOLVING and _hand_open): return
	next_mode = _normalized_hand_mode(next_mode)
	if _phase == HandPhase.RESOLVING:
		if _hand_open and (_discard_phase or _discard_in_progress_id != 0 or next_mode == _current_mode) and not force_open:
			_queued_close_requested = true
			_queued_mode = &""
		else:
			_queued_mode = next_mode
		return
	if _phase == HandPhase.OPENING or _phase == HandPhase.CLOSING:
		_queued_mode = next_mode
		return
	if _hand_open and next_mode == _current_mode and not force_open:
		_queued_mode = &""
		_begin_close()
		return
	if _hand_open:
		_queued_mode = next_mode
		_begin_close()
		return
	_current_mode = next_mode
	_begin_open()

func _begin_open() -> void:
	if _phase != HandPhase.CLOSED or _session.get_phase() not in [&"DISCARD", &"PLAY"]: return
	_audio_call(&"play_ui_sfx", [&"card_deal"])
	_phase = HandPhase.OPENING
	_hand_open = true
	_set_action_controls_enabled(false)
	_spawn_hand_cards()
	if _hand_cards.is_empty():
		_finish_open()
		return
	if _hand_tween != null and _hand_tween.is_valid(): _hand_tween.kill()
	_hand_tween = create_tween().set_parallel(true)
	for card: TextureButton in _hand_cards:
		var distance: float = card.global_position.distance_to(_home_position_of(card))
		var duration: float = clampf(0.66 - distance / 1800.0 * 0.42, 0.18, 0.58)
		_hand_tween.tween_property(card, "global_position", _home_position_of(card), duration).set_trans(Tween.TRANS_QUINT).set_ease(Tween.EASE_OUT)
		_hand_tween.tween_property(card, "modulate:a", 1.0, duration * 0.72)
	_hand_tween.finished.connect(_finish_open, CONNECT_ONE_SHOT)

func _finish_open() -> void:
	if _phase != HandPhase.OPENING: return
	_phase = HandPhase.OPEN
	_set_action_controls_enabled(true)
	if _queued_close_requested:
		_queued_close_requested = false
		_begin_close()
		return
	if not _queued_mode.is_empty():
		var queued: StringName = _queued_mode
		_queued_mode = &""
		_request_hand_mode(queued)

func _begin_close() -> void:
	if _phase != HandPhase.OPEN: return
	_phase = HandPhase.CLOSING
	_hand_open = false
	_set_action_controls_enabled(false)
	_normalize_raised_cards_for_close()
	if _hand_cards.is_empty():
		_finish_close()
		return
	if _hand_tween != null and _hand_tween.is_valid(): _hand_tween.kill()
	_hand_tween = create_tween().set_parallel(true)
	for card: TextureButton in _hand_cards:
		_hand_tween.tween_property(card, "global_position", Vector2(get_viewport_rect().size.x + 120.0, _home_position_of(card).y), 0.32).set_trans(Tween.TRANS_QUINT).set_ease(Tween.EASE_IN)
		_hand_tween.tween_property(card, "modulate:a", 0.0, 0.22)
	_hand_tween.finished.connect(_finish_close, CONNECT_ONE_SHOT)

func _finish_close() -> void:
	if _phase != HandPhase.CLOSING: return
	for card: TextureButton in _hand_cards:
		if is_instance_valid(card): card.queue_free()
	_hand_cards.clear()
	_phase = HandPhase.CLOSED
	_set_action_controls_enabled(true)
	if not _queued_mode.is_empty():
		_current_mode = _queued_mode
		_queued_mode = &""
		_begin_open()

func _spawn_hand_cards() -> void:
	for card: TextureButton in _hand_cards:
		if is_instance_valid(card): card.queue_free()
	_hand_cards.clear()
	var cards: Array = _cards_by_mode.get(_current_mode, [])
	var viewport_width: float = get_viewport_rect().size.x
	var visible_index: int = 0
	for index: int in cards.size():
		var data: Dictionary = cards[index] as Dictionary
		var instance_id: String = str(data.get("instance_id", ""))
		var table_key: String = instance_id if not instance_id.is_empty() else str(data.get("id", ""))
		if _table_card_ids().has(table_key): continue
		var availability: Variant = _evaluate_card_availability(data)
		if _selection_slots_full() and _card_view_models.classify(data, _player_profile()) != &"domain":
			availability = {"playable":false, "visible":true, "reason":"限制使用", "ui_reason":"限制使用"}
		if _current_mode != &"domain" and not _discard_phase and not bool(availability.get("visible")):
			_hidden_card_diagnostics.append({"id": str(data.get("id", "")), "reason": str(availability.get("reason"))})
			print_verbose("隐藏不可用牌：%s（%s）" % [str(data.get("id", "")), str(availability.get("reason"))])
			continue
		var view_model: BattleCardViewModel = _card_view_models.build_card_view_model(data, _player_profile(), availability)
		var card: TextureButton = _scene_for_category(view_model.display_category).instantiate() as TextureButton
		var face: Texture2D = _card_face(data)
		var display_size: Vector2 = _card_display_size(face)
		card.custom_minimum_size = display_size
		card.size = display_size
		card.ignore_texture_size = true
		card.stretch_mode = TextureButton.STRETCH_SCALE
		card.texture_normal = face
		card.tooltip_text = str(data.get("summary", data.get("name", "")))
		var home: Vector2 = _home_position(visible_index, _current_mode)
		card.call("configure", data, _current_mode, home)
		card.set_meta("card_data", data)
		card.set_meta("home_position", home)
		card.set_meta("placement", &"hand")
		if _discard_phase:
			card.set_meta("discard_locked", true)
		card.global_position = Vector2(viewport_width + 110.0 + visible_index * 24.0, home.y)
		card.modulate.a = 0.0
		if card.global_position.x >= viewport_width: _initial_deal_started_offscreen = true
		card.connect(&"selection_requested", _on_card_selected)
		card.connect(&"drag_started", _on_card_drag_started)
		card.connect(&"drag_moved", _on_card_dragged)
		card.connect(&"drag_released", _on_card_drag_released)
		_hand_layer.add_child(card)
		card.call("bind_card", view_model)
		if _current_mode == &"domain": card.disabled = false
		if _discard_phase:
			# bind_card may update visual state, so apply the discard tint last.
			card.disabled = false
			card.modulate = Color(0.58, 0.58, 0.58, 0.0)
		_hand_cards.append(card)
		visible_index += 1

func _refresh_open_hand(animated: bool = false) -> void:
	if _phase != HandPhase.OPEN: return
	_spawn_hand_cards()
	for card: TextureButton in _hand_cards:
		if not is_instance_valid(card): continue
		if animated:
			card.global_position = _home_position_of(card) + Vector2(0.0, 36.0)
			card.scale = Vector2(0.94, 0.94)
			card.modulate.a = 0.0
			var tween: Tween = create_tween().set_parallel(true)
			tween.tween_property(card, "global_position", _home_position_of(card), 0.28).set_trans(Tween.TRANS_QUINT).set_ease(Tween.EASE_OUT)
			tween.tween_property(card, "scale", Vector2.ONE, 0.28).set_trans(Tween.TRANS_QUINT).set_ease(Tween.EASE_OUT)
			tween.tween_property(card, "modulate:a", 1.0, 0.18)
		else:
			card.global_position = _home_position_of(card)
			card.modulate.a = 1.0
	_apply_discard_visuals()

func _home_position(index: int, mode: StringName) -> Vector2:
	# 牌组根据可见数量压缩间距，全部手牌留在视口内；不改tscn美术位置。
	var count: int = maxi(1, (_cards_by_mode.get(mode, []) as Array).size())
	var width: float = get_viewport_rect().size.x
	var card_width: float = CARD_DISPLAY_HEIGHT * 2.0 / 3.0
	var step: float = minf(170.0, maxf(36.0, (width - 120.0 - card_width) / maxf(1.0, count - 1)))
	var start: float = maxf(30.0, (width - card_width - step * (count - 1)) * 0.5)
	var y: float = minf(500.0, get_viewport_rect().size.y - CARD_DISPLAY_HEIGHT - 25.0)
	if mode == &"domain": y = 155.0
	return Vector2(start + index * step, y)

func _home_position_of(card: TextureButton) -> Vector2:
	return card.get_meta("home_position", Vector2.ZERO) as Vector2

func _placement_of(card: TextureButton) -> StringName:
	return card.get_meta("placement", &"hand") as StringName

func _table_card_ids() -> Dictionary:
	var ids: Dictionary = {}
	for card: TextureButton in _table_cards:
		if not is_instance_valid(card): continue
		var data: Dictionary = _card_data(card)
		var instance_id: String = str(data.get("instance_id", ""))
		ids[instance_id if not instance_id.is_empty() else str(data.get("id", ""))] = true
	return ids

func _table_position(index: int) -> Vector2:
	return Vector2(180.0 + index * 205.0, 365.0)

func _normalize_raised_cards_for_close() -> void:
	var changed: bool = false
	for card: TextureButton in _selected_cards.duplicate():
		if not is_instance_valid(card) or _placement_of(card) == &"table": continue
		_selected_cards.erase(card)
		card.set_meta("is_selected", false)
		card.set_meta("placement", &"hand")
		card.global_position = _home_position_of(card)
		card.scale = Vector2.ONE
		changed = true
	if changed: _refresh_card_availability()

func _card_data(card: TextureButton) -> Dictionary:
	return card.get_meta("card_data", {}) as Dictionary

func _card_face(card: Dictionary) -> Texture2D:
	var category: StringName = _card_view_models.classify(card, _player_profile())
	if category == &"domain": return DOMAIN_CARD_FACE
	if category == &"technique": return TECHNIQUE_CARD_FACE
	return BASIC_CARD_FACE

func _card_display_size(face: Texture2D) -> Vector2:
	var source_size: Vector2 = face.get_size()
	var source_aspect: float = source_size.x / maxf(source_size.y, 1.0)
	return Vector2(CARD_DISPLAY_HEIGHT * source_aspect, CARD_DISPLAY_HEIGHT)

func _scene_for_category(category: StringName) -> PackedScene:
	if category == &"domain": return DOMAIN_CARD_SCENE
	if category == &"technique": return TECHNIQUE_CARD_SCENE
	return BASIC_CARD_SCENE

func _on_card_selected(card: TextureButton) -> void:
	if _phase != HandPhase.OPEN: return
	if _discard_phase:
		_append_log("请将要弃置的牌拖到弃牌提示区域")
		return
	if _session.get_phase() != &"PLAY": return
	if _selected_cards.has(card):
		_cancel_card_selection(card)
		return
	if _placement_of(card) == &"table": return
	if _selection_slots_full() and not _is_domain_card(card):
		_append_log("限制使用")
		return
	var availability: Variant = _evaluate_card_availability(_card_data(card))
	if not bool(availability.get("playable")):
		_append_log(str(availability.get("reason")))
		return
	var selected_input: Array[Dictionary] = _selected_card_data()
	selected_input.append(_card_data(card))
	var check: Dictionary = _validate_selection(selected_input)
	if not check.ok:
		_append_log("无法选择：" + str(check.get("error", "")))
		return
	_selected_cards.append(card)
	card.set_meta("is_selected", true)
	card.set_meta("placement", &"raised")
	card.z_index = 12
	_refresh_card_availability()
	var tween: Tween = create_tween()
	tween.tween_property(card, "global_position", _home_position_of(card) + Vector2(0.0, -28.0), 0.16).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
	tween.parallel().tween_property(card, "scale", Vector2(1.06, 1.06), 0.16)

func _on_card_drag_started(card: TextureButton, mouse_position: Vector2) -> void:
	if _phase != HandPhase.OPEN: return
	if _discard_phase:
		card.z_index = 14
		return
	if not _selected_cards.has(card) and not _select_card_for_drag(card): return
	card.z_index = 14

## 直接拖拽不先播放“抬起”动画，避免该 tween 与鼠标跟随同时写位置造成卡顿。
func _select_card_for_drag(card: TextureButton) -> bool:
	if _placement_of(card) == &"table": return true
	if _selection_slots_full() and not _is_domain_card(card):
		_append_log("限制使用")
		return false
	var availability: Variant = _evaluate_card_availability(_card_data(card))
	if not bool(availability.playable):
		_append_log(str(availability.reason))
		return false
	var selected_input: Array[Dictionary] = _selected_card_data()
	selected_input.append(_card_data(card))
	var check: Dictionary = _validate_selection(selected_input)
	if not check.ok:
		_append_log("无法选择：" + str(check.get("error", "")))
		return false
	_selected_cards.append(card)
	card.set_meta("is_selected", true)
	card.set_meta("placement", &"raised")
	_refresh_card_availability()
	return true

func _on_card_dragged(card: TextureButton, mouse_position: Vector2) -> void:
	if _phase != HandPhase.OPEN: return
	card.global_position = mouse_position - card.size * 0.5
	card.scale = Vector2(1.18, 1.18)
	_history_button.modulate = Color(1.25, 0.78, 0.78, 1.0) if _history_drop_rect().has_point(mouse_position) else Color.WHITE

func _on_card_drag_released(card: TextureButton, mouse_position: Vector2) -> void:
	_history_button.modulate = Color.WHITE
	if _phase != HandPhase.OPEN: return
	if _discard_phase and _discard_drop_rect().has_point(mouse_position):
		_discard_card(card)
	elif _discard_phase:
		var tween: Tween = create_tween()
		tween.tween_property(card, "global_position", _home_position_of(card), 0.18).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
		tween.parallel().tween_property(card, "scale", Vector2.ONE, 0.18)
	elif _hand_drop_rect().has_point(mouse_position):
		_cancel_card_selection(card)
	else:
		_snap_card_to_table(card)

func _snap_card_to_table(card: TextureButton) -> void:
	_audio_call(&"play_ui_sfx", [&"battle_click"])
	if not _selected_cards.has(card): _selected_cards.append(card)
	card.set_meta("is_selected", true)
	card.set_meta("placement", &"table")
	# 待选区在手牌层的下方，允许仍留在手牌区的牌遮住它。Control 的 GUI
	# 命中会优先检查更晚的 sibling，因此同时把待选牌移到最早 sibling，
	# 让视觉上方的手牌在重叠区域先获得输入。
	card.z_index = -1
	_hand_layer.move_child(card, 0)
	_hand_cards.erase(card)
	if not _table_cards.has(card): _table_cards.append(card)
	var index: int = _table_cards.find(card)
	var target: Vector2 = _table_position(index)
	var tween: Tween = create_tween()
	tween.tween_property(card, "global_position", target, 0.2).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
	tween.parallel().tween_property(card, "scale", Vector2(0.76, 0.76), 0.2)
	_refresh_card_availability()

func _cancel_card_selection(card: TextureButton) -> void:
	_selected_cards.erase(card)
	_table_cards.erase(card)
	card.set_meta("is_selected", false)
	card.set_meta("placement", &"hand")
	if not _hand_cards.has(card): _hand_cards.append(card)
	card.z_index = 0
	var tween: Tween = create_tween()
	tween.tween_property(card, "global_position", _home_position_of(card), 0.18).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
	tween.parallel().tween_property(card, "scale", Vector2.ONE, 0.18)
	_refresh_card_availability()

func _selected_card_data() -> Array[Dictionary]:
	var result: Array[Dictionary] = []
	for card: TextureButton in _selected_cards: result.append(_card_data(card))
	return result

func _refresh_card_availability() -> void:
	for card: TextureButton in _hand_cards + _table_cards:
		if not is_instance_valid(card) or not card.has_method("bind_card"): continue
		var availability: Variant = _evaluate_card_availability(_card_data(card))
		if _selection_slots_full() and _placement_of(card) == &"hand" and not _is_domain_card(card):
			availability = {"playable":false, "visible":true, "reason":"限制使用", "ui_reason":"限制使用"}
		var view_model: BattleCardViewModel = _card_view_models.build_card_view_model(_card_data(card), _player_profile(), availability)
		card.call("bind_card", view_model)

func _selection_slots_full() -> bool:
	var limit: int = 4 if (_player_profile().get("traits", []) as Array).has("extra_card_slot") else 3
	var occupied: int = 0
	for card: TextureButton in _table_cards:
		if is_instance_valid(card) and not _is_domain_card(card): occupied += 1
	return occupied >= limit

func _is_domain_card(card: TextureButton) -> bool:
	return _card_view_models.classify(_card_data(card), _player_profile()) == &"domain"

func _discard_card(card: TextureButton) -> void:
	if _phase != HandPhase.OPEN or not _discard_phase: return
	_audio_call(&"play_ui_sfx", [&"card_discard"])
	if not _selected_cards.has(card): _selected_cards.append(card)
	_phase = HandPhase.RESOLVING
	_set_action_controls_enabled(false)
	# 提交由编排器完成；Presenter 只在规则接受后播放弃牌动画。
	var discard_result: Dictionary = _flow.submit_discard_card(_card_data(card))
	if not discard_result.ok:
		_phase = HandPhase.OPEN
		_set_action_controls_enabled(true)
		_append_log("无法弃牌：" + str(discard_result.get("error", "")))
		return
	var target: Vector2 = _history_button.global_position + _history_button.size * 0.5
	var card_instance_id: int = card.get_instance_id()
	_discard_in_progress_id = card_instance_id
	# Keep both completion paths: tween.finished is the normal path, while the
	# timer handles a node/tween interrupted by a scene update. The instance ID
	# guard makes the duplicate callback harmless.
	var tween: Tween = create_tween()
	tween.tween_property(card, "global_position", target, 0.24).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_IN)
	tween.parallel().tween_property(card, "scale", Vector2.ZERO, 0.24)
	tween.parallel().tween_property(card, "modulate:a", 0.0, 0.22)
	tween.finished.connect(_finish_discard_by_id.bind(card_instance_id))
	get_tree().create_timer(0.3).timeout.connect(_finish_discard_by_id.bind(card_instance_id))

func _finish_discard_by_id(card_instance_id: int) -> void:
	if _discard_in_progress_id != card_instance_id: return
	var card: TextureButton = instance_from_id(card_instance_id) as TextureButton
	if card != null:
		_finish_discard(card)
		return
	_complete_discard_transition()

func _finish_discard(card: TextureButton) -> void:
	if is_instance_valid(card) and (_hand_cards.has(card) or _table_cards.has(card)):
		_selected_cards.erase(card)
		_hand_cards.erase(card)
		_table_cards.erase(card)
		card.queue_free()
		_refresh_card_availability()
	_complete_discard_transition()

func _complete_discard_transition() -> void:
	_discard_in_progress_id = 0
	call_deferred("_sync_flow")
	if _phase != HandPhase.RESOLVING: return
	var close_requested: bool = _queued_close_requested
	_queued_close_requested = false
	_phase = HandPhase.OPEN
	_hand_open = true
	_discard_phase = bool(_session.get_state_snapshot().get("overflow_discard_required", false))
	_apply_discard_visuals()
	if close_requested:
		_begin_close()
		return
	if not _queued_mode.is_empty():
		var queued: StringName = _queued_mode
		_queued_mode = &""
		_request_hand_mode(queued)

func _resolve_history() -> void:
	# 已拖至待选区的牌在收起手牌后仍是有效输入；不能把显示动画状态当成
	# 规则阶段，从而阻止确认出牌。
	if _phase not in [HandPhase.OPEN, HandPhase.CLOSED] or _session.get_phase() != &"PLAY": return
	var check: Dictionary = _validate_selection(_selected_card_data())
	if not check.ok:
		_append_log("无法结算：" + str(check.get("error", "")))
		return
	_phase = HandPhase.RESOLVING
	_audio_call(&"play_sword_attack")
	_hand_open = false
	_set_action_controls_enabled(false)
	_animate_hand_close_before_resolution()

func _animate_hand_close_before_resolution() -> void:
	# 先收起未出牌的手牌，再播放待选牌的出牌动画；避免两个动画同时争夺视觉焦点。
	var cards_to_close: Array[TextureButton] = []
	for card: TextureButton in _hand_cards:
		if is_instance_valid(card) and not _selected_cards.has(card): cards_to_close.append(card)
	if cards_to_close.is_empty():
		_begin_selected_card_resolution_animation()
		return
	if _hand_tween != null and _hand_tween.is_valid(): _hand_tween.kill()
	_hand_tween = create_tween().set_parallel(true)
	for card: TextureButton in cards_to_close:
		_hand_tween.tween_property(card, "global_position", Vector2(get_viewport_rect().size.x + 120.0, _home_position_of(card).y), 0.24).set_trans(Tween.TRANS_QUINT).set_ease(Tween.EASE_IN)
		_hand_tween.tween_property(card, "modulate:a", 0.0, 0.18)
	_hand_tween.finished.connect(_begin_selected_card_resolution_animation, CONNECT_ONE_SHOT)

func _begin_selected_card_resolution_animation() -> void:
	if _phase != HandPhase.RESOLVING: return
	if _selected_cards.is_empty():
		_finish_history_resolution()
		return
	if _hand_tween != null and _hand_tween.is_valid(): _hand_tween.kill()
	_hand_tween = create_tween().set_parallel(true)
	for index: int in _selected_cards.size():
		var card: TextureButton = _selected_cards[index]
		_hand_tween.tween_property(card, "global_position", Vector2(550.0 + index * 100.0, 355.0), 0.3).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_IN_OUT)
		_hand_tween.tween_property(card, "scale", Vector2(0.68, 0.68), 0.3)
	_hand_tween.finished.connect(_finish_history_resolution, CONNECT_ONE_SHOT)

func _finish_history_resolution() -> void:
	if _phase != HandPhase.RESOLVING: return
	var result: Dictionary = _flow.resolve_cards(_selected_card_data())
	if bool(result.get("waiting", false)):
		_phase = HandPhase.OPEN
		_hand_open = true
		_set_action_controls_enabled(false)
		_append_log("已提交出牌，等待对方出牌…")
		return
	if not result.ok:
		# 失败保留选牌，不能播放成功特效并删除用户的输入。
		_phase = HandPhase.OPEN
		_hand_open = true
		for card: TextureButton in _selected_cards:
			card.global_position = _home_position_of(card) + Vector2(0, -28)
			card.scale = Vector2.ONE
		_append_log("结算失败：" + str(result.get("error", "")))
		_set_action_controls_enabled(true)
		return
	if not _selected_cards.is_empty(): _play_hit_effect("回合结算")
	_spawn_opponent_response_cards(_opponent_response_actions())
	_refresh_domain_panels_from_state()
	_clear_hand_nodes()
	_phase = HandPhase.CLOSED
	_hand_open = false
	var saved: Dictionary = _session.save_round_package()
	if not saved.ok: _append_log("回合记录保存失败：" + str(saved.get("error", "")))
	_sync_flow()

func _exit_battle() -> void:
	if _session.get_phase() == &"FINISHED":
		_continue_round(true)
		return
	if _is_story_battle():
		_finish_story_battle("retreat")
		return
	UI.navigate(self, "res://scenes/roster/roster_picker.tscn")

func _spawn_opponent_response_cards(cards: Array) -> void:
	for card: TextureRect in _opponent_response_cards: card.queue_free()
	_opponent_response_cards.clear()
	for index: int in cards.size():
		var data: Dictionary = cards[index] as Dictionary
		var response: TextureRect = TextureRect.new()
		response.custom_minimum_size = Vector2(106.0, 68.0)
		response.size = Vector2(106.0, 68.0)
		response.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		response.stretch_mode = TextureRect.STRETCH_SCALE
		response.texture = _card_face(data)
		response.global_position = Vector2(get_viewport_rect().size.x + 80.0, 425.0 + index * 74.0)
		response.mouse_filter = Control.MOUSE_FILTER_IGNORE
		_opponent_layer.add_child(response)
		_opponent_response_cards.append(response)
		var tween: Tween = create_tween()
		tween.tween_property(response, "global_position", Vector2(930.0 + index * 74.0, 425.0 + index * 38.0), 0.38).set_trans(Tween.TRANS_QUINT).set_ease(Tween.EASE_OUT)

func _opponent_response_actions() -> Array:
	var snapshot: Dictionary = _session.get_state_snapshot()
	if _online_input_battle:
		var actions: Array = snapshot.get("last_round_actions", []) as Array
		var opponent_side: int = 1 - _online_local_side
		return actions[opponent_side] as Array if actions.size() > opponent_side and actions[opponent_side] is Array else []
	return snapshot.get("last_cpu_actions", []) as Array

func _prepare_domain_panels() -> void:
	_left_domain_home = _left_domain_panel.global_position
	_right_domain_home = _right_domain_panel.global_position
	_left_domain_panel.visible = false
	_right_domain_panel.visible = false
	_left_domain_text.text = ""
	_right_domain_text.text = ""
	_hit_effect.visible = false

func _update_discard_prompt(normal_hand: Array) -> void:
	var round_number: int = int(_session.get_state_snapshot().get("round", 1))
	var pending: int = int(_session.get_state_snapshot().get("pending_discard_count", 0))
	_discard_prompt.visible = pending > 0
	_discard_overlay.visible = _discard_prompt.visible
	if _discard_prompt.visible:
		_discard_prompt.text = "第 %d 回合：请拖动牌到此处弃置至 8 张（还需弃置 %d 张）。" % [round_number, pending]

func _normal_hand_count(cards: Array) -> int:
	var count: int = 0
	for card: Dictionary in cards:
		if str(card.get("type", "")) != "domain": count += 1
	return count

func normal_hand_count_for_acceptance() -> int:
	return _normal_hand_count(_session.get_state_snapshot().get("normal_hand", []) as Array)

func _activate_domain_panels(domain_card: Dictionary) -> void:
	var actors: Array = _session.get_state_snapshot().get("actors", []) as Array
	var player: Dictionary = _dictionary(actors[0]) if not actors.is_empty() else {}
	var opponent: Dictionary = _dictionary(actors[1]) if actors.size() > 1 else {}
	_left_domain_text.text = _format_domain_text(player, domain_card)
	_right_domain_text.text = _format_domain_text(opponent, {})
	var viewport_width: float = get_viewport_rect().size.x
	_left_domain_panel.global_position = Vector2(-_left_domain_panel.size.x - 40.0, _left_domain_home.y)
	_right_domain_panel.global_position = Vector2(viewport_width + 40.0, _right_domain_home.y)
	_left_domain_panel.modulate.a = 0.0
	_right_domain_panel.modulate.a = 0.0
	_left_domain_panel.visible = true
	_right_domain_panel.visible = true
	_domain_panels_activated = true
	var tween: Tween = create_tween().set_parallel(true)
	tween.set_trans(Tween.TRANS_QUINT).set_ease(Tween.EASE_OUT)
	tween.tween_property(_left_domain_panel, "global_position", _left_domain_home, 0.54)
	tween.tween_property(_right_domain_panel, "global_position", _right_domain_home, 0.54)
	tween.tween_property(_left_domain_panel, "modulate:a", 1.0, 0.34)
	tween.tween_property(_right_domain_panel, "modulate:a", 1.0, 0.34)

func _format_domain_text(actor: Dictionary, fallback_card: Dictionary) -> String:
	var profile: Dictionary = actor.get("profile", {})
	var owner_name: String = str(actor.get("name", profile.get("name", "未知持有人")))
	var runtime: Dictionary = actor.get("domain_state", {}) as Dictionary
	var domain_id: String = str(runtime.get("id", profile.get("domainId", "")))
	var record: Dictionary = _find_domain_record(domain_id, str(profile.get("id", "")))
	if record.is_empty():
		var fallback_name: String = str(fallback_card.get("name", "未展开"))
		return "领域：%s\n持有人：%s\n状态：未展开" % [fallback_name, owner_name]
	if not runtime.is_empty():
		var load: float = float(runtime.get("load", 0.0))
		var threshold: float = float(runtime.get("threshold", 58.0))
		var status: String = "展开中" if bool(runtime.get("active", false)) else _domain_end_label(str(runtime.get("end_reason", "")))
		if bool(runtime.get("clash_weakened", false)):
			status += " · 领域对抗弱化"
		return "领域：%s\n持有人：%s\n状态：%s\n负荷：%d/%d" % [str(record.get("name", "领域")), owner_name, status, roundi(load), roundi(threshold)]
	var barrier: Dictionary = record.get("barrier", {})
	var barrier_type: String = str(barrier.get("type", ""))
	var shape: String = "开放领域" if barrier_type.contains("open") else "封闭领域" if barrier_type.contains("closed") else "规则领域"
	var completion: String = str(barrier.get("completion", ""))
	var state: String = "完整" if completion == "complete" else "条件成立" if completion == "conditional" else "展开中"
	return "领域：%s\n持有人：%s\n状态：%s · %s" % [str(record.get("name", "领域")), owner_name, shape, state]

func _domain_end_label(reason: String) -> String:
	match reason:
		"domainMeltdown": return "领域崩解"
		"domainManuallyEnded": return "主动解除领域"
		"domainResponseDisrupted": return "领域对抗破坏"
		_: return "未展开"

func _refresh_domain_panels_from_state() -> void:
	var actors: Array = _session.get_state_snapshot().get("actors", []) as Array
	if actors.size() < 2: return
	# Domain panels are local-view slots, just like status bars.  Canonical room
	# order is [host, guest], so the guest must project actor 1 to the left slot.
	var player: Dictionary = _local_actor(actors)
	var opponent: Dictionary = _opponent_actor(actors)
	var player_runtime: Dictionary = player.get("domain_state", {}) as Dictionary
	var opponent_runtime: Dictionary = opponent.get("domain_state", {}) as Dictionary
	var player_active: bool = bool(player_runtime.get("active", false))
	var opponent_active: bool = bool(opponent_runtime.get("active", false))
	if not player_active and not opponent_active:
		_left_domain_panel.visible = false
		_right_domain_panel.visible = false
		_domain_panels_activated = false
		return
	var was_active: Array[bool] = _rendered_domain_active.duplicate()
	_left_domain_text.text = _format_domain_text(player, {})
	_right_domain_text.text = _format_domain_text(opponent, {})
	_left_domain_panel.visible = player_active
	_right_domain_panel.visible = opponent_active
	_domain_panels_activated = player_active or opponent_active
	if player_active and not was_active[0]: _play_domain_impact(_left_domain_panel, -1.0)
	if opponent_active and not was_active[1]: _play_domain_impact(_right_domain_panel, 1.0)
	_rendered_domain_active = [player_active, opponent_active]

## 领域展开必须有明确的上场冲击：横向撞入、反冲、倾斜复位与金色闪光。
## 完全运行时生成，不触及用户排好的 DomainArea 节点坐标和层级。
func _play_domain_impact(panel: TextureRect, direction: float) -> void:
	if panel == null: return
	var home: Vector2 = panel.position
	panel.pivot_offset = panel.size * 0.5
	panel.position = home + Vector2(150.0 * direction, 0.0)
	panel.rotation = 0.13 * direction
	panel.scale = Vector2(1.32, 0.72)
	panel.modulate = Color(1.45, 1.15, 0.55, 0.0)
	var impact: Tween = create_tween().set_parallel(true)
	impact.tween_property(panel, "position", home - Vector2(22.0 * direction, 0.0), 0.16).set_trans(Tween.TRANS_EXPO).set_ease(Tween.EASE_OUT)
	impact.tween_property(panel, "rotation", -0.055 * direction, 0.16).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	impact.tween_property(panel, "scale", Vector2(1.08, 1.08), 0.16).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	impact.tween_property(panel, "modulate:a", 1.0, 0.07)
	impact.chain().tween_property(panel, "position", home, 0.22).set_trans(Tween.TRANS_ELASTIC).set_ease(Tween.EASE_OUT)
	impact.parallel().tween_property(panel, "rotation", 0.0, 0.22).set_trans(Tween.TRANS_ELASTIC).set_ease(Tween.EASE_OUT)
	impact.parallel().tween_property(panel, "scale", Vector2.ONE, 0.22).set_trans(Tween.TRANS_ELASTIC).set_ease(Tween.EASE_OUT)
	impact.parallel().tween_property(panel, "modulate", Color.WHITE, 0.22)

func domain_impact_ready_for_acceptance() -> bool:
	return _left_domain_panel != null and _right_domain_panel != null

func _play_new_domain_expansion_sounds() -> void:
	var actors: Array = _session.get_state_snapshot().get("actors", []) as Array
	if actors.size() < 2:
		return
	var current: Array[bool] = _active_domain_flags(actors)
	var newly_active: int = 0
	for index: int in current.size():
		if current[index] and not _last_domain_active[index]:
			newly_active += 1
	_last_domain_active = current
	if newly_active > 0:
		# 同一状态提交中双方展开时一次取样两个不同路径，并行播放。
		_audio_call(&"play_domain_expansions", [newly_active])

## 音频是可选 Autoload：战斗规则、无头验收与 UI 命中测试不应依赖音频节点存在。
func _audio_call(method: StringName, arguments: Array = []) -> void:
	var audio_manager: Node = get_node_or_null("/root/AudioManager")
	if audio_manager != null and audio_manager.has_method(method):
		audio_manager.callv(method, arguments)

func _active_domain_flags(actors: Array) -> Array[bool]:
	var flags: Array[bool] = []
	for actor: Dictionary in [_local_actor(actors), _opponent_actor(actors)]:
		flags.append(bool((actor.get("domain_state", {}) as Dictionary).get("active", false)))
	return flags

func _find_domain_record(domain_id: String, owner_id: String) -> Dictionary:
	var domains: Array = _data.load_json("domains.json").get("domains", [])
	for domain: Dictionary in domains:
		if str(domain.get("id", "")) == domain_id: return domain
	for domain: Dictionary in domains:
		if str(domain.get("ownerId", "")) == owner_id: return domain
	return {}

func _play_hit_effect(card_name: String) -> void:
	_hit_effect_triggered = true
	_hit_effect.visible = true
	_hit_effect.pivot_offset = _hit_effect.size * 0.5
	_hit_effect.scale = Vector2(0.2, 0.2)
	_hit_effect.modulate.a = 0.0
	(_hit_effect.get_node("HitText") as Label).text = "%s · 冲击" % card_name
	var tween: Tween = create_tween()
	tween.set_parallel(true)
	tween.tween_property(_hit_effect, "scale", Vector2(1.18, 1.18), 0.12).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	tween.tween_property(_hit_effect, "modulate:a", 1.0, 0.08)
	tween.chain().tween_property(_hit_effect, "scale", Vector2(0.72, 0.72), 0.24).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_IN)
	tween.parallel().tween_property(_hit_effect, "modulate:a", 0.0, 0.24)
	tween.finished.connect(func() -> void: _hit_effect.visible = false)

func _history_drop_rect() -> Rect2:
	return _history_button.get_global_rect().grow(48.0)

## 弃牌与 History 结算分属两个区域；弃牌只能在提示区完成，点击牌面不提交规则命令。
func _discard_drop_rect() -> Rect2:
	return _discard_overlay.get_global_rect().grow(12.0)

func _hand_drop_rect() -> Rect2:
	return Rect2(250.0, 620.0, 1200.0, 280.0)

func _set_action_controls_enabled(enabled: bool) -> void:
	var available: bool = enabled and _session.get_phase() in [&"DISCARD", &"PLAY"]
	for button: BaseButton in [_basic_button, _domain_button, _technique_button]:
		button.disabled = not available
	_history_button.disabled = not (enabled and _session.get_phase() == &"PLAY")
	_history_button.tooltip_text = "结算所选手牌；未选牌时待机"

func _apply_discard_visuals() -> void:
	for card: TextureButton in _hand_cards:
		if not is_instance_valid(card): continue
		card.set_meta("discard_locked", _discard_phase)
		card.modulate = Color(0.58, 0.58, 0.58, 1.0) if _discard_phase else Color.WHITE
	_set_action_controls_enabled(true)

func _on_resources_changed(actor_index: int, actor: Dictionary) -> void:
	var actors: Array = _session.get_state_snapshot().get("actors", []) as Array
	if actors.size() >= 2: _update_statuses(actors)
	_refresh_domain_panels_from_state()
	_opponent_count.text = "对手手牌 %d" % _opponent_normal_hand().size()

func _update_statuses(actors: Array) -> void:
	var root: Node = get_parent()
	if not root.has_method("set_battle_status") or actors.size() < 2: return
	# FightIntro's first status bar is the local player, not room actor 0.
	# In a guest tab the local player is actor 1, so passing [0, 1] leaks the
	# host's counters/statuses into the guest's main panel.
	root.call("set_battle_status", _local_actor(actors), _opponent_actor(actors))

func _append_log(entry: String) -> void:
	# RichTextLabel 文本无限增长会让长局拖拽、滚动和重排逐回合变慢；回合详情由 RoundHistory 保留。
	const MAX_BATTLE_LOG_LINES: int = 120
	var lines: PackedStringArray = _battle_log.text.split("\n")
	lines.append(entry)
	if lines.size() > MAX_BATTLE_LOG_LINES:
		lines = lines.slice(lines.size() - MAX_BATTLE_LOG_LINES)
	_battle_log.text = "\n".join(lines)

func _on_battle_error(message: String) -> void:
	_append_log("[color=#ff9090]行动失败：%s[/color]" % message)

# Automated acceptance entry points use the same public flow as the UI.
func get_hand_mode_for_acceptance() -> String:
	return str(_current_mode)

func is_hand_open_for_acceptance() -> bool:
	return _hand_open

func toggle_hand_for_acceptance(mode: String) -> void:
	_request_hand_mode(StringName(mode))

func visible_card_count_for_acceptance() -> int:
	return _hand_cards.size()

func selected_card_count_for_acceptance() -> int:
	return _selected_cards.size()

func queued_hand_action_for_acceptance() -> String:
	if _queued_close_requested: return "close"
	if not _queued_mode.is_empty(): return "open"
	return "none"

func select_first_card_for_acceptance() -> void:
	if _session.get_phase() == &"OPENING_STRATEGY": _flow.confirm_strategy(&"default")
	if _session.get_phase() == &"DEAL": _flow.continue_round()
	if _session.get_phase() == &"INITIATIVE": _flow.confirm_initiative("Option01")
	_current_mode = &"normal"
	_sync_flow()
	if _phase == HandPhase.OPEN: _refresh_open_hand()
	if _phase == HandPhase.OPENING: _finish_open()
	if not _hand_cards.is_empty() and _phase != HandPhase.OPEN:
		_phase = HandPhase.OPEN
		_hand_open = true
	for card: TextureButton in _hand_cards:
		if not card.disabled:
			if _discard_phase:
				_selected_cards.append(card)
				return
			_on_card_selected(card)
			return

func prepare_initial_hand_for_acceptance() -> void:
	if _session.get_phase() == &"OPENING_STRATEGY": _flow.confirm_strategy(&"default")
	_sync_flow()
	if _phase == HandPhase.OPENING: _finish_open()

func prepare_play_hand_for_acceptance() -> void:
	prepare_initial_hand_for_acceptance()
	if _session.get_phase() == &"DISCARD": discard_two_for_acceptance()
	if _session.get_phase() == &"INITIATIVE": _flow.confirm_initiative("Option01")
	_current_mode = &"normal"
	_sync_flow()
	if _phase == HandPhase.OPENING: _finish_open()

func discard_selected_for_acceptance() -> void:
	if not _selected_cards.is_empty(): _discard_card(_selected_cards[0])

func discard_two_for_acceptance() -> void:
	# 验收入口同样通过编排器，避免测试绕过页面正式命令链。
	if _session.get_phase() == &"OPENING_STRATEGY":
		_flow.confirm_strategy(&"default")
	var snapshot: Dictionary = _session.get_state_snapshot()
	var actors: Array = snapshot.get("actors", []) as Array
	var local_side: int = _online_local_side if _online_input_battle else 0
	var local_actor: Dictionary = _dictionary(actors[local_side]) if local_side >= 0 and actors.size() > local_side else {}
	var remaining: Array = _array(_dictionary(local_actor.get("zones", {})).get("hand", []))
	var ids: Array[String] = []
	for index: int in mini(2, remaining.size()):
		ids.append(str((remaining[index] as Dictionary).get("instance_id", "")))
	if _session.get_phase() == &"DISCARD" and ids.size() == BattleFlowSession.DISCARD_COUNT:
		_flow.submit_discard(ids)
	if _session.get_phase() == &"INITIATIVE":
		_flow.confirm_initiative("Option01")
	_sync_flow()
	if _session.get_phase() == &"PLAY":
		_current_mode = &"combined"
		if _phase == HandPhase.CLOSED: _begin_open()
		elif _phase == HandPhase.OPEN: _refresh_open_hand()
		_set_action_controls_enabled(true)
	call_deferred("_set_acceptance_controls_ready")

func _set_acceptance_controls_ready() -> void:
	if _session != null and _session.get_phase() == &"PLAY":
		_set_action_controls_enabled(true)

func resolve_selected_for_acceptance() -> void:
	_resolve_history()

func opponent_response_count_for_acceptance() -> int:
	return _opponent_response_cards.size()

func domain_panels_activated_for_acceptance() -> bool:
	return _domain_panels_activated

func format_domain_state_for_acceptance(actor: Dictionary) -> String:
	return _format_domain_text(actor, {})

func hit_effect_triggered_for_acceptance() -> bool:
	return _hit_effect_triggered

func play_first_card_for_acceptance() -> bool:
	var cards: Array = _session.get_state_snapshot().get("normal_hand", []) as Array
	for card: Dictionary in cards:
		if bool(_session.submit_card(0, card).get("ok", false)): return true
	return false

func hand_category_counts_for_acceptance() -> Dictionary:
	var normal_hand: Array = _session.get_state_snapshot().get("normal_hand", []) as Array
	return {
		"basic": (_cards_by_mode.get(&"normal", []) as Array).size(),
		"technique": (_cards_by_mode.get(&"technique", []) as Array).size(),
		"domain": (_cards_by_mode.get(&"domain", []) as Array).size(),
		"normal_total": normal_hand.size()
	}

func initial_deal_started_offscreen_for_acceptance() -> bool:
	return _initial_deal_started_offscreen

func normal_card_source_diagnostic_for_acceptance() -> Dictionary:
	var normal_hand: Array = _session.get_state_snapshot().get("normal_hand", []) as Array
	var pool: Dictionary = _session.get_state_snapshot().get("normal_card_pool_diagnostic", {}) as Dictionary
	if pool.is_empty():
		var actor: Dictionary = _local_actor(_session.get_state_snapshot().get("actors", []) as Array)
		var hand: Array = (actor.get("zones", {}) as Dictionary).get("hand", []) as Array
		var eligible := 0
		for card: Dictionary in hand:
			if _is_plain_basic_card(card): eligible += 1
		pool = {"eligible_basic_count":eligible, "availability":"available" if eligible > 0 else "unavailable", "template_boundary":"public_template_materialized" if eligible > 0 else "unknown"}
	var plain_ids: Array[String] = []
	for card: Dictionary in normal_hand:
		if _is_plain_basic_card(card): plain_ids.append(str(card.get("id", "")))
	var result: Dictionary = {
		"has_plain_basic": not plain_ids.is_empty(),
		"dealt_plain_basic": not plain_ids.is_empty(),
		"plain_basic_ids": plain_ids,
		"normal_hand_ids": normal_hand.map(func(card: Dictionary) -> String: return str(card.get("id", ""))),
		"eligible_basic_count": int(pool.get("eligible_basic_count", 0)),
		"availability": str(pool.get("availability", "unknown")),
		"template_boundary": str(pool.get("template_boundary", "unknown"))
	}
	print_verbose("普通牌数据源诊断：%s" % JSON.stringify(result))
	return result

func _is_plain_basic_card(card: Dictionary) -> bool:
	if _card_view_models.classify(card, _player_profile()) != &"basic": return false
	var tags: Array = card.get("tags", []) as Array
	for raw_tag: Variant in tags:
		var tag: String = str(raw_tag).to_lower()
		if tag in ["术式", "technique", "特色手札", "特殊手札", "feature_hand", "special_hand"]: return false
	return true

## 所有流程面板由此处投影，动画尚未结束时等待完成回调再次同步。
func _sync_flow() -> void:
	var strategy: Control = get_node("../StrategySelectionPreview")
	strategy.visible = _session.get_phase() == &"OPENING_STRATEGY"
	strategy.z_index = 100
	if strategy.visible: strategy.move_to_front()
	if _session.get_phase() == &"INITIATIVE" and _phase != HandPhase.RESOLVING:
		if not is_instance_valid(_flow_panel):
			_flow_panel = INITIATIVE_SCENE.instantiate()
			_flow_panel.name = "InitiativePanel"
			_flow_panel.set("embedded", true)
			_flow_panel.z_index = 100
			get_parent().add_child(_flow_panel)
			_flow_panel.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
			_flow_panel.contest_confirmed.connect(_confirm_initiative)
		_flow_panel.visible = true
	_set_action_controls_enabled(_phase in [HandPhase.OPEN, HandPhase.CLOSED])

func _confirm_strategy(strategy_name: String) -> void:
	if _session.get_phase() != &"OPENING_STRATEGY": return
	var result: Dictionary = _flow.confirm_strategy(StringName(strategy_name))
	if not result.ok:
		_append_log(str(result.error))
		return
	if bool(result.get("waiting", false)):
		_append_log("策略已提交，等待对方确认…")
		return
	_sync_flow()

func _confirm_initiative(option_name: String) -> void:
	if _session.get_phase() != &"INITIATIVE": return
	var result: Dictionary = _flow.confirm_initiative(option_name)
	if not result.ok:
		_append_log("投入失败：" + str(result.error))
		_flow_panel.set("_confirmed", false)
		return
	if bool(result.get("waiting", false)):
		_append_log("先手投入已提交，等待对方确认…")
		return
	_flow_panel.queue_free()
	_flow_panel = null
	_current_mode = &"combined"
	if _phase == HandPhase.OPEN: _refresh_open_hand(true)
	elif _phase == HandPhase.CLOSED: _begin_open()
	_sync_flow()

func _continue_round(keep_summary: bool = false) -> void:
	if _session.get_phase() == &"FINISHED":
		if _is_story_battle():
			_finish_story_battle(str(_session.get_winner()))
			return
		UI.navigate(self, "res://scenes/roster/roster_picker.tscn")
		return
	if not keep_summary: _round_summary_panel.visible = false
	var result: Dictionary = _flow.continue_round()
	if not result.ok: _append_log("发牌失败：" + str(result.error))
	_sync_flow()

func _validate_selection(cards: Array[Dictionary]) -> Dictionary:
	var ids: Array = []
	var domains: Array = []
	for card: Dictionary in cards:
		var zone := str(card.get("zone", "")).to_lower()
		var category := str(card.get("category", card.get("type", ""))).to_lower()
		if zone == "domain" or category in ["domain", "domain_card", "领域", "领域牌"]: domains.append(card.get("instance_id", ""))
		else: ids.append(card.get("instance_id", ""))
	return _session.validate_play({"actor_index":_online_local_side if _online_input_battle else 0, "card_instance_ids":ids, "domain_instance_ids":domains})

func _clear_hand_nodes() -> void:
	for card: TextureButton in _hand_cards + _table_cards:
		if is_instance_valid(card): card.queue_free()
	_hand_cards.clear()
	_selected_cards.clear()
	_table_cards.clear()

func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("ui_cancel"):
		if _is_story_battle(): _finish_story_battle("retreat")
		else: UI.navigate(self, "res://scenes/roster/roster_picker.tscn")
		get_viewport().set_input_as_handled()

func _is_story_battle() -> bool:
	var state: Node = get_node_or_null("/root/StoryState")
	if state == null: return false
	var node_id := str(state.get("current_node"))
	var definition: Dictionary = state.call("node_definition", node_id) as Dictionary if state.has_method("node_definition") else {}
	return str(definition.get("type", "")) == "battle" or node_id in ["chapter1_battle", "chapter1_danger"]

func _story_opponent_title(definition: Dictionary, node_id: String) -> String:
	if node_id == "chapter1_danger": return "河岸深层残秽"
	if node_id == "chapter1_battle": return "河岸低级咒灵"
	var profile := str(definition.get("battleProfile", ""))
	return {"sukuna":"宿傩", "dagon_jogo":"陀艮与漏瑚", "choso":"胀相", "hanami_jogo":"花御与漏瑚", "mahito":"真人", "kenjaku_choso":"羂索与胀相", "smallpox":"疱疮神", "haruta":"春太"}.get(profile, str(definition.get("title", "核心敌人")).replace("核心战斗·", ""))

func _finish_story_battle(outcome: String) -> void:
	var story: Node = get_node_or_null("/root/StoryState")
	if story == null: return
	var node_id := str(story.get("current_node"))
	var node_definition: Dictionary = story.call("node_definition", node_id) as Dictionary if story.has_method("node_definition") else {}
	var snapshot: Dictionary = _session.get_state_snapshot()
	var actors: Array = snapshot.get("actors", []) as Array
	var actor: Dictionary = _dictionary(actors[0]) if not actors.is_empty() else {}
	var hp_ratio := clampf(float(actor.get("hp", 0.0)) / maxf(float(actor.get("max_hp", 1.0)), 1.0), 0.0, 1.0)
	var ce_ratio := clampf(float(actor.get("ce", 0.0)) / maxf(float(actor.get("max_ce", 1.0)), 1.0), 0.0, 1.0)
	var rule_outcome := "victory" if outcome == "left" else ("retreat" if outcome == "retreat" else "defeat")
	var result_rules: Dictionary = story.call("battle_result_rules", node_id, rule_outcome, hp_ratio, ce_ratio) as Dictionary if story.has_method("battle_result_rules") else {}
	var resource_delta: Dictionary = result_rules.get("resources", {}) as Dictionary
	var growth_delta: Dictionary = result_rules.get("growth", {}) as Dictionary
	var story_flags: Dictionary = {}
	var player_defeated := rule_outcome == "defeat" and hp_ratio <= 0.0
	if player_defeated:
		story_flags["protagonist_dead"] = true
		story_flags["run_terminal"] = true
	var is_danger := node_id == "chapter1_danger"
	var is_core_battle := node_id.begins_with("core_battle_")
	var opponent := _story_opponent_title(node_definition, node_id)
	var text := ("你击溃了%s，战场暂时恢复了呼吸。" % opponent if is_core_battle else ("你击溃了河岸深层残秽，救下了被卷入结界的人。" if is_danger else "你击溃了河岸的低级咒灵，第一次确认这具身体能够真正战斗。")) if outcome == "left" else (("你从%s的包围中撤离，代价会在下一节点显现。" % opponent if is_core_battle else ("你从深层残秽的包围中撤离，护符和目击者都留在了黑暗里。" if is_danger else "你付出代价撤离河岸，异常仍在黑暗里徘徊。")) if outcome == "retreat" else ("你被%s逼退，但记住了它的攻击节奏。" % opponent if is_core_battle else ("你被深层残秽逼退，但记住了它会针对你的咒力节奏。" if is_danger else "你被迫退出战斗，但活着记住了咒灵的攻击方式。")))
	var relationship_delta: Dictionary = {}
	var npc_flags: Dictionary = {}
	var companion_state: Dictionary = story.call("npc_state", "junior_sorcerer") as Dictionary if story.has_method("npc_state") else {}
	if bool(companion_state.get("companion", false)):
		relationship_delta["junior_sorcerer"] = {"affection": 10 if outcome == "left" else -2, "trust": 1 if outcome == "left" else -1, "respect": 1 if outcome == "left" else 0}
		npc_flags["junior_sorcerer"] = {"junior_battle_completed": true, "junior_protected": outcome == "left"}
	var title := str(node_definition.get("title", "河岸战斗"))
	var next_node := str(node_definition.get("next", "chapter1_end"))
	story.call("resolve_local", node_id, title, text, resource_delta, growth_delta, next_node, "battle", relationship_delta, npc_flags, story_flags)
	UI.navigate(self, "res://scenes/story/settlement.tscn")

func _dictionary(value: Variant) -> Dictionary:
	return (value as Dictionary).duplicate(true) if value is Dictionary else {}

func _array(value: Variant) -> Array:
	return (value as Array).duplicate(true) if value is Array else []
