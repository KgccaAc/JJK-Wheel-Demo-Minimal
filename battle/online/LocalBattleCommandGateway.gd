extends RefCounted

## 本地单机的“服务器”适配器。
## 它只调用 BattleFlowSession 的公开命令，因此以后接入真实服务时，Presenter 可替换为远程
## 网关而无需再复制一份战斗规则。每个 request_id 会缓存一次响应，网络重试不会重复扣血、
## 弃牌或结算；revision/state_hash 则阻止旧界面覆盖新权威状态。

const ProtocolScript: Script = preload("res://battle/online/OnlineBattleProtocol.gd")

signal connection_changed(status: StringName)
signal authoritative_update_received(update: Dictionary)
signal command_rejected(error: String, command: Dictionary)

var _session: RefCounted
var _room_id: String = ""
var _players_by_id: Dictionary = {}
var _room_players: Array[Dictionary] = []
var _last_sequence_by_player: Dictionary = {}
var _response_by_request_id: Dictionary = {}

func configure(session: RefCounted, room_id: String, players: Array) -> Dictionary:
	if session == null or room_id.is_empty(): return {"ok": false, "error": "room_configuration_required"}
	if players.size() != 2: return {"ok": false, "error": "two_players_required"}
	_session = session
	_room_id = room_id
	_players_by_id.clear()
	_room_players.clear()
	_last_sequence_by_player.clear()
	_response_by_request_id.clear()
	for raw: Variant in players:
		if not raw is Dictionary: return {"ok": false, "error": "invalid_player_descriptor"}
		var player: Dictionary = raw as Dictionary
		var player_id: String = str(player.get("player_id", ""))
		var side: int = int(player.get("side", -1))
		if player_id.is_empty() or side not in [0, 1] or _players_by_id.has(player_id): return {"ok": false, "error": "invalid_player_descriptor"}
		var actor: Dictionary = _session.get_state_snapshot().get("actors", [])[side] as Dictionary
		# 角色快照哈希只属于该玩家，绝不抬到 room 根节点。
		var descriptor: Dictionary = {
			"player_id": player_id, "side": side, "connected": true,
			"character_id": str(actor.get("profile", {}).get("id", "")),
			"character_snapshot_hash": str(actor.get("profile", {}).get("snapshot_hash", "")),
		}
		_players_by_id[player_id] = descriptor
		_room_players.append(descriptor)
		_last_sequence_by_player[player_id] = 0
	connection_changed.emit(&"connected")
	return {"ok": true, "update": _build_update()}

func room_descriptor() -> Dictionary:
	return {"protocol_version": String(ProtocolScript.VERSION), "room_id": _room_id, "players": _room_players.duplicate(true)}

func submit(player_id: String, command: Dictionary) -> Dictionary:
	if _session == null: return _reject("battle_not_configured", command)
	var protocol: Dictionary = ProtocolScript.validate_command(command)
	if not bool(protocol.get("ok", false)): return _reject(str(protocol.get("error", "invalid_command")), command)
	if str(command.room_id) != _room_id: return _reject("room_mismatch", command)
	if not _players_by_id.has(player_id): return _reject("unknown_player", command)
	if _response_by_request_id.has(str(command.request_id)):
		return (_response_by_request_id[str(command.request_id)] as Dictionary).duplicate(true)
	var last_sequence: int = int(_last_sequence_by_player.get(player_id, 0))
	if int(command.client_sequence) <= last_sequence: return _reject("duplicate_or_out_of_order_command", command)
	var current: Dictionary = _session.get_state_snapshot()
	if int(command.expected_revision) != int(current.get("revision", -1)) or str(command.expected_state_hash) != str(current.get("state_hash", "")):
		return _reject("stale_authoritative_state", command)
	var side: int = int((_players_by_id[player_id] as Dictionary).side)
	var result: Dictionary = _apply_command(side, str(command.command_type), command.payload as Dictionary)
	_last_sequence_by_player[player_id] = int(command.client_sequence)
	var response: Dictionary = _response(result)
	_response_by_request_id[str(command.request_id)] = response.duplicate(true)
	if bool(response.get("ok", false)): authoritative_update_received.emit(response.update)
	else: command_rejected.emit(str(response.get("error", "rejected")), command.duplicate(true))
	return response

func request_resync(player_id: String, _last_revision: int) -> Dictionary:
	if _session == null: return {"ok": false, "error": "battle_not_configured"}
	if not _players_by_id.has(player_id): return {"ok": false, "error": "unknown_player"}
	var response: Dictionary = {"ok": true, "update": _build_update()}
	authoritative_update_received.emit(response.update)
	return response

func disconnect_player(player_id: String) -> Dictionary:
	if not _players_by_id.has(player_id): return {"ok": false, "error": "unknown_player"}
	var player: Dictionary = _players_by_id[player_id] as Dictionary
	player["connected"] = false
	_players_by_id[player_id] = player
	for index: int in _room_players.size():
		if str(_room_players[index].player_id) == player_id: _room_players[index] = player.duplicate(true)
	connection_changed.emit(&"disconnected")
	return {"ok": true}

func _apply_command(side: int, command_type: String, payload: Dictionary) -> Dictionary:
	var revision: int = int(_session.get_state_snapshot().get("revision", 0))
	match command_type:
		"choose_strategy":
			var chosen: Dictionary = _session.choose_strategy(side, StringName(str(payload.get("strategy_id", ""))), revision)
			if not bool(chosen.get("ok", false)): return chosen
			if _both_strategies_selected():
				var confirmed: Dictionary = _session.confirm_strategies(int(_session.get_state_snapshot().get("revision", 0)))
				if not bool(confirmed.get("ok", false)): return confirmed
				return _session.deal_round(int(_session.get_state_snapshot().get("revision", 0)))
			return chosen
		"discard_cards":
			return _session.discard_cards(side, payload.get("instance_ids", []) as Array, revision)
		"submit_initiative":
			return _session.submit_initiative(side, int(payload.get("commitment", payload.get("hp_amount", 0))), revision)
		"submit_play":
			var submitted: Dictionary = _session.submit_play(side, payload.get("card_instance_ids", []) as Array, payload.get("domain_instance_ids", []) as Array, revision)
			if not bool(submitted.get("ok", false)): return submitted
			if str(_session.get_phase()) == "RESOLVE": return _session.resolve_round(int(_session.get_state_snapshot().get("revision", 0)))
			return submitted
		"continue_round":
			return _session.deal_round(revision)
		_:
			return {"ok": false, "error": "unsupported_command_type"}

func _both_strategies_selected() -> bool:
	var snapshot: Dictionary = _session.get_state_snapshot()
	var strategies: Array = snapshot.get("strategy_snapshot", []) as Array
	return strategies.size() == 2 and strategies.all(func(strategy: Variant) -> bool: return strategy is Dictionary and not (strategy as Dictionary).is_empty())

func _build_update() -> Dictionary:
	return ProtocolScript.build_update(_room_id, _session.get_state_snapshot(), _session.get_round_package())

func _response(result: Dictionary) -> Dictionary:
	if not bool(result.get("ok", false)): return {"ok": false, "error": str(result.get("error", "command_rejected")), "update": _build_update()}
	var update: Dictionary = _build_update()
	if result.has("round_package"): update["round_package"] = (result.round_package as Dictionary).duplicate(true)
	return {"ok": true, "update": update}

func _reject(error: String, command: Dictionary) -> Dictionary:
	command_rejected.emit(error, command.duplicate(true))
	return {"ok": false, "error": error, "update": _build_update() if _session != null else {}}

