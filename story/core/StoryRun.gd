extends RefCounted
class_name StoryRun

signal changed(snapshot: Dictionary)

var run_id := "demo-run"
var story_seed := 1
var difficulty := "story"
var ai_enabled := false
var current_node_id := ""
var status := "setup"
var protagonist: Dictionary = {"display_name":"转盘角色", "stats":{"power":10,"control":10,"body":10,"efficiency":10}}
var growth: Dictionary = {"xp":0,"stats":{},"tags":[]}
var world_state: Dictionary = {}
var event_log: Array[Dictionary] = []
var catalog: StoryNodeCatalog

func start(catalog_ref: StoryNodeCatalog, protagonist_ref: Dictionary = {}) -> void:
    catalog = catalog_ref
    if not protagonist_ref.is_empty(): protagonist = protagonist_ref.duplicate(true)
    current_node_id = "chapter_1_intro"
    status = "running"
    _record("run_started", {"difficulty":difficulty,"ai_enabled":ai_enabled})
    _emit_changed()

func current_node() -> StoryNode:
    return catalog.get_node(current_node_id) if catalog != null else null

func submit_choice(choice_id: String) -> bool:
    var node := current_node()
    if node == null or node.node_type != "choice": return false
    var target := str(node.next_nodes.get(choice_id, ""))
    if target.is_empty(): return false
    _record("choice", {"node_id":node.node_id,"choice_id":choice_id})
    _advance(target)
    return true

func submit_wheel_result(result_text: String) -> bool:
    var node := current_node()
    if node == null or node.node_type != "wheel": return false
    _record("wheel", {"node_id":node.node_id,"result":result_text})
    _advance(str(node.next_nodes.get(result_text, node.next_nodes.get("default", ""))))
    return true

func submit_battle_result(outcome: String, payload: Dictionary = {}) -> bool:
    var node := current_node()
    if node == null or node.node_type != "battle": return false
    _record("battle", {"node_id":node.node_id,"outcome":outcome,"payload":payload})
    if outcome == "victory":
        apply_growth(node.growth_rules)
        _advance(str(node.next_nodes.get("victory", "")))
    else:
        _record("failure", {"node_id":node.node_id,"policy":difficulty})
        if difficulty == "ironman": status = "dead"
        else: _advance(str(node.next_nodes.get("defeat", node.next_nodes.get("victory", ""))))
    _emit_changed()
    return true

func apply_growth(delta: Dictionary) -> void:
    growth.xp = int(growth.get("xp", 0)) + int(delta.get("xp", 0))
    var stats: Dictionary = growth.get("stats", {}) as Dictionary
    for key in delta.get("stats", {}).keys(): stats[key] = clampi(int(stats.get(key, 0)) + int(delta.stats[key]), -20, 100)
    growth.stats = stats
    for tag in delta.get("tags", []):
        if not growth.tags.has(tag): growth.tags.append(tag)
    _record("growth", delta)

func is_finished() -> bool:
    return status in ["finished", "dead"]

func snapshot() -> Dictionary:
    return {"run_id":run_id,"story_seed":story_seed,"difficulty":difficulty,"ai_enabled":ai_enabled,"current_node_id":current_node_id,"status":status,"protagonist":protagonist.duplicate(true),"growth":growth.duplicate(true),"world_state":world_state.duplicate(true),"event_log":event_log.duplicate(true)}

func _advance(target: String) -> void:
    if target.is_empty(): status = "finished"
    else: current_node_id = target
    if current_node_id == "chapter_1_end": status = "finished"
    _emit_changed()

func _record(kind: String, payload: Dictionary) -> void:
    event_log.append({"kind":kind,"payload":payload,"node_id":current_node_id,"index":event_log.size()})

func _emit_changed() -> void:
    changed.emit(snapshot())
