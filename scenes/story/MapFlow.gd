extends Control
class_name MapFlow

const UI: Script = preload("res://ui/ClientUi.gd")
const PAGE_ENTRANCE: Script = preload("res://ui/PageEntrance.gd")
const NODE_TEXTURES := {
	"NodeTypeDone": ["已完成节点未选中.png", "已完成节点选中.png"],
	"NodeTypeStory": ["剧情故事节点未选中.png", "剧情故事节点选中.png"],
	"NodeTypeFight": ["战斗节点未选中.png", "战斗节点选中.png"],
	"NodeTypeRandom": ["突发事件节点未选中.png", "突发事件节点选中.png"],
	"NodeTypeBranch": ["分支节点未选中.png", "分支节点选中.png"],
	"NodeTypeLock": ["未解锁节点.png", "未解锁节点选中.png"],
	"NodeTypeDangerous": ["高危节点未选中.png", "高危节点选中.png"]
}
var selected_node := "NodeTypeStory"
var node_locked: Dictionary = {}
var entering_node := false

func _ready() -> void:
	UI.bind_button_feedback(self)
	_bind_buttons(self)
	if not UI.reduced_motion(): PAGE_ENTRANCE.play(self)
	var enter: BaseButton = get_node_or_null("Enter") as BaseButton
	if enter != null: enter.pressed.connect(_enter_selected_node)
	var history: BaseButton = get_node_or_null("History") as BaseButton
	if history != null: history.pressed.connect(_show_history)
	var file: BaseButton = get_node_or_null("File") as BaseButton
	if file != null: file.pressed.connect(_load_save)
	for node_name: String in ["NodeTypeStory", "NodeTypeFight", "NodeTypeRandom", "NodeTypeBranch", "NodeTypeDangerous", "NodeTypeDone"]:
		var node_button := get_node_or_null("Map/Node/" + node_name) as BaseButton
		if node_button != null: node_button.pressed.connect(_select_node.bind(node_name))
	_set_node_locks()
	var chapter_title := get_node_or_null("Map/Title") as Label
	if chapter_title != null: chapter_title.text = "第1章·开始篇"
	var state: Node = get_node_or_null("/root/StoryState")
	var current: String = str(state.get("current_node")) if state != null else "chapter1_clue"
	if state != null and bool((state.get("flags") as Dictionary).get("run_terminal", false)):
		selected_node = "NodeTypeDone"
		_set_node_locks()
		_update_status()
		var terminal_subtitle := get_node_or_null("Map/NodeSubTitle") as Label
		if terminal_subtitle != null: terminal_subtitle.text = "本次运行已终止；可以查看历史或返回首页。"
		return
	_select_node(_button_for_current_node(current))
	_update_status()
	_update_chapter_status()

func _button_for_current_node(current: String) -> String:
	if current in ["chapter1_settlement", "chapter1_end"] or current.begins_with("core_"): return "NodeTypeDone"
	for raw: Variant in _map_definitions():
		if raw is Dictionary and str((raw as Dictionary).get("node", "")) == current:
			return str((raw as Dictionary).get("button", "NodeTypeStory"))
	return "NodeTypeStory"

func _enter_selected_node() -> void:
	if entering_node: return
	var enter: BaseButton = get_node_or_null("Enter") as BaseButton
	if enter != null: UI.pulse(enter)
	var selected: String = selected_node
	var definition := _map_definition(selected)
	if bool(node_locked.get(selected, false)) or definition.is_empty():
		UI.notice(self, "节点未解锁", "完成前置节点后才能进入这里。")
		return
	entering_node = true
	if enter != null: enter.disabled = true
	var state: Node = get_node_or_null("/root/StoryState")
	if state != null and bool((state.get("flags") as Dictionary).get("run_terminal", false)):
		UI.notice(self, "本次运行已终止", "角色死亡或结局已锁定，不能继续进入新的剧情节点。")
		return
	var node_id := str(definition.get("node", ""))
	var node_definition: Dictionary = state.call("node_definition", node_id) as Dictionary if state != null else {}
	if str(node_definition.get("type", "")) == "end":
		var continuation := str(node_definition.get("next", ""))
		if not continuation.is_empty() and state != null:
			state.call("begin_node", continuation)
			var continuation_definition: Dictionary = state.call("node_definition", continuation) as Dictionary
			var continuation_scene := str(continuation_definition.get("scene", "res://scenes/story/RPG.tscn"))
			if not continuation_scene.is_empty() and ResourceLoader.exists(continuation_scene):
				UI.navigate(self, continuation_scene)
				return
		UI.notice(self, "阶段完成", "%s 已完成，阶段结果已记录。" % str(node_definition.get("title", "剧情阶段")))
		entering_node = false
		if enter != null: enter.disabled = false
		return
	if str(node_definition.get("type", "")) == "core_reserved":
		UI.notice(self, "核心节点已预留", "%s（W%s）已接入原剧情盘，但当前第一章小样暂未开放此节点。" % [str(node_definition.get("title", "核心节点")), str(node_definition.get("sourceWheelId", "—"))])
		entering_node = false
		if enter != null: enter.disabled = false
		return
	if node_id == "chapter1_end":
		UI.notice(self, "第一章结局", "河岸异常已结算。下一核心节点为 W145「是否加入高专」。第一章经历与结局已保存，可随时查看完整记录。")
		entering_node = false
		if enter != null: enter.disabled = false
		return
	var scene_path := state.call("scene_for_node", node_id) as String if state != null and state.has_method("scene_for_node") else str(node_definition.get("scene", ""))
	if scene_path.is_empty() or not ResourceLoader.exists(scene_path):
		UI.notice(self, "节点尚未制作", "该节点已预留，但本次小样未开放。")
		entering_node = false
		if enter != null: enter.disabled = false
		return
	if state != null: state.call("begin_node", node_id)
	UI.navigate(self, scene_path)

func _select_node(node_name: String) -> void:
	selected_node = node_name
	set_meta("selected_node", node_name)
	var state: Node = get_node_or_null("/root/StoryState")
	for key: String in NODE_TEXTURES:
		var node_button := get_node_or_null("Map/Node/" + key) as TextureButton
		if node_button != null:
			var names: Array = NODE_TEXTURES[key]
			var path := "res://art/Story/Map/节点图标/" + str(names[1] if key == node_name else names[0])
			node_button.texture_normal = load(path) as Texture2D
	var title: Label = get_node_or_null("Map/NodeTitle") as Label
	if title != null:
		var definition := _map_definition(node_name)
		var node_definition: Dictionary = state.call("node_definition", str(definition.get("node", ""))) as Dictionary if state != null else {}
		title.text = "当前节点：%s" % str(node_definition.get("title", "未开放节点"))
	var subtitle := get_node_or_null("Map/NodeSubTitle") as Label
	if subtitle != null:
		var core_hint := "原剧情盘核心节点；必须由玩家手动确认，AI不可代选。" if node_name == "NodeTypeDone" and str((state.get("current_node") if state != null else "")).begins_with("core_") else ""
		var node_hint: String = str({"NodeTypeStory":"剧情节点：对话、线索和预设选择。", "NodeTypeFight":"战斗节点：真实战斗并统一结算。", "NodeTypeRandom":"随机节点：隐式转盘抽取本地事件。", "NodeTypeBranch":"分支节点：玩家手动选择行动路线。", "NodeTypeDangerous":"高危节点：高风险真实战斗。", "NodeTypeDone":"第一章已完成；下一核心剧情盘为W145。"}.get(node_name, "后续内容节点，本章暂未开放。"))
		subtitle.text = core_hint if not core_hint.is_empty() else node_hint

func _set_node_locks() -> void:
	var state: Node = get_node_or_null("/root/StoryState")
	var history: Array = state.get("history") as Array if state != null else []
	var completed: Dictionary = {}
	for item: Variant in history:
		if item is Dictionary:
			completed[str((item as Dictionary).get("node_id", ""))] = true
	node_locked.clear()
	for raw: Variant in _map_definitions():
		var definition := raw as Dictionary
		var button_name := str(definition.get("button", ""))
		var required := str(definition.get("requires", ""))
		var required_any: Array = definition.get("requiresAny", []) as Array
		var has_any_requirement := required_any.is_empty()
		for candidate: Variant in required_any:
			if completed.has(str(candidate)):
				has_any_requirement = true
				break
		var target_id := str(definition.get("node", ""))
		var is_completed := completed.has(target_id)
		node_locked[button_name] = (not bool(definition.get("available", false)) or (not required.is_empty() and not completed.has(required)) or not has_any_requirement) and not is_completed
	for key: String in node_locked:
		var button := get_node_or_null("Map/Node/" + key) as BaseButton
		if button != null:
			button.modulate = Color(0.55, 0.55, 0.55, 1.0) if node_locked[key] else Color.WHITE
	_update_chapter_status()

func _update_chapter_status() -> void:
	var state: Node = get_node_or_null("/root/StoryState")
	if state == null: return
	var current := str(state.get("current_node"))
	var history: Array = state.get("history") as Array
	var finished := current == "chapter1_end" or bool((state.get("flags") as Dictionary).get("chapter1_end", false))
	var current_title := get_node_or_null("Chapter/ChapterNow/Title") as Label
	var current_status := get_node_or_null("Chapter/ChapterNow/Status") as Label
	var done_status := get_node_or_null("Chapter/ChapterDone/Status") as Label
	if current_title != null: current_title.text = "第一章·仙台的异乡人"
	if current_status != null: current_status.text = "已完成" if finished else ("进行中" if not history.is_empty() else "未开始")
	if done_status != null: done_status.text = "已完成" if finished else "序章"
	var enter_title := get_node_or_null("Enter/Title") as Label
	if enter_title != null and finished: enter_title.text = "查看第一章结局"

func _map_definitions() -> Array:
	var state: Node = get_node_or_null("/root/StoryState")
	var chapter_data: Dictionary = state.get("chapter_data") as Dictionary if state != null else {}
	return chapter_data.get("mapNodes", []) as Array

func _map_definition(button_name: String) -> Dictionary:
	var state: Node = get_node_or_null("/root/StoryState")
	var current := str(state.get("current_node")) if state != null else ""
	if button_name == "NodeTypeDone" and current.begins_with("core_") and current != "core_join_high_school":
		return {"button":"NodeTypeDone", "node":current, "requires":"", "available":true}
	for raw: Variant in _map_definitions():
		if raw is Dictionary and str((raw as Dictionary).get("button", "")) == button_name: return (raw as Dictionary).duplicate(true)
	return {}

func _update_status() -> void:
	var story_state: Node = get_node_or_null("/root/StoryState")
	var resources: Dictionary = story_state.get("resources") as Dictionary if story_state != null else {}
	var character: Dictionary = story_state.get("character") as Dictionary if story_state != null else {}
	var answers: Dictionary = character.get("answers", character.get("sourceAnswers", {})) as Dictionary
	var name_label := get_node_or_null("CharacterStatus/Name") as Label
	if name_label != null: name_label.text = str(character.get("displayName", "转盘角色 · %s" % str(character.get("grade_label", "未定"))))
	var identity_label := get_node_or_null("CharacterStatus/IdentityLabel/Identity") as Label
	if identity_label != null: identity_label.text = str(answers.get("identity", "身份未定"))
	var technique_label := get_node_or_null("CharacterStatus/Technicalabel/Technical") as Label
	if technique_label != null: technique_label.text = str(answers.get("familyInnateTechnique", answers.get("innateTechnique", "无术式")))
	var domain_label := get_node_or_null("CharacterStatus/DomainLabel/Domain") as Label
	if domain_label != null: domain_label.text = str(answers.get("domainCompletion", "尚未展开"))
	var values := {"Hp":"HP %d" % int(resources.get("hp", 100)), "CE":"CE %d" % int(resources.get("ce", 100)), "Exp":"EXP %d" % int(resources.get("xp", 0)), "Stability":"稳定值 %d" % int(resources.get("stability", 100))}
	for key: String in values:
		var label := get_node_or_null("CharacterStatus/Control/" + key) as Label
		if label != null: label.text = str(values[key])

func _item_name(item_id: String) -> String:
	return {"river_protective_talisman":"潮息护符"}.get(item_id, item_id)

func _show_history() -> void:
	var state: Node = get_node_or_null("/root/StoryState")
	var history: Array = state.get("history") as Array if state != null else []
	var lines: Array[String] = []
	for item: Variant in history:
		if item is Dictionary: lines.append("%s｜%s" % [str((item as Dictionary).get("title", "节点")), str((item as Dictionary).get("text", ""))])
	UI.notice(self, "经历记录", "\n".join(lines) if not lines.is_empty() else "还没有已结算的经历。")

func _load_save() -> void:
	var state: Node = get_node_or_null("/root/StoryState")
	if state != null and bool(state.call("load_saved")):
		_set_node_locks()
		_update_status()
		UI.notice(self, "读取成功", "已恢复最近一次完成结算后的状态。")
	else: UI.notice(self, "没有存档", "完成一次节点结算后会自动保存。")

func _bind_buttons(node: Node) -> void:
	if node is BaseButton:
		var button := node as BaseButton
		if not button.has_meta("map_pulse_bound"):
			button.set_meta("map_pulse_bound", true)
	for child in node.get_children(): _bind_buttons(child)
