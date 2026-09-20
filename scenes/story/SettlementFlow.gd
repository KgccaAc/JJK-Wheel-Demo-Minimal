extends Control
class_name SettlementFlow

const UI: Script = preload("res://ui/ClientUi.gd")
var displayed_result: Dictionary = {}

func _ready() -> void:
	UI.bind_button_feedback(self)
	_bind_buttons(self)
	var state: Node = get_node_or_null("/root/StoryState")
	if state != null:
		displayed_result = (state.get("pending_result") as Dictionary).duplicate(true)
		if not displayed_result.is_empty(): state.call("commit_pending")
	var resources: Dictionary = state.get("resources") as Dictionary if state != null else {}
	var growth: Dictionary = state.get("growth") as Dictionary if state != null else {}
	var footer := get_node_or_null("Review/Label") as Label
	if footer != null: footer.text = "节点完成 · 状态与经历已记录"
	_render_result(resources, growth, state)
	var enter := get_node_or_null("Enter") as BaseButton
	if enter != null: enter.pressed.connect(func() -> void: UI.navigate(self, "res://scenes/story/Map.tscn"))
	var back := get_node_or_null("Back") as BaseButton
	if back != null: back.pressed.connect(func() -> void: UI.navigate(self, "res://scenes/home/home.tscn"))
	var history := get_node_or_null("History") as BaseButton
	if history != null: history.pressed.connect(_show_history)
	var review := get_node_or_null("Review") as BaseButton
	if review != null and not review.has_meta("settlement_review_bound"):
		review.set_meta("settlement_review_bound", true)
		review.pressed.connect(_show_reports)
	_play_reveal()

func _render_result(resources: Dictionary, growth: Dictionary, story_state: Node) -> void:
	var delta: Dictionary = displayed_result.get("resource_delta", {}) as Dictionary
	var resource_paths := {"hp":"Status/ResourceChange/HP/Value", "ce":"Status/ResourceChange/CE/Value", "money":"Status/ResourceChange/Money/Value", "xp":"Status/ResourceChange/EXP/Value", "stability":"Status/ResourceChange/Stability/Value"}
	for key: String in resource_paths:
		var label := get_node_or_null(str(resource_paths[key])) as Label
		if label != null: label.text = "%+d → %d" % [int(delta.get(key, 0)), int(resources.get(key, 0))]
	var growth_delta: Dictionary = displayed_result.get("growth_delta", {}) as Dictionary
	var growth_paths := {"体质":"Status/Born/HP/Value", "咒力总量":"Status/Born/MaxCE/Value", "咒力操纵":"Status/Born/CeControl/Value", "咒力效率":"Status/Born/CeEfficiency/Value", "体术":"Status/Born/BodyTech/Value", "悟性":"Status/Born/Insight/Value"}
	for key: String in growth_paths:
		var label := get_node_or_null(str(growth_paths[key])) as Label
		if label != null: label.text = "%+d → %d" % [int(growth_delta.get(key, 0)), int(growth.get(key, 0))]
	var title := get_node_or_null("Status/Title") as Label
	if title != null:
		title.text = str(displayed_result.get("title", "节点完成"))
		title.add_theme_font_size_override("font_size", 27)
		title.size.x = 310.0
	var subtitle := get_node_or_null("Status/Subtitle") as Label
	if subtitle != null: subtitle.position.x = 335.0
	var review := get_node_or_null("Reflect/Label") as Label
	if review != null:
		var review_text := _summary_text(str(displayed_result.get("text", "本次节点已记录。")))
		var inventory_delta: Dictionary = displayed_result.get("inventory_delta", {}) as Dictionary
		if not inventory_delta.is_empty():
			var item_lines: Array[String] = []
			for item_id: Variant in inventory_delta:
				var amount := int(inventory_delta[item_id])
				item_lines.append("物品 %s %+d" % [_item_name(str(item_id)), amount])
			review_text += "\n\n" + " / ".join(item_lines)
		review.text = review_text
	_render_relationship(story_state)
	_render_route()

func _summary_text(value: String) -> String:
	var normalized := value.replace("\r", "").strip_edges()
	var paragraphs := normalized.split("\n", false)
	var summary := ""
	for paragraph: String in paragraphs:
		var line := paragraph.strip_edges()
		if line.is_empty(): continue
		summary += ("" if summary.is_empty() else " ") + line
		if summary.length() >= 120: break
	if summary.length() > 120: summary = summary.left(117) + "…"
	return summary if not summary.is_empty() else "本次节点已记录。"

func _item_name(item_id: String) -> String:
	return {"river_protective_talisman":"潮息护符"}.get(item_id, item_id)

func _render_relationship(story_state: Node) -> void:
	var heading := get_node_or_null("Status/Connection") as Label
	var name_label := get_node_or_null("Status/Connection/Camp1/Name") as Label
	var value_label := get_node_or_null("Status/Connection/Camp1/Value") as Label
	if heading != null: heading.text = "人物关系"
	var changes: Dictionary = displayed_result.get("relationship_delta", {}) as Dictionary
	if name_label == null or value_label == null: return
	name_label.position = Vector2(37.0, -3.0)
	name_label.size = Vector2(265.0, 28.0)
	value_label.position = Vector2(37.0, 26.0)
	value_label.size = Vector2(265.0, 26.0)
	value_label.add_theme_font_size_override("font_size", 15)
	if changes.is_empty() or story_state == null or not story_state.has_method("npc_state"):
		name_label.text = "本节点无变化"
		value_label.text = "—"
		return
	var npc_id := str(changes.keys()[0])
	var delta: Dictionary = changes[npc_id] as Dictionary
	var state: Dictionary = story_state.call("npc_state", npc_id) as Dictionary
	var npc_name := "初级术师" if npc_id == "junior_sorcerer" else npc_id
	var stage_text := str({"first_meeting":"初识", "testing":"试探", "conflict":"分歧", "temporary_partner":"临时同行", "recruit":"正式伙伴"}.get(str(state.get("route_stage", "")), state.get("route_stage", "")))
	name_label.text = "%s·%s" % [npc_name, stage_text]
	var values: Array[String] = []
	for key: String in ["affection", "trust", "respect", "compatibility"]:
		var amount := int(delta.get(key, 0))
		if amount != 0: values.append("%s%+d" % [{"affection":"好感", "trust":"信任", "respect":"认可", "compatibility":"默契"}.get(key, key), amount])
	value_label.text = " / ".join(values) if not values.is_empty() else "关系已记录"
	var companion_hint := "；已解锁随行援护" if bool(state.get("companion", false)) else ""
	name_label.tooltip_text = "%s，当前关系：%s%s" % [npc_name, stage_text, companion_hint]
	value_label.tooltip_text = name_label.tooltip_text

func _render_route() -> void:
	var node_id := str(displayed_result.get("node_id", ""))
	var now_text := str(displayed_result.get("title", "节点完成"))
	var next_id := str(displayed_result.get("next_node", ""))
	var story_state: Node = get_node_or_null("/root/StoryState")
	var next_definition: Dictionary = story_state.call("node_definition", next_id) as Dictionary if story_state != null and story_state.has_method("node_definition") else {}
	var next_text: String = str(next_definition.get("title", {"chapter1_selection":"残秽与黑影", "chapter1_clue":"河岸的低级咒灵", "chapter1_battle":"W145·是否加入高专"}.get(node_id, "章节地图")))
	var route_count: int = 0 if next_id in ["chapter1_end", ""] else 1
	var now_label := get_node_or_null("Road/Now") as Label
	var next_label := get_node_or_null("Road/Next") as Label
	var route_label := get_node_or_null("Road/Road") as Label
	if now_label != null:
		now_label.text = "当前节点：%s" % now_text
		now_label.size.x = 270.0
		now_label.add_theme_font_size_override("font_size", 22)
	if next_label != null:
		next_label.text = "解锁节点：%s" % str(next_text)
		next_label.size.x = 270.0
		next_label.size.y = 66.0
		next_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		next_label.add_theme_font_size_override("font_size", 18)
	if route_label != null: route_label.text = "可选路线：%d" % route_count

func _play_reveal() -> void:
	var controls: Array[Control] = []
	for path: String in ["SuccessLabel", "Status", "Reflect", "Road", "Enter", "History", "Back"]:
		var control := get_node_or_null(path) as Control
		if control != null:
			control.modulate.a = 0.0
			controls.append(control)
	if UI.reduced_motion():
		for control: Control in controls: control.modulate.a = 1.0
		return
	for index: int in controls.size():
		var tween := create_tween()
		tween.tween_property(controls[index], "modulate:a", 1.0, 0.22).set_delay(index * 0.08)

func _show_history() -> void:
	var state: Node = get_node_or_null("/root/StoryState")
	if state == null: return
	var report: Dictionary = state.call("build_experience_report") as Dictionary
	var lines: Array[String] = ["经历事件报告 · 共%d项" % int(report.get("eventCount", 0))]
	for index: int in (report.get("events", []) as Array).size():
		var item := (report.get("events", []) as Array)[index] as Dictionary
		lines.append("\n%d. %s\n%s" % [index + 1, str(item.get("title", "节点")), str(item.get("text", ""))])
	UI.notice(self, "经历事件报告", "\n".join(lines) if lines.size() > 1 else "暂无记录")

func _show_reports() -> void:
	var state: Node = get_node_or_null("/root/StoryState")
	if state == null: return
	var status: Dictionary = state.call("build_character_report") as Dictionary
	var experience: Dictionary = state.call("build_experience_report") as Dictionary
	var novel: Dictionary = state.call("generate_story_novel") as Dictionary
	var resources: Dictionary = status.get("resources", {}) as Dictionary
	var growth: Dictionary = status.get("growth", {}) as Dictionary
	var lines: Array[String] = [
		"角色数值报告",
		"角色：%s" % str(status.get("displayName", "未命名角色")),
		"资源：HP %d / CE %d / EXP %d / 稳定值 %d / 金钱 %d" % [int(resources.get("hp", 0)), int(resources.get("ce", 0)), int(resources.get("xp", 0)), int(resources.get("stability", 0)), int(resources.get("money", 0))],
		"成长：%s" % _format_values(growth),
		"物品：%s" % _format_inventory(status.get("inventory", {}) as Dictionary),
		"\n经历事件报告：共%d项，当前节点 %s" % [int(experience.get("eventCount", 0)), str(experience.get("currentNode", ""))],
		"\n小说生成（%s）\n%s" % ["AI" if str(novel.get("source", "")) == "ai" else "本地逻辑", str(novel.get("text", ""))]
	]
	UI.notice(self, "完整结算报告", "\n".join(lines))

func _format_values(values: Dictionary) -> String:
	var lines: Array[String] = []
	for key: Variant in values: lines.append("%s %d" % [str(key), int(values[key])])
	return "、".join(lines) if not lines.is_empty() else "暂无"

func _format_inventory(values: Dictionary) -> String:
	var lines: Array[String] = []
	for key: Variant in values: lines.append("%s ×%d" % [_item_name(str(key)), int(values[key])])
	return "、".join(lines) if not lines.is_empty() else "暂无"

func _bind_buttons(node: Node) -> void:
	if node is BaseButton:
		var button := node as BaseButton
		if not button.has_meta("settlement_bound"):
			button.set_meta("settlement_bound", true)
	for child in node.get_children(): _bind_buttons(child)
