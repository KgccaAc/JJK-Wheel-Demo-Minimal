extends RefCounted
class_name UnavailableAiProvider
func check_availability() -> Dictionary: return {"ok":false,"code":"AI_UNAVAILABLE","message":"AI 服务尚未配置"}
func propose_event(_context: Dictionary) -> Dictionary: return {"ok":false,"code":"AI_UNAVAILABLE","message":"AI 服务尚未配置"}
func narrate_event(_context: Dictionary) -> Dictionary: return {"ok":false,"code":"AI_UNAVAILABLE","message":"AI 服务尚未配置"}
