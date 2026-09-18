extends RefCounted

## 战斗页面的唯一流程编排层。
##
## 规则会话只负责校验和修改 BattleState；Presenter 只负责牌面与动画。
## 这里把策略、弃牌、先手和回合继续等跨控件命令串成一条可测试的链，
## 避免策略面板、先手面板和 FightPresenter 各自推进阶段。

const FlowSessionScript: Script = preload("res://battle/core/BattleFlowSession.gd")
const ROOM_GATEWAY_SCRIPT: Script = preload("res://battle/online/OnlineRoomGateway.gd")
const LOCAL_TRANSPORT_SCRIPT: Script = preload("res://battle/online/LocalHttpOnlineRoomTransport.gd")
const REMOTE_TRANSPORT_SCRIPT: Script = preload("res://battle/online/RemoteOnlineRoomTransport.gd")

signal phase_changed(previous_phase: StringName, current_phase: StringName)
signal command_completed(command: StringName, result: Dictionary)
signal command_failed(command: StringName, error: String)

var _session: RefCounted
var _phase: StringName = &"NONE"
var _last_command: StringName = &""
var _online_input_mode: bool = false
var _online_gateway: RefCounted
var _online_room_id: String = ""
var _online_player_id: String = ""
var _online_local_side: int = 0
var _online_battle_revision: int = 0
var _online_pending_stage: String = ""
var _online_discard_ids: Array[String] = []

func set_online_input_mode(enabled: bool) -> void:
	_online_input_mode = enabled

func configure_online_input(context: Dictionary) -> Dictionary:
	_online_input_mode = true
	_online_local_side = -1
	var room: Dictionary = _dictionary(context.get("room", {}))
	_online_room_id = str(room.get("room_id", ""))
	_online_player_id = str(context.get("local_player_id", ""))
	_online_battle_revision = 0
	var players: Array = room.get("players", []) as Array
	for index: int in players.size():
		if players[index] is Dictionary and str((players[index] as Dictionary).get("player_id", "")) == _online_player_id:
			_online_local_side = index
	if _online_room_id.is_empty() or _online_player_id.is_empty() or _online_local_side < 0:
		return {"ok":false, "error":"online_context_invalid"}
	_online_gateway = ROOM_GATEWAY_SCRIPT.new()
	if str(context.get("transport_kind", "remote")) == "remote":
		_online_gateway.call("set_transport", REMOTE_TRANSPORT_SCRIPT.new(str(context.get("endpoint", "https://119.91.224.223/preview-room-api")), _dictionary(context.get("identity", {})), true))
	else:
		_online_gateway.call("set_transport", LOCAL_TRANSPORT_SCRIPT.new(str(context.get("endpoint", "http://127.0.0.1:8787")), _online_player_id))
	return {"ok":true}

## 战斗初始投影也由服务端提供。这里不从房间快照本地发牌，避免客户端
## 和 Worker 在策略、随机数或私有手牌上各自产生一份初始状态。
func bootstrap_online_state() -> Dictionary:
	if not _online_input_mode or _online_gateway == null: return _failure_result(&"bootstrap_online_state", "online_v3_gateway_unconfigured")
	var result := _consume_authority_response(&"bootstrap_online_state", _online_request(&"getBattleBootstrap", {"room_id":_online_room_id}))
	if bool(result.get("ok", false)) and _online_gateway.has_method("connect_room_socket"):
		_online_gateway.call("connect_room_socket", _online_room_id)
	return result

func pump_online_socket() -> bool:
	if not _online_input_mode or _online_gateway == null: return false
	var changed := false
	for event: Dictionary in _online_gateway.call("pump_socket") as Array[Dictionary]:
		var event_type := str(event.get("type", ""))
		if event_type in ["stage_result", "round_result", "battle_bootstrap"]:
			_consume_authority_response(&"socket_%s" % event_type, {"ok":true, "type":event_type, "battle_revision":int(event.get("battleRevision", 0)), "visible_state":event.get("visible_state", {}), "projection":event.get("projection", {})})
			changed = true
	return changed

## 在线客户端只轮询服务端可见状态；它绝不补齐对手命令、重放 V3 或上传 receipt。
func poll_online_input() -> Dictionary:
	if not _online_input_mode or _online_pending_stage.is_empty(): return {"ok":true, "idle":true}
	var result: Dictionary = _online_request(&"resyncBattle", {"room_id":_online_room_id, "battle_revision":_online_battle_revision})
	if not bool(result.get("ok", false)): return _publish_failure(&"poll_online_input", result)
	return _consume_authority_response(&"poll_online_input", result)

func _submit_authority_stage(stage: String, data: Dictionary, command: StringName) -> Dictionary:
	if _online_gateway == null: return _failure_result(command, "online_v3_gateway_unconfigured")
	if not _online_pending_stage.is_empty(): return {"ok":true, "waiting":true, "phase":"waiting_for_peer_commit"}
	_online_pending_stage = stage
	var payload: Dictionary = {"room_id":_online_room_id, "battle_revision":_online_battle_revision, "stage":stage, "data":data.duplicate(true)}
	var result: Dictionary = _online_request(&"submitStageInput", payload)
	if not bool(result.get("ok", false)):
		_online_pending_stage = ""
		if _error_code(result) == "STALE_BATTLE_REVISION":
			var synced: Dictionary = _online_request(&"resyncBattle", {"room_id":_online_room_id, "battle_revision":_online_battle_revision})
			if bool(synced.get("ok", false)):
				_consume_authority_response(&"resync_after_stale", synced)
				result["resynced"] = true
		return _publish_failure(command, result)
	return _consume_authority_response(command, result)

func _error_code(response: Dictionary) -> String:
	var raw: Variant = response.get("error", "")
	if raw is Dictionary:
		return str((raw as Dictionary).get("code", "")).to_upper()
	return str(raw).to_upper()

func _online_request(operation: StringName, payload: Dictionary) -> Dictionary:
	return _dictionary(_online_gateway.call("request", operation, payload))

## Worker 响应中的 visible_state 是当前玩家已获授权的投影。在线端只恢复它，
## 不把 CardAvailability 预演或 UI 临时选择写成战斗结果。
func _consume_authority_response(command: StringName, response: Dictionary) -> Dictionary:
	var result: Dictionary = response.duplicate(true)
	var battle_revision: Variant = result.get("battle_revision", result.get("battleRevision", null))
	if battle_revision != null: _online_battle_revision = int(battle_revision)
	var visible_state: Dictionary = _dictionary(result.get("visible_state", result.get("battle_state", {})))
	if visible_state.is_empty():
		var data: Dictionary = _dictionary(result.get("data", {}))
		visible_state = _dictionary(data.get("visible_state", data.get("battle_state", {})))
		if battle_revision == null: _online_battle_revision = int(data.get("battleRevision", _online_battle_revision))
	if not visible_state.is_empty() and _session != null and _session.state != null:
		_session.apply_authority_snapshot(visible_state)
	# A successful first submission is not a completed stage. Keep its pending
	# marker until a resync returns the authority state after the peer commits;
	# otherwise the first player stops polling and remains on an obsolete hand.
	var waiting_for_peer: bool = str(result.get("peer_submission", "")) == "waiting" or str(result.get("type", "")) == "submission_accepted"
	if not waiting_for_peer:
		_online_pending_stage = ""
		_online_discard_ids.clear()
	return _publish_result(command, result)

func _dictionary(value: Variant) -> Dictionary:
	return (value as Dictionary).duplicate(true) if value is Dictionary else {}

func attach(session: RefCounted) -> void:
	_session = session
	sync_from_session()

func phase() -> StringName:
	return _phase

## 提供给 UI 与验收的只读诊断；不参与规则状态。
func last_command() -> StringName:
	return _last_command

## Read-only protocol diagnostics for acceptance tests and battle logs.
func online_diagnostics() -> Dictionary:
	return {"room_id":_online_room_id, "player_id":_online_player_id, "local_side":_online_local_side, "battle_revision":_online_battle_revision, "pending_stage":_online_pending_stage}

func sync_from_session() -> StringName:
	var next_phase: StringName = &"NONE"
	if _session != null and _session.has_method("get_phase"):
		next_phase = StringName(_session.get_phase())
	if next_phase != _phase:
		var previous: StringName = _phase
		_phase = next_phase
		phase_changed.emit(previous, _phase)
	return _phase

## 策略确认同时完成 CPU 策略、阶段确认和首轮发牌。
func confirm_strategy(strategy_id: StringName) -> Dictionary:
	if not _phase_is(&"OPENING_STRATEGY"):
		return _failure_result(&"confirm_strategy", "invalid_phase")
	var revision: int = int(_session.state.revision)
	if _online_input_mode:
		return _submit_authority_stage("strategy", {"id":String(strategy_id)}, &"confirm_strategy")
	var result: Dictionary = _session.choose_strategy(0, strategy_id, revision)
	if not result.ok: return _publish_failure(&"confirm_strategy", result)
	result = _session.choose_strategy(1, &"SteadyButton", _session.state.revision)
	if not result.ok: return _publish_failure(&"confirm_strategy", result)
	result = _session.confirm_strategies(_session.state.revision)
	if not result.ok: return _publish_failure(&"confirm_strategy", result)
	result = _session.deal_round(_session.state.revision)
	if not result.ok: return _publish_failure(&"confirm_strategy", result)
	return _publish_success(&"confirm_strategy", result)

## 以玩家选择的两个实例完成弃牌；规则会话负责 CPU 的对应弃牌。
func submit_discard(instance_ids: Array[String]) -> Dictionary:
	if not _phase_is(&"DISCARD"):
		return _failure_result(&"submit_discard", "invalid_phase")
	if instance_ids.size() != int(FlowSessionScript.DISCARD_COUNT):
		return _failure_result(&"submit_discard", "discard_count_required")
	var hand: Array = _session.state.actors[_online_local_side if _online_input_mode else 0].zones.hand
	var queued: Dictionary = {"ok":true, "waiting":true}
	for instance_id: String in instance_ids:
		var found: Dictionary = {}
		for card: Dictionary in hand:
			if str(card.get("instance_id", "")) == instance_id:
				found = card
				break
		if found.is_empty(): return _failure_result(&"submit_discard", "card_not_in_hand")
		queued = submit_discard_card(found)
		if not queued.ok: return _publish_failure(&"submit_discard", queued)
	return _publish_success(&"submit_discard", queued)

## 真实 UI 每次只点击一张牌，仍从此处提交，确保动画与规则使用同一命令链。
func submit_discard_card(card: Dictionary) -> Dictionary:
	if not _phase_is(&"DISCARD"):
		return _failure_result(&"submit_discard", "invalid_phase")
	if _online_input_mode:
		var instance_id: String = str(card.get("instance_id", ""))
		if instance_id.is_empty(): return _failure_result(&"submit_discard", "card_instance_required")
		if _online_discard_ids.has(instance_id): return _failure_result(&"submit_discard", "duplicate_instance_id")
		_online_discard_ids.append(instance_id)
		if _online_discard_ids.size() < int(FlowSessionScript.DISCARD_COUNT):
			return _publish_success(&"submit_discard", {"ok":true, "waiting":true, "remaining":int(FlowSessionScript.DISCARD_COUNT) - _online_discard_ids.size()})
		return _submit_authority_stage("discard", {"ids":_online_discard_ids.duplicate()}, &"submit_discard")
	return _publish_result(&"submit_discard", _session.discard_player_card(card))

## 提交玩家先手投入并用固定 seed 生成 CPU 投入，保证 UI 与规则一致。
func confirm_initiative(option_name: String) -> Dictionary:
	if not _phase_is(&"INITIATIVE"):
		return _failure_result(&"confirm_initiative", "invalid_phase")
	if _online_input_mode:
		var online_option_index: int = int(option_name.trim_prefix("Option")) - 1
		if online_option_index < 0 or online_option_index >= FlowSessionScript.INITIATIVE_BIDS.size(): return _failure_result(&"confirm_initiative", "invalid_initiative_option")
		return _submit_authority_stage("initiative", {"investment":int(FlowSessionScript.INITIATIVE_BIDS[online_option_index])}, &"confirm_initiative")
	var option_index: int = int(option_name.trim_prefix("Option")) - 1
	if option_index < 0 or option_index >= FlowSessionScript.INITIATIVE_BIDS.size():
		return _failure_result(&"confirm_initiative", "invalid_initiative_option")
	var bid: int = int(FlowSessionScript.INITIATIVE_BIDS[option_index])
	var result: Dictionary = _session.submit_initiative(0, bid, _session.state.revision)
	if not result.ok: return _publish_failure(&"confirm_initiative", result)
	var cpu_bid: int = int(FlowSessionScript.INITIATIVE_BIDS[absi(hash("%s:%s:cpu_bid" % [_session.state.seed, _session.state.round])) % 4])
	if cpu_bid >= float(_session.state.actors[1].hp): cpu_bid = 0
	result = _session.submit_initiative(1, cpu_bid, _session.state.revision)
	if not result.ok: return _publish_failure(&"confirm_initiative", result)
	return _publish_success(&"confirm_initiative", result)

func resolve_cards(cards: Array) -> Dictionary:
	if not _phase_is(&"PLAY"):
		return _failure_result(&"resolve_cards", "invalid_phase")
	if _online_input_mode:
		var ids: Array[String] = []
		var domains: Array[String] = []
		for card: Variant in cards:
			if not card is Dictionary: continue
			var data: Dictionary = card as Dictionary
			if str(data.get("zone", "")) == "domain": domains.append(str(data.get("instance_id", "")))
			else: ids.append(str(data.get("instance_id", "")))
		return _submit_authority_stage("play", {"cards":ids, "domain":domains[0] if not domains.is_empty() else ""}, &"resolve_cards")
	return _publish_result(&"resolve_cards", _session.resolve_selected_cards(cards))

func continue_round() -> Dictionary:
	if _session == null: return _failure_result(&"continue_round", "battle_not_started")
	sync_from_session()
	if _phase == &"FINISHED":
		return _publish_success(&"continue_round", {"ok":true, "finished":true})
	if _online_input_mode: return poll_online_input()
	if _phase != &"DEAL": return _failure_result(&"continue_round", "invalid_phase")
	return _publish_result(&"continue_round", _session.deal_round(_session.state.revision))

func _phase_is(expected: StringName) -> bool:
	sync_from_session()
	return _session != null and _phase == expected

func _publish_success(command: StringName, result: Dictionary) -> Dictionary:
	return _publish_result(command, result)

func _publish_result(command: StringName, result: Dictionary) -> Dictionary:
	_last_command = command
	sync_from_session()
	if bool(result.get("ok", false)):
		command_completed.emit(command, result)
	else:
		command_failed.emit(command, str(result.get("error", "unknown")))
	return result

func _publish_failure(command: StringName, result: Dictionary) -> Dictionary:
	return _publish_result(command, result)

func _failure_result(command: StringName, error: String) -> Dictionary:
	_last_command = command
	var result: Dictionary = {"ok":false, "error":error}
	command_failed.emit(command, error)
	return result





