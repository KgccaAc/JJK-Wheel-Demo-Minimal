extends Node

const DiagnosticBundleScript: Script = preload("res://app/diagnostics/DiagnosticBundle.gd")

const LOG_DIR := "user://logs"
const ERROR_LOG := "user://logs/errors.jsonl"
const SENSITIVE_KEY := ["token", "secret", "password", "credential", "authorization", "cookie", "private_key", "privateKey"]
var _recent_actions: Array[Dictionary] = []

signal error_recorded(record: Dictionary)

func report_warning(code: String, category: String, message: String, context: Dictionary = {}) -> Dictionary:
	return report(code, category, message, message, context, {}, "warning")

## 统一的边界捕获入口。调用方在资源、场景、HTTP 或 Worker 边界使用这些方法，
## 让底层异常保持可分类、可落盘，并避免页面直接拼接异常字符串。
func report_scene_load_failure(scene_path: String, reason: String, context: Dictionary = {}) -> Dictionary:
	var data := context.duplicate(true)
	data["scene"] = scene_path
	data["operation"] = "load_scene"
	return report("SCENE_LOAD_FAILED", "SCENE", reason, "页面加载失败，请返回上一页重试。", data)

func report_resource_load_failure(resource_path: String, reason: String, context: Dictionary = {}) -> Dictionary:
	var data := context.duplicate(true)
	data["resource"] = resource_path
	data["operation"] = "load_resource"
	return report("RESOURCE_LOAD_FAILED", "DATA", reason, "资源加载失败，请重试。", data)

func report_http_failure(operation: String, status_code: int, reason: String, context: Dictionary = {}) -> Dictionary:
	var data := context.duplicate(true)
	data["operation"] = operation
	data["status_code"] = status_code
	return report("NETWORK_HTTP_FAILED", "NETWORK", reason, "网络请求失败，请检查连接后重试。", data)

func report_worker_error(code: String, reason: String, context: Dictionary = {}) -> Dictionary:
	var data := context.duplicate(true)
	data["operation"] = "worker"
	return report(code, "WORKER", reason, "联机服务暂时不可用，请稍后重试。", data)

func record_action(operation: String, payload: Dictionary = {}) -> void:
	_recent_actions.append({"timestamp": Time.get_datetime_string_from_system(true), "operation": operation, "payload": _sanitize(payload)})
	if _recent_actions.size() > 32: _recent_actions.pop_front()

func capture_runtime_error(code: String, category: String, message: String, context: Dictionary = {}, stack: String = "") -> Dictionary:
	var enriched := context.duplicate(true)
	if not enriched.has("recent_actions"): enriched["recent_actions"] = _recent_actions.duplicate(true)
	if not enriched.has("scene") and is_inside_tree(): enriched["scene"] = get_tree().current_scene.scene_file_path if get_tree().current_scene else ""
	if not stack.is_empty(): enriched["stack"] = stack
	return report(code, category, message, "操作失败，请查看错误编号并重试。", enriched)

func report(code: String, category: String, message: String, user_message: String = "", context: Dictionary = {}, details: Dictionary = {}, severity: String = "error") -> Dictionary:
	var record: Dictionary = {
		"schema": "jjk-error-v1",
		"error_id": _id(),
		"timestamp": Time.get_datetime_string_from_system(true),
		"severity": severity,
		"source": "godot",
		"category": category,
		"code": code,
		"message": message,
		"user_message": user_message if not user_message.is_empty() else message,
		"recoverable": true,
		"retryable": false,
		"context": _sanitize(context),
		"details": _sanitize(details),
	}
	for key: String in ["session_id", "request_id", "trace_id", "room_id", "battle_id", "battle_revision", "scene", "operation"]:
		if context.has(key): record[key] = _sanitize(context[key])
	_write_jsonl(record)
	var bundle: Dictionary = DiagnosticBundleScript.collect({"error_id":record.error_id, "code":code, "category":category, "request_id":record.get("request_id", ""), "trace_id":record.get("trace_id", "")})
	record["diagnostic_bundle"] = str(bundle.get("bundle_path", ""))
	error_recorded.emit(record)
	return record

func _write_jsonl(record: Dictionary) -> void:
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(LOG_DIR))
	var file := FileAccess.open(ERROR_LOG, FileAccess.READ_WRITE)
	if file == null:
		file = FileAccess.open(ERROR_LOG, FileAccess.WRITE)
	if file == null: return
	file.seek_end()
	file.store_line(JSON.stringify(record))
	file.close()

func _sanitize(value: Variant) -> Variant:
	if value is Array:
		var output: Array = []
		for item: Variant in value: output.append(_sanitize(item))
		return output
	if value is Dictionary:
		var output: Dictionary = {}
		for key: Variant in value:
			var name := str(key)
			output[name] = "[REDACTED]" if SENSITIVE_KEY.has(name) or name.to_lower().contains("token") else _sanitize(value[key])
		return output
	return value

func _id() -> String:
	return "%s-%s" % [Time.get_unix_time_from_system(), randi()]

