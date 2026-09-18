class_name OnlineBattleProtocol
extends RefCounted

## 联机战斗的纯数据契约。
##
## 传输层（HTTP、WebSocket 或 ENet）只负责收发这些 Dictionary，不能直接修改战斗状态。
## 房间描述只保存成员身份；唯一可回放的规则状态位于 authoritative_snapshot，避免源项目
## 中 room/syncState/battleState 重复持有角色哈希、导致覆盖和不同步的问题。

const VERSION: StringName = &"online-battle-v1"

static func build_command(room_id: String, request_id: String, client_sequence: int, expected_revision: int, expected_state_hash: String, command_type: StringName, payload: Dictionary) -> Dictionary:
	return {
		"protocol_version": String(VERSION),
		"room_id": room_id,
		"request_id": request_id,
		"client_sequence": client_sequence,
		"expected_revision": expected_revision,
		"expected_state_hash": expected_state_hash,
		"command_type": String(command_type),
		"payload": payload.duplicate(true),
	}

static func validate_command(command: Dictionary) -> Dictionary:
	for required: String in ["protocol_version", "room_id", "request_id", "client_sequence", "expected_revision", "expected_state_hash", "command_type", "payload"]:
		if not command.has(required): return {"ok": false, "error": "command_field_missing", "field": required}
	if str(command.protocol_version) != String(VERSION): return {"ok": false, "error": "unsupported_protocol_version"}
	if str(command.room_id).is_empty() or str(command.request_id).is_empty(): return {"ok": false, "error": "command_identity_required"}
	if int(command.client_sequence) <= 0: return {"ok": false, "error": "invalid_client_sequence"}
	if int(command.expected_revision) < 0 or str(command.expected_state_hash).is_empty(): return {"ok": false, "error": "expected_state_required"}
	if not command.payload is Dictionary: return {"ok": false, "error": "invalid_command_payload"}
	return {"ok": true}

static func build_update(room_id: String, snapshot: Dictionary, round_package: Dictionary = {}) -> Dictionary:
	return {
		"protocol_version": String(VERSION),
		"room_id": room_id,
		"authoritative_revision": int(snapshot.get("revision", 0)),
		"authoritative_state_hash": str(snapshot.get("state_hash", "")),
		"authoritative_snapshot": snapshot.duplicate(true),
		"round_package": round_package.duplicate(true),
		"phase": str(snapshot.get("phase", "")),
		"terminal": bool(snapshot.get("finished", false)),
	}

