class_name ErrorFormatter
extends RefCounted

const USER_MESSAGES: Dictionary = {
	"SCENE_LOAD_FAILED": "页面加载失败，请返回上一页重试。",
	"RESOURCE_LOAD_FAILED": "资源加载失败，请重试。",
	"STALE_BATTLE_REVISION": "对局状态已变化，请重新同步。",
	"ROOM_NOT_FOUND": "房间不存在或已结束。",
	"ROOM_FULL": "房间已满，请选择其他房间。",
	"INVALID_STAGE": "当前回合阶段不允许此操作。",
	"INSUFFICIENT_CE": "咒力不足，无法使用这张牌。",
	"CHECKPOINT_WRITE_FAILED": "对局保存失败，请稍后重试。",
	"NETWORK_HTTP_FAILED": "网络请求失败，请检查连接后重试。"
}

static func format(record: Dictionary) -> Dictionary:
	var code := str(record.get("code", "INTERNAL_ERROR"))
	var category := str(record.get("category", "UNKNOWN"))
	var user_message := str(record.get("user_message", USER_MESSAGES.get(code, "操作失败，请稍后重试。")))
	var recovery := "请重试或返回上一页。" if bool(record.get("recoverable", true)) else "请记录错误编号并联系支持。"
	return {"code": code, "category": category, "message": user_message, "recovery": recovery, "recoverable": bool(record.get("recoverable", true)), "retryable": bool(record.get("retryable", false))}
