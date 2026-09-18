class_name AppPage
extends Control

var _active_tweens: Array[Tween] = []
var _page_params: Dictionary = {}

func enter(params: Dictionary = {}) -> void:
	_page_params = params.duplicate(true)

func leave() -> void:
	for tween: Tween in _active_tweens:
		if is_instance_valid(tween): tween.kill()
	_active_tweens.clear()

func on_back_requested() -> bool:
	return false

func track_tween(tween: Tween) -> Tween:
	if tween != null: _active_tweens.append(tween)
	return tween

