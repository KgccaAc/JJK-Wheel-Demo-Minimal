class_name ReconnectController
extends RefCounted

signal resync_required(reason: String)
signal connection_state_changed(state: StringName)

enum State { ONLINE, DISCONNECTED, RECONNECTING, FAILED }
var state: State = State.ONLINE
var max_attempts: int = 5
var attempts: int = 0

func on_transport_lost() -> void:
	state = State.DISCONNECTED
	connection_state_changed.emit(&"disconnected")

func begin_reconnect() -> bool:
	if attempts >= max_attempts:
		state = State.FAILED
		connection_state_changed.emit(&"failed")
		return false
	attempts += 1
	state = State.RECONNECTING
	connection_state_changed.emit(&"reconnecting")
	return true

func on_resync_response(ok: bool) -> void:
	if ok:
		attempts = 0
		state = State.ONLINE
		connection_state_changed.emit(&"online")
	else:
		resync_required.emit("stale_battle_revision")

func reset() -> void:
	attempts = 0
	state = State.ONLINE
