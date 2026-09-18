class_name PageRouterService
extends Node

signal route_changed(route: String, params: Dictionary)
signal navigation_failed(route: String, reason: String)

var _stack: Array[Dictionary] = []
var _current: Dictionary = {}

func navigate(scene_path: String, params: Dictionary = {}, replace: bool = false) -> bool:
	if scene_path.is_empty() or not ResourceLoader.exists(scene_path):
		navigation_failed.emit(scene_path, "scene_not_found")
		if has_node("/root/ErrorService"): get_node("/root/ErrorService").report("SCENE_NOT_FOUND", "SCENE", scene_path, "页面资源不存在", {"scene": scene_path})
		return false
	var current_node: Node = get_tree().current_scene
	if current_node != null and current_node.has_method("leave"): current_node.call("leave")
	if not replace and not _current.is_empty(): _stack.append(_current.duplicate(true))
	_current = {"route": scene_path, "params": params.duplicate(true)}
	var result := get_tree().change_scene_to_file(scene_path)
	if result != OK:
		navigation_failed.emit(scene_path, error_string(result))
		return false
	var next_page: Node = get_tree().current_scene
	if next_page != null and next_page.has_method("enter"):
		next_page.call_deferred("enter", params.duplicate(true))
	route_changed.emit(scene_path, params)
	return true

func go_back() -> bool:
	if _stack.is_empty(): return false
	var previous: Dictionary = _stack.pop_back()
	var route := str(previous.get("route", ""))
	return navigate(route, previous.get("params", {}) as Dictionary, true)

func current_route() -> Dictionary:
	return _current.duplicate(true)

func clear_history() -> void:
	_stack.clear()
