extends Control
class_name RpgFlow

const UI: Script = preload("res://ui/ClientUi.gd")
const PAGE_ENTRANCE: Script = preload("res://ui/PageEntrance.gd")
const BACKGROUNDS: Array[String] = [
	"res://art/Story/RPG/初始背景/1.png",
	"res://art/Story/RPG/初始背景/2.png",
	"res://art/Story/RPG/初始背景/3.png",
	"res://art/Story/RPG/初始背景/4.png",
	"res://art/Story/RPG/初始背景/5.png",
	"res://art/Story/RPG/初始背景/6.png"
]
const GLASS_SOUND: String = "res://assets/audio/story/glass_shatter.wav"
var line_index := 0
var page_index := 0
var choice_visible := false
var node_id := "chapter1_intro"
var lines: Array[Dictionary] = []
var choices: Array[Dictionary] = []
var background_paths: Array[String] = []
var text_tween: Tween
var resolving_choice := false

const LINES: Array[Dictionary] = [
	{"speaker":"旁白", "text":"“iivv老师，请留下您的签名！”\n签名会的长队终于有了尽头。"},
	{"speaker":"旁白", "text":"你走到桌前，正要说出想了一个月的神人语句。"},
	{"speaker":"芥见下下", "text":"这个不错。"},
	{"speaker":"旁白", "text":"他的目光扫过你的签名本。下一刻，额头上那道缝合痕迹映入眼底。"},
	{"speaker":"旁白", "text":"“等下，我要立下束缚……”\n视野被白光吞没。"},
	{"speaker":"旁白", "text":"你站在陌生的日本街道。路牌上的文字自动变得清晰：仙台市。"},
	{"speaker":"旁白", "text":"记忆断片。只要试图想起‘咒术回战’，头部就会剧烈疼痛。"},
	{"speaker":"旁白", "text":"手里的签名本仍在，但那四个字像被某种力量锁住。"}
]
const CLUE_LINES: Array[Dictionary] = [
	{"speaker":"旁白", "text":"夜色压在仙台郊外。签名本的纸页无风自动翻动。"},
	{"speaker":"旁白", "text":"河岸方向传来一声短促的撞击，残秽像潮水一样贴着路面退去。"},
	{"speaker":"？？？", "text":"如果你能看见它，就别再往前走了。"},
	{"speaker":"旁白", "text":"黑影从护栏下抬起头。你必须决定：追上去，还是先确认自己的力量。"}
]

func _ready() -> void:
	UI.bind_button_feedback(self)
	_bind_buttons(self)
	if not UI.reduced_motion(): PAGE_ENTRANCE.play(self, ["Text"], false)
	var state: Node = get_node_or_null("/root/StoryState")
	node_id = str(state.get("current_node")) if state != null else "chapter1_intro"
	var definition: Dictionary = state.call("node_definition", node_id) as Dictionary if state != null and state.has_method("node_definition") else {}
	background_paths = _background_paths(definition)
	_apply_background(0)
	if not (definition.get("rpgLines", []) as Array).is_empty():
		lines.assign(definition.get("rpgLines", []))
	else:
		lines = LINES
	var dialogue_npc := str(definition.get("npcDialogue", ""))
	if not dialogue_npc.is_empty() and state != null and state.has_method("npc_dialogue"):
		for raw_line: Variant in state.call("npc_dialogue", dialogue_npc) as Array:
			if raw_line is Dictionary: lines.append((raw_line as Dictionary).duplicate(true))
	choices.assign(_available_choices(definition.get("choices", []) as Array, state))
	_render_line()
	if state != null:
		state.call("mark_flag", "rpg_clue_seen" if node_id == "chapter1_clue" else ("core_%s_seen" % node_id if bool(definition.get("critical", false)) else "rpg_intro_seen"), true)

func _render_line() -> void:
	var line := lines[mini(line_index, lines.size() - 1)]
	var speaker: Label = get_node_or_null("Text/Speaker/Label") as Label
	var body: RichTextLabel = get_node_or_null("Text/Taxt") as RichTextLabel
	if speaker != null: speaker.text = str(line.get("speaker", "旁白"))
	if body != null:
		body.text = "    " + str(line.get("text", ""))
		if text_tween != null and text_tween.is_valid(): text_tween.kill()
		if UI.reduced_motion(): body.visible_ratio = 1.0
		else:
			body.visible_ratio = 0.0
			text_tween = create_tween()
			text_tween.tween_property(body, "visible_ratio", 1.0, clampf(body.text.length() * 0.018, 0.35, 1.5))
	var next: BaseButton = get_node_or_null("Text/TextureButton") as BaseButton
	var c1: BaseButton = get_node_or_null("Text/Choose1") as BaseButton
	var c2: BaseButton = get_node_or_null("Text/Choose2") as BaseButton
	choice_visible = line_index == lines.size() - 1
	if c1 != null: c1.visible = choice_visible
	if c2 != null: c2.visible = choice_visible and choices.size() != 1
	var fight1 := get_node_or_null("Text/Choose1/IfFight") as Control
	var fight2 := get_node_or_null("Text/Choose2/IfFight") as Control
	if fight1 != null: fight1.visible = choice_visible and _choice_has_battle(0)
	if fight2 != null: fight2.visible = choice_visible and _choice_has_battle(1)
	if next != null: next.visible = not choice_visible
	if c1 != null: (c1.get_node_or_null("Label") as Label).text = _choice_label(0, "追入河岸" if node_id == "chapter1_clue" else "接受陌生世界") if choice_visible else ""
	if c2 != null: (c2.get_node_or_null("Label") as Label).text = _choice_label(1, "先调息备战" if node_id == "chapter1_clue" else "先隐藏身份") if choice_visible else ""
	var section: Label = get_node_or_null("Section/Label") as Label
	if section != null:
		var section_definition: Dictionary = get_node_or_null("/root/StoryState").call("node_definition", node_id) as Dictionary if get_node_or_null("/root/StoryState") != null else {}
		var section_title := str(section_definition.get("sectionTitle", ""))
		if section_title.is_empty() and node_id.begins_with("core_"):
			var wheel_id := int(section_definition.get("sourceWheelId", 0))
			section_title = "核心剧情盘·W%s" % str(wheel_id) if wheel_id > 0 else "核心剧情盘·世界状态收敛"
		section.text = section_title if not section_title.is_empty() else ("第一幕·河岸残秽" if node_id == "chapter1_clue" else "第一幕·咒术回战？")

func _choice_label(index: int, fallback: String) -> String:
	if index < choices.size(): return str(choices[index].get("label", fallback))
	return fallback

func _choice_has_battle(index: int) -> bool:
	return index >= 0 and index < choices.size() and not str(choices[index].get("battleNode", "")).is_empty()

func _available_choices(raw_choices: Array, state: Node) -> Array[Dictionary]:
	var available: Array[Dictionary] = []
	var story_flags: Dictionary = state.get("flags") as Dictionary if state != null else {}
	var current_resources: Dictionary = state.get("resources") as Dictionary if state != null else {}
	var current_growth: Dictionary = state.get("growth") as Dictionary if state != null else {}
	for raw: Variant in raw_choices:
		if not raw is Dictionary: continue
		var choice := raw as Dictionary
		var allowed := true
		for required: Variant in (choice.get("requiresFlags", []) as Array):
			if not bool(story_flags.get(str(required), false)):
				allowed = false
				break
		if not allowed: continue
		for blocked: Variant in (choice.get("excludesFlags", []) as Array):
			if bool(story_flags.get(str(blocked), false)):
				allowed = false
				break
		if not allowed: continue
		for key: Variant in (choice.get("minResources", {}) as Dictionary):
			if int(current_resources.get(str(key), 0)) < int((choice.get("minResources", {}) as Dictionary)[key]):
				allowed = false
				break
		if not allowed: continue
		for key: Variant in (choice.get("minGrowth", {}) as Dictionary):
			if int(current_growth.get(str(key), 0)) < int((choice.get("minGrowth", {}) as Dictionary)[key]):
				allowed = false
				break
		if allowed: available.append(choice.duplicate(true))
	return available

func _next_line() -> void:
	var next: BaseButton = get_node_or_null("Text/TextureButton") as BaseButton
	if next != null: UI.pulse(next)
	var body := get_node_or_null("Text/Taxt") as RichTextLabel
	if body != null and body.visible_ratio < 0.99:
		if text_tween != null and text_tween.is_valid(): text_tween.kill()
		body.visible_ratio = 1.0
		return
	line_index += 1
	if line_index >= lines.size(): line_index = lines.size() - 1
	if page_index < background_paths.size() - 1 and line_index >= 1:
		page_index = mini(page_index + 1, background_paths.size() - 1)
		_apply_background(page_index)
	_render_line()

func _background_paths(definition: Dictionary) -> Array[String]:
	var result: Array[String] = []
	var sequence: Array = definition.get("backgroundSequence", []) as Array
	for raw: Variant in sequence:
		if ResourceLoader.exists(str(raw)): result.append(str(raw))
	if result.is_empty():
		var single := str(definition.get("background", ""))
		if not single.is_empty() and ResourceLoader.exists(single): result.append(single)
	if result.is_empty(): result.assign(BACKGROUNDS)
	return result

func _apply_background(index: int) -> void:
	var bg := get_node_or_null("BackGround") as TextureRect
	if bg == null or background_paths.is_empty(): return
	bg.texture = load(background_paths[clampi(index, 0, background_paths.size() - 1)]) as Texture2D

func _choose(choice: String) -> void:
	_choose_index(0 if choice == "accept" else 1)

func _choose_index(choice_index: int) -> void:
	if resolving_choice: return
	if choice_index < 0 or choice_index > 1 or choice_index >= choices.size(): return
	resolving_choice = true
	_set_choice_buttons_enabled(false)
	var choice := "accept" if choice_index == 0 else ("hide" if choice_index == 1 else "option_%d" % choice_index)
	var button: BaseButton = get_node_or_null("Text/Choose1" if choice_index == 0 else ("Text/Choose2" if choice_index == 1 else "Text/ChoiceExtra%d" % choice_index)) as BaseButton
	if button != null: UI.pulse(button)
	if node_id == "chapter1_intro": _play_glass_sound()
	var tween := create_tween()
	tween.tween_callback(func() -> void:
		var state: Node = get_node_or_null("/root/StoryState")
		if state != null:
			var definition: Dictionary = state.call("node_definition", node_id) as Dictionary
			if node_id.begins_with("core_") and str(definition.get("type", "")) != "random":
				if choice_index >= choices.size():
					UI.notice(self, "核心节点配置错误", "原剧情盘没有提供该选项，无法继续。"); return
				var selected: Dictionary = choices[choice_index]
				var battle_node := str(selected.get("battleNode", ""))
				var selected_next := battle_node if not battle_node.is_empty() else str(selected.get("next", node_id))
				state.call("resolve_core_choice", node_id, str((state.call("node_definition", node_id) as Dictionary).get("title", "核心剧情节点")), int((state.call("node_definition", node_id) as Dictionary).get("sourceWheelId", 0)), str(selected.get("id", "")), str(selected.get("value", "")), str(selected.get("text", "")), selected_next, selected.get("resources", selected.get("resourceDelta", {})) as Dictionary, selected.get("growth", selected.get("growthDelta", {})) as Dictionary, selected.get("relationshipDelta", {}) as Dictionary, selected.get("npcFlags", {}) as Dictionary, selected.get("storyFlags", {}) as Dictionary, selected.get("inventoryDelta", {}) as Dictionary)
				if not battle_node.is_empty():
					state.call("commit_pending")
					state.call("begin_node", battle_node)
					UI.navigate(self, "res://scenes/battle/battle_scene.tscn")
					return
				UI.navigate(self, "res://scenes/story/settlement.tscn")
				return
			if str(definition.get("type", "")) in ["random", "branch"]:
				_resolve_generic_node(state, definition, choice_index)
				return
			if choice_index >= choices.size():
				UI.notice(self, "节点配置错误", "当前剧情节点没有可用选项。")
				return
			var selected: Dictionary = choices[choice_index].duplicate(true)
			state.call("mark_flag", "rpg_choice", str(selected.get("id", choice)))
			state.call("resolve_local", node_id, str(definition.get("title", "剧情节点")), str(selected.get("text", "本次选择已记录。")), selected.get("resources", selected.get("resourceDelta", {})) as Dictionary, selected.get("growth", selected.get("growthDelta", {})) as Dictionary, str(selected.get("next", definition.get("next", node_id))), "story_choice", selected.get("relationshipDelta", {}) as Dictionary, selected.get("npcFlags", {}) as Dictionary, selected.get("storyFlags", {}) as Dictionary)
		if node_id == "chapter1_intro":
			# The opening choice intentionally flows straight into the four time-slot
			# investigation instead of showing a settlement page. Commit it here so
			# Selection can own a fresh pending result and unlock the map afterwards.
			state.call("commit_pending")
			UI.navigate(self, "res://scenes/story/selection.tscn")
		else: UI.navigate(self, "res://scenes/story/settlement.tscn")
	)

func _set_choice_buttons_enabled(enabled: bool) -> void:
	for path: String in ["Text/Choose1", "Text/Choose2"]:
		var button := get_node_or_null(path) as BaseButton
		if button != null: button.disabled = not enabled

func _resolve_generic_node(state: Node, definition: Dictionary, choice_index: int) -> void:
	var selected: Dictionary = {}
	var resolution_source := "branch"
	if str(definition.get("type", "")) == "random":
		resolution_source = "hidden_wheel"
		var outcomes: Array = definition.get("outcomes", []) as Array
		var total_weight := 0
		var flags_snapshot: Dictionary = state.get("flags") as Dictionary
		for raw: Variant in outcomes:
			if raw is Dictionary: total_weight += _outcome_weight(raw as Dictionary, flags_snapshot)
		if total_weight <= 0 or outcomes.is_empty():
			UI.notice(self, "隐式转盘配置错误", "当前普通事件没有可抽取结果。")
			return
		var history: Array = state.get("history") as Array
		var resources: Dictionary = state.get("resources") as Dictionary
		var run_seed := int(state.get("run_seed")) if state.get("run_seed") != null else 0
		var roll := absi(hash("%s:%d:%d:%d" % [str(definition.get("id", node_id)), run_seed, history.size(), int(resources.get("xp", 0))])) % total_weight
		for raw: Variant in outcomes:
			if not raw is Dictionary: continue
			var outcome := raw as Dictionary
			roll -= _outcome_weight(outcome, flags_snapshot)
			if roll < 0:
				selected = outcome.duplicate(true)
				break
	else:
		var available: Array = choices
		if choice_index < 0 or choice_index >= available.size(): return
		selected = (available[choice_index] as Dictionary).duplicate(true)
	if selected.is_empty(): return
	var resource_delta: Dictionary = selected.get("resources", selected.get("resourceDelta", {})) as Dictionary
	var growth_delta: Dictionary = selected.get("growth", selected.get("growthDelta", {})) as Dictionary
	var relationship_delta: Dictionary = selected.get("relationshipDelta", {}) as Dictionary
	var npc_flags: Dictionary = selected.get("npcFlags", {}) as Dictionary
	var story_flags: Dictionary = selected.get("storyFlags", {}) as Dictionary
	var inventory_delta: Dictionary = selected.get("inventoryDelta", {}) as Dictionary
	var next_node := str(selected.get("next", definition.get("next", node_id)))
	var title := str(selected.get("title", "%s·%s" % [str(definition.get("title", "普通节点")), str(selected.get("value", "行动"))]))
	var result_text := str(selected.get("text", "本次行动已记录。"))
	state.call("resolve_local", node_id, title, result_text, resource_delta, growth_delta, next_node, resolution_source, relationship_delta, npc_flags, story_flags, inventory_delta)
	UI.navigate(self, "res://scenes/story/settlement.tscn")

func _outcome_weight(outcome: Dictionary, story_flags: Dictionary) -> int:
	var weight := maxi(0, int(outcome.get("weight", 0)))
	var modifiers: Dictionary = outcome.get("weightByFlag", {}) as Dictionary
	for flag: Variant in modifiers:
		if bool(story_flags.get(str(flag), false)):
			weight += int(modifiers[flag])
	return maxi(0, weight)

func _skip() -> void:
	var state: Node = get_node_or_null("/root/StoryState")
	var definition: Dictionary = state.call("node_definition", node_id) as Dictionary if state != null and state.has_method("node_definition") else {}
	if str(definition.get("type", "")) in ["random", "branch"]:
		UI.notice(self, "节点需要完成选择", "随机事件必须完成隐式转盘，分支节点必须由玩家确认行动。")
		return
	if node_id.begins_with("core_"):
		UI.notice(self, "核心节点不可跳过", "W145 的结果必须由玩家亲自选择，AI和跳过操作都不能代替核心剧情决定。")
		return
	if state != null:
		state.call("mark_flag", "rpg_skipped", true)
		if node_id == "chapter1_clue": state.call("resolve_local", "chapter1_clue", "残秽与黑影", "你跳过调查，直接面对河岸的异常。", {}, {}, "chapter1_battle", "story_skip")
	if node_id == "chapter1_intro": UI.navigate(self, "res://scenes/story/selection.tscn")
	else: UI.navigate(self, "res://scenes/story/settlement.tscn")

func _play_glass_sound() -> void:
	if not ResourceLoader.exists(GLASS_SOUND): return
	var player := AudioStreamPlayer.new()
	player.name = "GlassTransitionFallback"
	player.stream = load(GLASS_SOUND) as AudioStream
	player.finished.connect(player.queue_free, CONNECT_ONE_SHOT)
	add_child(player)
	player.play()

func _bind_buttons(node: Node) -> void:
	if node is BaseButton:
		var button := node as BaseButton
		if not button.has_meta("rpg_bound"):
			button.set_meta("rpg_bound", true)
			if button.name == "TextureButton": button.pressed.connect(_next_line)
			elif button.name == "Choose1": button.pressed.connect(_choose.bind("accept"))
			elif button.name == "Choose2": button.pressed.connect(_choose.bind("hide"))
			elif button.name == "Skip": button.pressed.connect(_skip)
	for child in node.get_children(): _bind_buttons(child)
