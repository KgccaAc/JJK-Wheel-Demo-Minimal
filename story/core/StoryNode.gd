extends RefCounted
class_name StoryNode

var node_id: String
var chapter_id: String
var node_type: String
var title: String
var summary: String
var choices: Array[Dictionary]
var next_nodes: Dictionary
var growth_rules: Dictionary
var battle_config: Dictionary
var wheel_config: Dictionary
var failure_policy: String
var ai_policy: String

static func from_dict(raw: Dictionary) -> StoryNode:
    var n := StoryNode.new()
    n.node_id = str(raw.get("node_id", ""))
    n.chapter_id = str(raw.get("chapter_id", ""))
    n.node_type = str(raw.get("node_type", "event"))
    n.title = str(raw.get("title", n.node_id))
    n.summary = str(raw.get("summary", ""))
    n.choices = []
    for item in raw.get("choices", []):
        if item is Dictionary: n.choices.append(item)
    n.next_nodes = raw.get("next_nodes", {}) as Dictionary
    n.growth_rules = raw.get("growth_rules", {}) as Dictionary
    n.battle_config = raw.get("battle_config", {}) as Dictionary
    n.wheel_config = raw.get("wheel_config", {}) as Dictionary
    n.failure_policy = str(raw.get("failure_policy", "continue_with_injury"))
    n.ai_policy = str(raw.get("ai_policy", "disabled"))
    return n
