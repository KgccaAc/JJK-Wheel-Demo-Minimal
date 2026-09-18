extends Control
class_name IdentityFlow

const UI: Script = preload("res://ui/ClientUi.gd")
const PAGE_ENTRANCE: Script = preload("res://ui/PageEntrance.gd")
const RATING_DIR := "res://art/wheel/角色认定/评级印章/"
const SHADOW_DIR := "res://art/wheel/角色认定/"

func _ready() -> void:
	UI.bind_button_feedback(self)
	_bind_buttons(self)
	var story_state: Node = get_node_or_null("/root/StoryState")
	if story_state != null and story_state.has_method("begin_from_identity") and (story_state.get("character") as Dictionary).is_empty():
		var session: Node = get_node_or_null("/root/AppSession")
		var snapshot: Dictionary = session.get_value("wheel_rank", {}) as Dictionary if session != null and session.has_method("get_value") else {}
		if snapshot.is_empty():
			var name_label := get_node_or_null("CharacterCard/Name") as Label
			snapshot = {"name": name_label.text if name_label != null else "旅人", "period": "剧情开始时期"}
		story_state.call("begin_from_identity", snapshot)
	_render_snapshot()
	if not UI.reduced_motion():
		PAGE_ENTRANCE.play(self)
		_play_stamp()
	var next: BaseButton = get_node_or_null("Next") as BaseButton
	if next != null:
		next.pressed.connect(_go_select)
	var save: BaseButton = get_node_or_null("Save") as BaseButton
	if save != null:
		save.tooltip_text = "保存当前角色卡"
		save.pressed.connect(_save_character)
	var restart: BaseButton = get_node_or_null("Restart") as BaseButton
	if restart != null:
		restart.tooltip_text = "返回转盘重新抽取"
		restart.pressed.connect(_restart)

func _go_select() -> void:
	var next: BaseButton = get_node_or_null("Next") as BaseButton
	if next != null: UI.pulse(next)
	var story_state: Node = get_node_or_null("/root/StoryState")
	if story_state == null or (story_state.get("character") as Dictionary).is_empty():
		UI.notice(self, "角色数据不完整", "请返回转盘完成角色判定。")
		return
	UI.navigate(self, "res://scenes/wheel/Select.tscn")

func _save_character() -> void:
	var story_state: Node = get_node_or_null("/root/StoryState")
	if story_state != null and bool(story_state.call("save")): UI.notice(self, "角色已保存", "角色快照和故事初始状态已保存到本地。")
	else: UI.notice(self, "保存失败", "无法写入本地角色存档。")

func _restart() -> void:
	var story_state: Node = get_node_or_null("/root/StoryState")
	if story_state != null: story_state.call("clear_run")
	UI.navigate(self, "res://scenes/wheel/wheel.tscn")

func _render_snapshot() -> void:
	var session: Node = get_node_or_null("/root/AppSession")
	var snapshot: Dictionary = session.get_value("wheel_rank", {}) as Dictionary if session != null and session.has_method("get_value") else {}
	if snapshot.is_empty():
		var story_state: Node = get_node_or_null("/root/StoryState")
		if story_state != null: snapshot = (story_state.get("character") as Dictionary).duplicate(true)
	if snapshot.is_empty(): return
	var stats: Dictionary = snapshot.get("stats", snapshot.get("baseStats", {})) as Dictionary
	var answers: Dictionary = snapshot.get("answers", snapshot.get("sourceAnswers", {})) as Dictionary
	var display_name := str(snapshot.get("displayName", "转盘角色 · %s" % str(snapshot.get("grade_label", "未定"))))
	_set_text("CharacterCard/Name", display_name)
	_set_text("CharacterCard/Sex", str(answers.get("gender", "未记录")))
	var age_text := str(answers.get("age", ""))
	_set_text("CharacterCard/Age", "%s岁" % age_text if not age_text.is_empty() else "年龄未知")
	_set_text("CharacterCard/Time", str(answers.get("startTime", "剧情开始时期")))
	_set_text("CharacterCard/Camp", _camp_text(snapshot, answers))
	_set_text("Identity/IdentityLabel/Identity", str(answers.get("identity", "身份未定")))
	_set_text("Identity/Technicalabel/Technical", str(answers.get("familyInnateTechnique", answers.get("innateTechnique", "无术式"))))
	_set_text("Identity/DomainLabel/Domain", str(answers.get("domainCompletion", "尚未展开")))
	_set_text("Identity/NameLabel/Name", display_name)
	_set_text("Identity/TimeLabel/Time", str(answers.get("startTime", "剧情开始时期")))
	_set_text("Identity/LocationLabel/Location", str(answers.get("location", "日本")))
	_set_text("Identity/CampLabel/Camp", _camp_text(snapshot, answers, "无所属"))
	var grade := get_node_or_null("Level")
	if grade is TextureRect:
		var label := get_node_or_null("Level/Label") as Label
		if label != null: label.text = str(snapshot.get("grade_label", snapshot.get("grade", "未定")))
		var rating_path := _rating_path(snapshot, answers)
		if ResourceLoader.exists(rating_path): grade.texture = load(rating_path) as Texture2D
	var stat_paths := {"cursedEnergy":"Attribute/Control/CeMax/Value", "control":"Attribute/Control/CeMax2/Value", "efficiency":"Attribute/Control/CeMax3/Value", "body":"Attribute/Control/CeMax4/Value", "martial":"Attribute/Control/CeMax5/Value", "talent":"Attribute/Control/CeMax6/Value"}
	for key: String in stat_paths:
		if stats.has(key): _set_text(str(stat_paths[key]), str(stats[key]))
	_set_text("Report/Special/Special", _traits_text(snapshot, answers))
	_set_text("Report/Special2/Special", _tools_text(snapshot, answers))
	_set_shadow(snapshot, answers)
	_set_tag_texts(_ordinary_tags(snapshot, answers))
	_set_layout_safety()

func _rating_path(snapshot: Dictionary, answers: Dictionary) -> String:
	var raw := str(snapshot.get("grade_label", snapshot.get("gradeLabel", snapshot.get("grade", answers.get("grade", "E")))))
	var lower := raw.to_lower()
	var key := "E"
	if raw.to_upper() in ["A","B","C","D","E","S","SS","SSS","EX","EX-"]: key = raw.to_upper()
	elif lower.contains("特级") or lower.contains("special") or lower.contains("领域"):
		key = "EX"
	elif lower.contains("一级") or lower.contains("一"):
		key = "A"
	elif lower.contains("二级") or lower.contains("二"): key = "B"
	elif lower.contains("三级") or lower.contains("三"): key = "C"
	elif lower.contains("四级") or lower.contains("辅助"): key = "D"
	var candidate := RATING_DIR + key + ".png"
	return candidate if ResourceLoader.exists(candidate) else RATING_DIR + "E.png"

func _camp_text(snapshot: Dictionary, answers: Dictionary, fallback: String = "阵营未定") -> String:
	for key: String in ["camp", "faction", "greatFamily", "curseUserOrganization"]:
		var value := str(snapshot.get(key, answers.get(key, ""))).strip_edges()
		if not value.is_empty(): return value
	return fallback

func _collect_values(snapshot: Dictionary, answers: Dictionary, keys: Array[String]) -> Array[String]:
	var values: Array[String] = []
	for key: String in keys:
		var raw: Variant = snapshot.get(key, answers.get(key, null))
		if raw == null: continue
		if raw is Array:
			for item: Variant in raw:
				if item == null: continue
				var text := str(item).strip_edges()
				if not text.is_empty() and text not in ["null", "<null>", "[]"] and not values.has(text): values.append(text)
		else:
			var text := str(raw).strip_edges()
			if not text.is_empty() and text not in ["null", "<null>", "[]"] and not values.has(text): values.append(text)
	return values

func _traits_text(snapshot: Dictionary, answers: Dictionary) -> String:
	var values := _collect_values(snapshot, answers, ["traits", "specialTraits", "specialTalent", "cursedTraits", "personality"])
	var answer_values := _collect_values(answers, answers, ["sixEyes", "twoFaceFourArms", "heavenlyRestriction", "starPlasmaVessel", "simpleDomain"])
	for value: String in answer_values:
		if value not in values and value.to_lower() not in ["否", "无", "none"]: values.append(value)
	return "、".join(values) if not values.is_empty() else "特质尚待故事揭示"

func _tools_text(snapshot: Dictionary, answers: Dictionary) -> String:
	var values := _collect_values(snapshot, answers, ["cursedTools", "tools", "weapons", "equipment", "inventory"])
	var known := ["狱门疆", "神武解", "天逆鉾", "游云", "屠座魔", "黑绳"]
	for value: String in known:
		if str(snapshot).contains(value) or str(answers).contains(value):
			if value not in values: values.append(value)
	return "、".join(values) if not values.is_empty() else "无"

func _ordinary_tags(snapshot: Dictionary, answers: Dictionary) -> Array[String]:
	var result := _collect_values(snapshot, answers, ["hobbies", "hobby", "temperament", "temper", "habits", "personalityTags", "workEthic", "tags", "cardTags"])
	var excluded := ["术式", "领域", "咒力", "强度", "grade", "六眼", "两面四臂", "狱门疆", "神武解"]
	result = result.filter(func(value: String) -> bool:
		for token: String in excluded:
			if value.contains(token): return false
		return true)
	return result.slice(0, 4)

func _set_tag_texts(values: Array[String]) -> void:
	var paths := ["Tag/TechTag", "Tag/TechTag2", "Tag/TechTag3", "Tag/TechTag4"]
	for index: int in paths.size():
		var panel := get_node_or_null(paths[index]) as Control
		if panel == null: continue
		var label := panel.get_node_or_null("Label") as Label
		if label == null: continue
		label.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
		label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
		label.add_theme_font_size_override("font_size", 17)
		label.add_theme_color_override("font_color", Color(0.18, 0.12, 0.1, 1))
		label.text = values[index] if index < values.size() else ""
		panel.visible = index < values.size()

func _set_shadow(snapshot: Dictionary, answers: Dictionary) -> void:
	var picture := get_node_or_null("CharacterCard/Picture") as TextureRect
	if picture == null: return
	var gender := str(snapshot.get("gender", answers.get("gender", ""))).to_lower()
	var age_text := str(snapshot.get("age", answers.get("age", ""))).to_lower()
	var age := -1
	for token: String in age_text.split(" "):
		if token.is_valid_int(): age = int(token); break
	var file := "男剪影.png"
	if age >= 0 and age < 14: file = "小孩剪影.png"
	elif gender.contains("女") or gender.contains("female"):
		file = "少女剪影.png" if age < 30 or age < 0 else "熟女剪影.png"
	elif age >= 55: file = "老头剪影.png"
	var path := SHADOW_DIR + file
	if ResourceLoader.exists(path): picture.texture = load(path) as Texture2D

func _set_layout_safety() -> void:
	var card_name := get_node_or_null("CharacterCard/Name") as Label
	if card_name != null:
		card_name.position = Vector2(64.0, 476.0)
		card_name.size = Vector2(360.0, 59.0)
		card_name.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		card_name.autowrap_mode = TextServer.AUTOWRAP_OFF
		card_name.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	var age := get_node_or_null("CharacterCard/Age") as Label
	var time := get_node_or_null("CharacterCard/Time") as Label
	if age != null:
		age.position = Vector2(25.0, 582.0)
		age.size = Vector2(220.0, 30.0)
		age.autowrap_mode = TextServer.AUTOWRAP_OFF
		age.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
		time = get_node_or_null("CharacterCard/Time") as Label
	if time != null:
		time.position = Vector2(285.0, 582.0)
		time.size = Vector2(180.0, 30.0)
		time.autowrap_mode = TextServer.AUTOWRAP_OFF
		time.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	for path: String in ["CharacterCard/Name", "CharacterCard/Age", "CharacterCard/Time", "CharacterCard/Camp", "Identity/NameLabel/Name", "Identity/TimeLabel/Time", "Identity/CampLabel/Camp", "Report/Special/Special", "Report/Special2/Special"]:
		var label := get_node_or_null(path) as Label
		if label == null: continue
		label.clip_text = true
		label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
		if path.contains("Name") or path.contains("Special"): label.add_theme_font_size_override("font_size", 20 if path.contains("Special") else 30)

func _set_text(path: String, value: String) -> void:
	var label := get_node_or_null(path) as Label
	if label != null and not value.is_empty(): label.text = value

func _play_stamp() -> void:
	var stamp := get_node_or_null("Level") as Control
	if stamp == null: return
	var base := stamp.scale
	stamp.pivot_offset = stamp.size * 0.5
	stamp.scale = base * 1.35
	stamp.modulate.a = 0.0
	var tween := create_tween().set_parallel(true)
	tween.tween_property(stamp, "scale", base, 0.28).set_delay(0.18).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	tween.tween_property(stamp, "modulate:a", 1.0, 0.12).set_delay(0.18)

func _bind_buttons(node: Node) -> void:
	if node is BaseButton:
		var button := node as BaseButton
		if not button.has_meta("identity_pulse_bound"):
			button.set_meta("identity_pulse_bound", true)
	for child in node.get_children(): _bind_buttons(child)
