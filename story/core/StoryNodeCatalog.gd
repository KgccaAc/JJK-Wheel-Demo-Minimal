extends RefCounted
class_name StoryNodeCatalog

var nodes: Dictionary = {}

func load_from_file(path: String) -> bool:
    var file := FileAccess.open(path, FileAccess.READ)
    if file == null: return false
    var parsed: Variant = JSON.parse_string(file.get_as_text())
    if not parsed is Array: return false
    nodes.clear()
    for raw in parsed:
        if raw is Dictionary:
            var node := StoryNode.from_dict(raw)
            nodes[node.node_id] = node
    return not nodes.is_empty()

func get_node(node_id: String) -> StoryNode:
    return nodes.get(node_id) as StoryNode
