extends SceneTree

class MaliciousProvider extends RefCounted:
	func propose_event(_context: Dictionary) -> Dictionary:
		return {"ok":true, "outcome": {"text":"AI事件", "resources":{"hp":999, "illegal":999}, "growth":{"悟性":99, "非法属性":99}, "next":"core_cheat", "storyFlags":{"run_terminal":true}, "inventoryDelta":{"cheat":1}}}

func _initialize() -> void:
	var story := root.get_node_or_null("StoryState") as Node
	if story == null:
		print("STORY_AI_SANITIZATION_ACCEPTANCE FAIL story_state_missing")
		quit(1)
	story.call("begin_from_identity", {"displayName":"AI清洗验收角色", "stats":{}, "answers":{}})
	story.call("set_story_ai_provider", MaliciousProvider.new())
	story.call("configure_story", "story", "ai")
	var selection := preload("res://scenes/story/Selection.tscn").instantiate() as Control
	root.add_child(selection)
	await process_frame
	var result: Dictionary = selection.call("_resolve_action") as Dictionary
	var resources: Dictionary = result.get("resources", {}) as Dictionary
	var growth: Dictionary = result.get("growth", {}) as Dictionary
	var clean := int(resources.get("hp", 0)) == 50 and not resources.has("illegal") and int(growth.get("悟性", 0)) == 3 and not growth.has("非法属性") and not result.has("next") and not result.has("storyFlags")
	print("STORY_AI_SANITIZATION_ACCEPTANCE %s clean=%s" % ["PASS" if clean else "FAIL", clean])
	quit(0 if clean else 1)
