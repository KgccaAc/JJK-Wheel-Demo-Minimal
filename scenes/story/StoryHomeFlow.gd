extends Control
class_name StoryHomeFlow

const UI: Script = preload("res://ui/ClientUi.gd")
const PAGE_ENTRANCE: Script = preload("res://ui/PageEntrance.gd")
var difficulty := "story"
var mode := "basic"
const DIFF_NORMAL := "res://art/Story/故事难度选择按钮未选中.png"
const DIFF_SELECTED := "res://art/Story/故事难度选择按钮已选中.png"

func _ready() -> void:
	UI.bind_button_feedback(self)
	_bind_buttons(self)
	_connect_navigation()
	_render_character()
	if not UI.reduced_motion(): PAGE_ENTRANCE.play(self)
	var start: BaseButton = get_node_or_null("Start") as BaseButton
	var back: BaseButton = get_node_or_null("Start2") as BaseButton
	if start != null: start.pressed.connect(_start_story)
	if back != null: back.pressed.connect(func() -> void: UI.navigate(self, "res://scenes/wheel/Select.tscn"))
	var easy: BaseButton = get_node_or_null("HardSelect/Easy") as BaseButton
	var normal: BaseButton = get_node_or_null("HardSelect/Normal") as BaseButton
	var hard: BaseButton = get_node_or_null("HardSelect/Hard") as BaseButton
	if easy != null: easy.pressed.connect(func() -> void: _set_difficulty("story"))
	if normal != null: normal.pressed.connect(func() -> void: _locked_difficulty(normal))
	if hard != null: hard.pressed.connect(func() -> void: _locked_difficulty(hard))
	var basic: BaseButton = get_node_or_null("Type/Basic") as BaseButton
	var ai: BaseButton = get_node_or_null("Type/Ai") as BaseButton
	if basic != null: basic.pressed.connect(func() -> void: mode = "basic"; _refresh_mode_visuals())
	if ai != null: ai.pressed.connect(func() -> void: _set_mode("ai"))
	_set_difficulty("story")
	_refresh_mode_visuals()
	var state: Node = get_node_or_null("/root/StoryState")
	if state != null and not (state.get("history") as Array).is_empty():
		var start_label := get_node_or_null("Start/Label") as Label
		if start_label != null: start_label.text = "继续故事"
	_update_chapter_label(state)
	var story_nav := get_node_or_null("Background/BottomNav")
	if story_nav != null: story_nav.call("select", 3)

func _connect_navigation() -> void:
	var nav := get_node_or_null("Background/BottomNav") as Node
	if nav != null:
		var routes := {
			"HomeButton":"res://scenes/home/home.tscn",
			"CharacterButton":"res://scenes/roster/roster_picker.tscn",
			"BattleButton":"res://scenes/battle/battle_scene.tscn",
			"ForumButton":"res://scenes/community/community.tscn",
			"ArchiveButton":"res://scenes/online/online_room.tscn"
		}
		for button_name: String in routes:
			var button := nav.get_node_or_null(button_name) as BaseButton
			if button != null and not button.has_meta("story_home_route_bound"):
				button.set_meta("story_home_route_bound", true)
				button.pressed.connect(UI.navigate.bind(self, str(routes[button_name])))
	var more := get_node_or_null("Background/Header/MoreButton") as BaseButton
	if more != null and not more.has_meta("story_home_more_bound"):
		more.set_meta("story_home_more_bound", true)
		more.pressed.connect(UI.show_settings.bind(self))
	var user := get_node_or_null("Background/Header/UserButton") as BaseButton
	if user != null and not user.has_meta("story_home_user_bound"):
		user.set_meta("story_home_user_bound", true)
		user.pressed.connect(UI.open_user_panel.bind(self))

func _update_chapter_label(state: Node) -> void:
	var label := get_node_or_null("Chapter/Cheaper") as Label
	if label == null or state == null: return
	var history: Array = state.get("history") as Array
	if history.is_empty():
		label.text = "未开始"
		return
	var current := str(state.get("current_node"))
	if bool((state.get("flags") as Dictionary).get("chapter1_end", false)) or current == "chapter1_end":
		label.text = "第一章·仙台的异乡人"
		return
	var definition: Dictionary = state.call("node_definition", current) as Dictionary if state.has_method("node_definition") else {}
	label.text = str(definition.get("title", "第一章·仙台的异乡人"))

func _start_story() -> void:
	var start: BaseButton = get_node_or_null("Start") as BaseButton
	if start != null: UI.pulse(start)
	var state: Node = get_node_or_null("/root/StoryState")
	if state == null or (state.get("character") as Dictionary).is_empty():
		UI.notice(self, "尚未完成角色判定", "请先通过转盘生成角色，再开始故事。")
		return
	if state != null and state.has_method("configure_story"): state.call("configure_story", difficulty, mode)
	if not (state.get("pending_result") as Dictionary).is_empty():
		UI.navigate(self, "res://scenes/story/settlement.tscn")
		return
	var current: String = str(state.get("current_node"))
	var destination := state.call("scene_for_node", current) as String if state != null and state.has_method("scene_for_node") else "res://scenes/story/RPG.tscn"
	if destination.is_empty(): destination = "res://scenes/story/RPG.tscn"
	UI.navigate(self, destination)

func _set_difficulty(value: String) -> void:
	difficulty = value
	for key: String in ["Easy", "Normal", "Hard"]:
		var button := get_node_or_null("HardSelect/" + key) as TextureButton
		if button != null: button.texture_normal = load(DIFF_SELECTED if key == "Easy" and value == "story" else DIFF_NORMAL) as Texture2D

func _refresh_mode_visuals() -> void:
	var basic := get_node_or_null("Type/Basic") as BaseButton
	var ai := get_node_or_null("Type/Ai") as BaseButton
	if basic != null: basic.modulate = Color.WHITE if mode == "basic" else Color(0.7, 0.7, 0.7, 1.0)
	if ai != null: ai.modulate = Color.WHITE if mode == "ai" else Color(0.7, 0.7, 0.7, 1.0)
	var ai_hint := get_node_or_null("Type/Ai/Hint") as Label
	if ai_hint != null: ai_hint.text = "AI仅影响普通节点，数值由本地规则校验" if mode == "ai" else "可选：普通节点使用AI描述"

func _set_mode(value: String) -> void:
	mode = "ai" if value == "ai" else "basic"
	_refresh_mode_visuals()

func _locked_difficulty(button: BaseButton) -> void:
	UI.pulse(button)
	UI.notice(self, "难度暂未开放", "第一章小样当前只开放故事模式。")

func _locked_ai(button: BaseButton) -> void:
	UI.pulse(button)
	_set_mode("ai")

func _render_character() -> void:
	var state: Node = get_node_or_null("/root/StoryState")
	if state == null: return
	var snapshot: Dictionary = state.get("character") as Dictionary
	var answers: Dictionary = snapshot.get("answers", snapshot.get("sourceAnswers", {})) as Dictionary
	var stats: Dictionary = snapshot.get("stats", snapshot.get("baseStats", {})) as Dictionary
	_set_text("CharacterTable/NameLabel/Name", str(snapshot.get("displayName", "转盘角色 · %s" % str(snapshot.get("grade_label", "未定")))))
	_set_text("CharacterTable/IdentityLabel/Identity", str(answers.get("identity", "身份未定")))
	_set_text("CharacterTable/Technicalabel/Technical", str(answers.get("familyInnateTechnique", answers.get("innateTechnique", "无术式"))))
	_set_text("CharacterTable/DomainLabel/Domain", str(answers.get("domainCompletion", "尚未展开")))
	var paths := {"cursedEnergy":"CeMax", "control":"CeControl", "martial":"BodyTech", "body":"Constitution", "efficiency":"CeEfficiency", "talent":"Insight"}
	for key: String in paths:
		if stats.has(key): _set_text("CharacterTable/CharacterValue/%s" % str(paths[key]), str(stats[key]))

func _set_text(path: String, value: String) -> void:
	var label := get_node_or_null(path) as Label
	if label != null and not value.is_empty(): label.text = value

func _bind_buttons(node: Node) -> void:
	if node is BaseButton:
		var button := node as BaseButton
		if not button.has_meta("story_home_pulse_bound"):
			button.set_meta("story_home_pulse_bound", true)
	for child in node.get_children(): _bind_buttons(child)
