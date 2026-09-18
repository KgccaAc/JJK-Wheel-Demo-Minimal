extends Control
class_name SelectionFlow

const UI: Script = preload("res://ui/ClientUi.gd")
const PAGE_ENTRANCE: Script = preload("res://ui/PageEntrance.gd")
const ACTION_NORMAL := {"观察":"res://art/Story/Select/行动方式选择/选择行动观察未选中.png", "交谈":"res://art/Story/Select/行动方式选择/行动选择交谈未选中.png", "搜索":"res://art/Story/Select/行动方式选择/行动选择搜索未选中.png", "休息":"res://art/Story/Select/行动方式选择/行动选择休息未选中.png"}
const ACTION_SELECTED := {"观察":"res://art/Story/Select/行动方式选择/行动选择观察选中.png", "交谈":"res://art/Story/Select/行动方式选择/行动选择交谈选中.png", "搜索":"res://art/Story/Select/行动方式选择/行动选择搜索选中.png", "休息":"res://art/Story/Select/行动方式选择/行动选择休息选中.png"}
const MODE_FIXED_NORMAL := "res://art/Story/Select/行动方式选择/行动方式固定未选中.png"
const MODE_FIXED_SELECTED := "res://art/Story/Select/行动方式选择/行动方式固定选中.png"
const MODE_AI_NORMAL := "res://art/Story/Select/行动方式选择/行动方式AI未选中.png"
const MODE_AI_SELECTED := "res://art/Story/Select/行动方式选择/行动方式AI选中.png"
const AI_PROVIDER_SCRIPT: Script = preload("res://story/ai/UnavailableAiProvider.gd")
var selected_action := ""
var action_mode := "fixed"
var time_slots: Array[String] = ["早上", "中午", "下午", "晚上"]
var slot_index := 0
var state := {"hp":100, "ce":100, "xp":0, "stability":100, "money":100}
var growth := {"咒力总量":0, "咒力操纵":0, "体术":0, "体质":0, "咒力效率":0, "悟性":0}
var interaction: Dictionary = {}
var background_by_slot: Dictionary = {}
var accumulated_resources: Dictionary = {}
var accumulated_growth: Dictionary = {}
var accumulated_relationships: Dictionary = {}
var accumulated_npc_flags: Dictionary = {}
var accumulated_story_flags: Dictionary = {}
var accumulated_inventory: Dictionary = {}
var event_log: Array[String] = []
var confirming := false
var result_ready := false
var ai_provider: RefCounted
var ai_last_status := ""

func _ready() -> void:
	UI.bind_button_feedback(self)
	_bind_buttons(self)
	if not UI.reduced_motion(): PAGE_ENTRANCE.play(self)
	var story_state: Node = get_node_or_null("/root/StoryState")
	ai_provider = story_state.call("get_story_ai_provider") as RefCounted if story_state != null and story_state.has_method("get_story_ai_provider") else null
	if ai_provider == null: ai_provider = AI_PROVIDER_SCRIPT.new()
	if story_state != null:
		state = (story_state.get("resources") as Dictionary).duplicate(true)
		growth = (story_state.get("growth") as Dictionary).duplicate(true)
		interaction = story_state.call("node_definition", "chapter1_selection") as Dictionary
		background_by_slot = (interaction.get("backgrounds", {}) as Dictionary).duplicate(true)
		var configured_mode := str(story_state.get("mode"))
		action_mode = "ai" if configured_mode == "ai" else "fixed"
	var configured_slots: Array = interaction.get("timeSlots", []) as Array
	if not configured_slots.is_empty():
		time_slots.clear()
		for value: Variant in configured_slots: time_slots.append(str(value))
	_update_time_ui()
	_update_state_preview()
	_set_action("观察")
	var enter: BaseButton = get_node_or_null("Enter") as BaseButton
	if enter != null: enter.pressed.connect(_confirm)
	var map: BaseButton = get_node_or_null("Setting/Map") as BaseButton
	if map != null:
		map.disabled = true
		map.tooltip_text = "完成晚间行动并结算后返回地图"
	var exit: BaseButton = get_node_or_null("Setting/Exit") as BaseButton
	if exit != null: exit.pressed.connect(func() -> void: UI.navigate(self, "res://scenes/home/home.tscn"))
	var fixed: BaseButton = get_node_or_null("Model/ModelNormal") as BaseButton
	var ai: BaseButton = get_node_or_null("Model/ModelNormal2") as BaseButton
	if fixed != null: fixed.pressed.connect(func() -> void: action_mode = "fixed"; _refresh_mode_textures())
	if ai != null: ai.pressed.connect(func() -> void: action_mode = "ai"; _refresh_mode_textures(); _show_ai_status())
	_refresh_mode_textures()
	for pair: Array in [["SelectView", "观察"], ["SelectFight", "交谈"], ["SelectFight2", "搜索"], ["SelectFight3", "休息"]]:
		var action_button: BaseButton = get_node_or_null("Select/" + str(pair[0])) as BaseButton
		if action_button != null: action_button.tooltip_text = "选择%s行动" % str(pair[1])

func _set_action(action: String) -> void:
	selected_action = action
	var names := {"观察":"SelectView", "交谈":"SelectFight", "搜索":"SelectFight2", "休息":"SelectFight3"}
	for key: String in names:
		var button: BaseButton = get_node_or_null("Select/" + str(names[key])) as BaseButton
		if button != null:
			button.set_meta("selected_action", key == action)
			if button is TextureButton:
				(button as TextureButton).texture_normal = load(str(ACTION_SELECTED[key] if key == action else ACTION_NORMAL[key])) as Texture2D
	var action_data: Dictionary = ((interaction.get("actions", {}) as Dictionary).get(action, {}) as Dictionary)
	var fallback := {"观察":"你观察街道与行人，寻找不属于这个时代的痕迹。", "交谈":"你尝试从路人和店员口中确认仙台的情况。", "搜索":"你沿着残秽和路牌搜索咒术相关线索。", "休息":"你找了个安静角落，整理签名本和零散记忆。"}
	var detail: Label = get_node_or_null("Scene/Detail") as Label
	if detail != null: detail.text = str(action_data.get("detail", fallback.get(action, "")))

func _refresh_mode_textures() -> void:
	var fixed: TextureButton = get_node_or_null("Model/ModelNormal") as TextureButton
	var ai: TextureButton = get_node_or_null("Model/ModelNormal2") as TextureButton
	if fixed != null: fixed.texture_normal = load(MODE_FIXED_SELECTED if action_mode == "fixed" else MODE_FIXED_NORMAL) as Texture2D
	if ai != null: ai.texture_normal = load(MODE_AI_SELECTED if action_mode == "ai" else MODE_AI_NORMAL) as Texture2D
	var input_panel := get_node_or_null("Print") as Control
	if input_panel != null: input_panel.visible = action_mode == "ai"

func _confirm() -> void:
	if confirming: return
	if result_ready:
		_advance_after_result()
		return
	confirming = true
	var enter: BaseButton = get_node_or_null("Enter") as BaseButton
	if enter != null:
		enter.disabled = true
		UI.pulse(enter)
	var outcome: Dictionary = _resolve_action()
	_accumulate_outcome(outcome)
	var detail: Label = get_node_or_null("Scene/Detail") as Label
	if detail != null: detail.text = str(outcome.get("text", "行动完成。"))
	_update_state_preview()
	result_ready = true
	if enter != null:
		enter.disabled = false
		var enter_label := enter.get_node_or_null("Label") as Label
		if enter_label != null: enter_label.text = "查看结算" if slot_index >= time_slots.size() - 1 else "进入下一时段"
	confirming = false
	# The result remains on screen until the player explicitly confirms again.
	# This prevents the time-transition veil from covering text before it can be read.

func _format_outcome_delta(outcome: Dictionary) -> String:
	var parts: Array[String] = []
	for key: String in (outcome.get("resources", {}) as Dictionary):
		var amount := int((outcome.get("resources", {}) as Dictionary)[key])
		if amount != 0: parts.append("%s %+d" % [{"hp":"HP", "ce":"CE", "xp":"EXP", "stability":"稳定值", "money":"金钱"}.get(key, key), amount])
	for key: String in (outcome.get("growth", {}) as Dictionary):
		var amount := int((outcome.get("growth", {}) as Dictionary)[key])
		if amount != 0: parts.append("%s %+d" % [key, amount])
	return " · ".join(parts) if not parts.is_empty() else "状态无变化"

func _advance_after_result() -> void:
	if confirming: return
	confirming = true
	var enter: BaseButton = get_node_or_null("Enter") as BaseButton
	if enter != null:
		enter.disabled = true
		UI.pulse(enter)
	if slot_index >= time_slots.size() - 1:
		var story_state: Node = get_node_or_null("/root/StoryState")
		if story_state != null and story_state.has_method("resolve_local"):
			story_state.call("resolve_local", "chapter1_selection", "初来乍到·一日调查", "\n".join(event_log), accumulated_resources, accumulated_growth, "chapter1_map", "hidden_wheel", accumulated_relationships, accumulated_npc_flags, accumulated_story_flags, accumulated_inventory)
		await get_tree().create_timer(0.15).timeout
		UI.navigate(self, "res://scenes/story/settlement.tscn")
		return
	slot_index += 1
	result_ready = false
	_update_time_ui()
	_set_action("观察")
	_play_time_transition()
	confirming = false
	if enter != null:
		enter.disabled = false
		var enter_label := enter.get_node_or_null("Label") as Label
		if enter_label != null: enter_label.text = "确认行动"

func _resolve_hidden_wheel() -> Dictionary:
	var slot := time_slots[slot_index]
	var action_data: Dictionary = ((interaction.get("actions", {}) as Dictionary).get(selected_action, {}) as Dictionary)
	var outcomes: Dictionary = action_data.get("outcomes", {}) as Dictionary
	if outcomes.has(slot): return (outcomes[slot] as Dictionary).duplicate(true)
	match selected_action:
		"观察": return {"text":"你发现便利店玻璃上的倒影慢了半拍。异常被记录。", "resources":{"xp":5, "stability":-2}, "growth":{"悟性":1}}
		"交谈": return {"text":"店员提到昨夜有人在河岸看见黑色人影。你获得了第一条可靠线索。", "resources":{"money":-5, "xp":4}, "growth":{"咒力操纵":1}}
		"搜索": return {"text":"你在电线杆后发现淡淡残秽。远处的气息随即消失。", "resources":{"ce":-8, "xp":8, "stability":-3}, "growth":{"悟性":1, "咒力效率":1}}
		_: return {"text":"短暂休息让呼吸平稳下来，但陌生感仍未消失。", "resources":{"hp":8, "ce":8, "stability":5}, "growth":{"体质":1}}

func _resolve_action() -> Dictionary:
	if action_mode != "ai": return _resolve_hidden_wheel()
	var input := get_node_or_null("Print/Print") as TextEdit
	var prompt := input.text.strip_edges() if input != null else ""
	var context := {"node_id":"chapter1_selection", "slot":time_slots[slot_index], "action":selected_action, "prompt":prompt, "resources":state.duplicate(true), "growth":growth.duplicate(true)}
	var proposal: Dictionary = ai_provider.propose_event(context) as Dictionary if ai_provider != null and ai_provider.has_method("propose_event") else {}
	if bool(proposal.get("ok", false)) and proposal.get("outcome", {}) is Dictionary:
		var raw_outcome := proposal.get("outcome", {}) as Dictionary
		var story_state: Node = get_node_or_null("/root/StoryState")
		var clean_outcome: Dictionary = story_state.call("sanitize_story_ai_outcome", raw_outcome) as Dictionary if story_state != null and story_state.has_method("sanitize_story_ai_outcome") else {}
		if not clean_outcome.is_empty() and not str(clean_outcome.get("text", "")).is_empty():
			ai_last_status = "AI叙事已生成，数值由本地规则校验"
			return clean_outcome
		ai_last_status = "AI响应无效，已回退本地逻辑"
	ai_last_status = "AI不可用，已回退本地逻辑"
	return _resolve_hidden_wheel()

func _accumulate_outcome(outcome: Dictionary) -> void:
	var slot := time_slots[slot_index]
	event_log.append("【%s·%s】%s" % [slot, selected_action, str(outcome.get("text", "行动完成。"))])
	var resource_delta: Dictionary = outcome.get("resources", {}) as Dictionary
	for key: Variant in resource_delta:
		accumulated_resources[key] = int(accumulated_resources.get(key, 0)) + int(resource_delta[key])
		state[key] = maxi(0, int(state.get(key, 0)) + int(resource_delta[key]))
	var growth_delta: Dictionary = outcome.get("growth", {}) as Dictionary
	for key: Variant in growth_delta:
		accumulated_growth[key] = int(accumulated_growth.get(key, 0)) + int(growth_delta[key])
		growth[key] = maxi(0, int(growth.get(key, 0)) + int(growth_delta[key]))
	var relationship_delta: Dictionary = outcome.get("relationshipDelta", outcome.get("relationship_delta", {})) as Dictionary
	for npc_id: Variant in relationship_delta:
		var npc_delta: Dictionary = accumulated_relationships.get(str(npc_id), {}) as Dictionary
		for key: Variant in (relationship_delta[npc_id] as Dictionary): npc_delta[str(key)] = int(npc_delta.get(str(key), 0)) + int((relationship_delta[npc_id] as Dictionary)[key])
		accumulated_relationships[str(npc_id)] = npc_delta
	var flags_delta: Dictionary = outcome.get("npcFlags", outcome.get("npc_flags", {})) as Dictionary
	for npc_id: Variant in flags_delta:
		var npc_flags: Dictionary = accumulated_npc_flags.get(str(npc_id), {}) as Dictionary
		for key: Variant in (flags_delta[npc_id] as Dictionary): npc_flags[str(key)] = flags_delta[npc_id][key]
		accumulated_npc_flags[str(npc_id)] = npc_flags
	var story_flags_delta: Dictionary = outcome.get("storyFlags", outcome.get("story_flags", {})) as Dictionary
	for key: Variant in story_flags_delta:
		accumulated_story_flags[str(key)] = story_flags_delta[key]
	var inventory_delta: Dictionary = outcome.get("inventoryDelta", outcome.get("inventory_delta", {})) as Dictionary
	for key: Variant in inventory_delta:
		var item_id := str(key)
		accumulated_inventory[item_id] = int(accumulated_inventory.get(item_id, 0)) + int(inventory_delta[key])

func _update_time_ui() -> void:
	var time_label := get_node_or_null("Setting/Time") as Label
	if time_label != null: time_label.text = "时间：%s  %d/4" % [time_slots[slot_index], slot_index + 1]
	var title_label := get_node_or_null("Title/Label") as Label
	if title_label != null: title_label.text = "普通节点 · %s" % time_slots[slot_index]
	var background_path := str(background_by_slot.get(time_slots[slot_index], ""))
	var background := get_node_or_null("Background") as TextureRect
	if background != null and not background_path.is_empty() and ResourceLoader.exists(background_path):
		background.texture = load(background_path) as Texture2D

func _update_state_preview() -> void:
	var money_label := get_node_or_null("TextureRect/Control/Money/Label") as Label
	if money_label != null: money_label.text = str(state.get("money", 0))
	for key: String in ["Hp", "CE", "Exp", "Stability"]:
		var label := get_node_or_null("TextureRect/Control/" + key) as Label
		if label != null:
			var state_key: String = {"Hp":"hp", "CE":"ce", "Exp":"xp", "Stability":"stability"}[key]
			label.tooltip_text = "%s：%d" % [key, int(state.get(state_key, 0))]
func _play_time_transition() -> void:
	return

func _to_map() -> void:
	UI.navigate(self, "res://scenes/story/Map.tscn")

func _show_ai_status() -> void:
	var input := get_node_or_null("Print/Print") as TextEdit
	if input != null:
		input.placeholder_text = "输入你想做的事；AI不可用时会自动使用本地逻辑。"
		input.tooltip_text = "AI仅影响普通节点；核心节点仍必须手动选择。"

func _bind_buttons(node: Node) -> void:
	if node is BaseButton:
		var button := node as BaseButton
		if not button.has_meta("selection_bound"):
			button.set_meta("selection_bound", true)
			if button.name == "SelectView": button.pressed.connect(_set_action.bind("观察"))
			elif button.name == "SelectFight": button.pressed.connect(_set_action.bind("交谈"))
			elif button.name == "SelectFight2": button.pressed.connect(_set_action.bind("搜索"))
			elif button.name == "SelectFight3": button.pressed.connect(_set_action.bind("休息"))
	for child in node.get_children(): _bind_buttons(child)
