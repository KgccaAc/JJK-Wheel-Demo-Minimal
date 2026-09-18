class_name AppEventBus
extends Node

signal event_emitted(name: StringName, payload: Dictionary)

func publish(name: StringName, payload: Dictionary = {}) -> void:
	if name.is_empty(): return
	event_emitted.emit(name, payload.duplicate(true))

func subscribe(callback: Callable) -> void:
	if callback.is_valid() and not event_emitted.is_connected(callback): event_emitted.connect(callback)

func unsubscribe(callback: Callable) -> void:
	if callback.is_valid() and event_emitted.is_connected(callback): event_emitted.disconnect(callback)

