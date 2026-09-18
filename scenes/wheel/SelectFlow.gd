extends Control
class_name SelectFlow

const UI: Script = preload("res://ui/ClientUi.gd")
const PAGE_ENTRANCE: Script = preload("res://ui/PageEntrance.gd")

func _ready() -> void:
	UI.bind_button_feedback(self)
	_bind_buttons(self)
	_render_character()
	if not UI.reduced_motion(): PAGE_ENTRANCE.play(self)
	var story: BaseButton = get_node_or_null("TextureButton") as BaseButton
	var wheel: BaseButton = get_node_or_null("Wheel") as BaseButton
	if story != null: story.pressed.connect(_open_story)
	if wheel != null: wheel.pressed.connect(_open_wheel)

func _open_story() -> void:
	UI.navigate(self, "res://scenes/story/StroyHome.tscn")

func _open_wheel() -> void:
	UI.navigate(self, "res://scenes/wheel/wheel.tscn")

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
		if not button.has_meta("select_pulse_bound"):
			button.set_meta("select_pulse_bound", true)
	for child in node.get_children(): _bind_buttons(child)
