class_name UiComponent
extends Control

var _active_tweens: Array[Tween] = []

func play_motion(property: NodePath, value: Variant, duration: float = 0.18) -> void:
	var tween := create_tween()
	_active_tweens.append(tween)
	tween.tween_property(self, property, value, duration)
	tween.finished.connect(func() -> void: _active_tweens.erase(tween))

func cancel_motion() -> void:
	for tween: Tween in _active_tweens:
		if is_instance_valid(tween): tween.kill()
	_active_tweens.clear()

func _exit_tree() -> void:
	cancel_motion()
