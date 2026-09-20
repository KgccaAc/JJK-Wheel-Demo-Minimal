class_name BattleCommandGateway
extends RefCounted

## UI 与网络之间的稳定边界。
##
## 线上实现需要保持同名方法、信号和返回格式，并把服务器返回的 update 原样交给 Presenter；
## 页面不能从 socket 或 HTTP 回调里改战斗数据。
##
## 注意：离线权威适配器 LocalBattleCommandGateway 已归档到 `_archive/legacy-online/`。
## 当前离线战斗不经过本契约，而由 `battle/ui/BattleFlowCoordinator.gd` 直接调用
## `BattleFlowSession`；本基类目前仅服务于联机侧的 RemoteBattleCommandGateway。

signal connection_changed(status: StringName)
signal authoritative_update_received(update: Dictionary)
signal command_rejected(error: String, command: Dictionary)

func configure(_session: RefCounted, _room_id: String, _players: Array) -> Dictionary:
	return {"ok": false, "error": "gateway_not_configured"}

func submit(_player_id: String, _command: Dictionary) -> Dictionary:
	return {"ok": false, "error": "gateway_not_configured"}

func request_resync(_player_id: String, _last_revision: int) -> Dictionary:
	return {"ok": false, "error": "gateway_not_configured"}

func disconnect_player(_player_id: String) -> Dictionary:
	return {"ok": false, "error": "gateway_not_configured"}

