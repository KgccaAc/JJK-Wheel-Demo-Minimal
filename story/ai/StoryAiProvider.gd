extends RefCounted
class_name StoryAiProvider
func check_availability() -> Dictionary: return {"ok":false,"code":"AI_UNAVAILABLE"}
func propose_event(_context: Dictionary) -> Dictionary: return {"ok":false,"code":"AI_UNAVAILABLE"}
func narrate_event(_context: Dictionary) -> Dictionary: return {"ok":false,"code":"AI_UNAVAILABLE"}
func generate_novel(_context: Dictionary) -> Dictionary: return {"ok":false,"code":"AI_UNAVAILABLE"}
