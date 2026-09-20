extends Control

const UI: Script = preload("res://ui/ClientUi.gd")
const PAGE_ENTRANCE: Script = preload("res://ui/PageEntrance.gd")

const MENU_SCENE_PATH: String = "res://scenes/home/home.tscn"
const FIGHT_SCENE_PATH: String = "res://scenes/battle/battle_scene.tscn"
const ONLINE_ROOM_SCENE_PATH: String = "res://scenes/online/online_room.tscn"
const USER_SCENE_PATH: String = "res://scenes/profile/profile_page.tscn"
const DATA_REPOSITORY_SCRIPT: Script = preload("res://battle/data/BattleDataRepository.gd")
const PROFILE_BUILDER_SCRIPT: Script = preload("res://battle/data/CharacterProfileBuilder.gd")
const CHARACTER_ROW_TEXTURE: Texture2D = preload("res://art/fight/角色选择/角色选择未选中.png")
const STAT_FIELDS: Array[String] = ["cursedEnergy", "control", "efficiency", "body", "martial", "talent"]
const STAT_NAMES: Array[String] = ["咒力总量", "咒力操纵", "咒力效率", "体质", "体术", "悟性"]
const STAT_GRADE_SCORES: Dictionary = {"F": 0.0, "E": 1.0, "D": 2.0, "C": 3.0, "B": 4.0, "A": 5.0, "S": 6.0, "SS": 7.0, "SSS": 8.0, "EX": 12.0, "EX-": 10.0}
const CHARACTER_ROW_HEIGHT: float = 167.0
const CHARACTER_ROW_SEPARATION: int = -70

@onready var _character_background: TextureRect = $CharacterBackground
@onready var _character_list: VBoxContainer = $CharacterBackground/CharacterScroll/CharacterList
@onready var _character_scroll: ScrollContainer = $CharacterBackground/CharacterScroll
@onready var _character_content: Control = $CharacterContent
@onready var _player_open_button: TextureButton = _find_open_button($CharacterContent/PlayerCharacterSlots, ["PlayerCharacterButton", "PlayerCharacterButtonPlayerCharacterButton"])
@onready var _opponent_open_button: TextureButton = _find_open_button($CharacterContent/OpponentCharacterSlots, ["OpponentCharacterButton"])
@onready var _player_card: Control = $CharacterContent/PlayerCharacterSlots/PlayerCharacter
@onready var _opponent_card: Control = $CharacterContent/OpponentCharacterSlots/OpponentCharacter
@onready var _player_name: Label = _find_profile_name(_player_card)
@onready var _opponent_name: Label = _find_profile_name(_opponent_card)
@onready var _battle_button: TextureButton = $BottomNav/BattleButton

var _picker_dismiss_layer: Control
var _repository: RefCounted = DATA_REPOSITORY_SCRIPT.new()
var _profiles: RefCounted = PROFILE_BUILDER_SCRIPT.new()
var _characters: Array[Dictionary] = []
var _player_character_id: String = "gojo_satoru_shinjuku"
var _opponent_character_id: String = "sukuna_heian_or_shinjuku"
var _selection_side: StringName = &"player"
var _character_content_filters: Dictionary = {}
var _battle_cta_tween: Tween

func _ready() -> void:
	# 角色页是当前页面，导航栏必须在首帧就投影角色选中态。
	$BottomNav.select(1)
	_character_background.visible = false
	UI.ignore_decorations(self)
	var selection: Node = get_node_or_null("/root/SelectionState")
	if selection != null:
		_player_character_id = str(selection.call("get_player_id"))
		_opponent_character_id = str(selection.call("get_opponent_id"))
	# The picker renders above character data. Its native ScrollContainer remains
	# the only control that owns wheel input; blank-page dismissal is handled by
	# this page after CharacterContent is switched to IGNORE.
	_character_background.mouse_filter = Control.MOUSE_FILTER_STOP
	_character_background.gui_input.connect(_on_picker_backdrop_gui_input)
	# CharacterContent is ignored while the picker is open, so blank viewport
	# clicks reach the page itself. Unlike a full-screen STOP overlay, this does
	# not sit above the native ScrollContainer and therefore preserves its wheel.
	gui_input.connect(_on_page_gui_input)
	_picker_dismiss_layer = Control.new()
	_picker_dismiss_layer.name = "PickerDismissLayer"
	# This node is only a named modal-state marker for UI inspection. It must not
	# receive pointer events: a full-screen STOP control blocks wheel input before
	# the ScrollContainer can process it. Blank clicks are handled by
	# _unhandled_input after CharacterContent is set to IGNORE.
	_picker_dismiss_layer.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_picker_dismiss_layer.z_index = 19
	_picker_dismiss_layer.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(_picker_dismiss_layer)
	_picker_dismiss_layer.visible = false
	_character_scroll.mouse_filter = Control.MOUSE_FILTER_STOP
	_character_list.mouse_filter = Control.MOUSE_FILTER_IGNORE
	for raw: Variant in _repository.characters():
		if raw is Dictionary: _characters.append(raw as Dictionary)
	_connect_picker_button(_player_open_button, _open_player_picker, "玩家角色选择")
	_connect_picker_button(_opponent_open_button, _open_opponent_picker, "对手角色选择")
	for child: Node in _character_background.get_children():
		if child is Control and child != _character_scroll:
			(child as Control).visible = false
	_build_character_buttons()
	$BottomNav/HomeButton.pressed.connect(_go_to_menu)
	$Background/Header/MoreButton.pressed.connect(func() -> void: UI.show_settings(self))
	$Background/Header/UserButton.pressed.connect(_go_to_user_panel)
	$BottomNav/CharacterButton.pressed.connect(_go_to_menu)
	$BottomNav/BattleButton.pressed.connect(_on_start_pressed)
	$BottomNav/ArchiveButton.pressed.connect(_go_to_online_room)
	_refresh_profile(_player_card, _player_name, _player_character_id)
	_refresh_profile(_opponent_card, _opponent_name, _opponent_character_id)
	_persist_selection()
	_start_battle_cta_pulse()
	PAGE_ENTRANCE.play(self, [&"CharacterBackground", &"PickerDismissLayer"])

func _start_battle_cta_pulse() -> void:
	# 不调整作者排版；仅在原按钮上做低频呼吸、色温和轻微放大提示。
	if _battle_cta_tween != null and _battle_cta_tween.is_valid(): _battle_cta_tween.kill()
	_battle_button.pivot_offset = _battle_button.size * 0.5
	_battle_cta_tween = create_tween().set_loops()
	_battle_cta_tween.tween_property(_battle_button, "scale", Vector2(1.055, 1.055), 0.76).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_OUT)
	_battle_cta_tween.parallel().tween_property(_battle_button, "modulate", Color(1.18, 1.08, 0.72, 1.0), 0.76)
	_battle_cta_tween.tween_property(_battle_button, "scale", Vector2.ONE, 0.76).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN)
	_battle_cta_tween.parallel().tween_property(_battle_button, "modulate", Color.WHITE, 0.76)

func battle_cta_pulse_active_for_acceptance() -> bool:
	return _battle_cta_tween != null and _battle_cta_tween.is_valid()

func _open_player_picker() -> void:
	_toggle_picker(&"player")

func _open_opponent_picker() -> void:
	_toggle_picker(&"opponent")

## Layout authors may rename a visual button while polishing a page.  Keep the
## compatibility aliases here so scene layout changes cannot turn into a null
## signal connection at startup.
func _find_open_button(container: Node, candidate_names: Array[String]) -> TextureButton:
	for node_name: String in candidate_names:
		var button: TextureButton = container.get_node_or_null(node_name) as TextureButton
		if button != null: return button
	return null

func _find_profile_name(card: Control) -> Label:
	return card.get_node_or_null("Name") as Label if card.get_node_or_null("Name") is Label else card.get_node_or_null("Character/Name") as Label

func _connect_picker_button(button: TextureButton, callback: Callable, label: String) -> void:
	if button == null:
		push_warning("角色选择页缺少%s按钮；已跳过该按钮绑定。" % label)
		return
	if not button.pressed.is_connected(callback): button.pressed.connect(callback)

func _toggle_picker(side: StringName) -> void:
	if _character_background.visible and _selection_side == side:
		_set_picker_visible(false)
		return
	_selection_side = side
	_build_character_buttons()
	_set_picker_visible(true)

func _set_picker_visible(is_visible: bool) -> void:
	_character_background.visible = is_visible
	_picker_dismiss_layer.visible = is_visible
	# CharacterContent spans the whole viewport. Ignore it while the modal picker
	# is open so its panels cannot be chosen as the GUI input target.
	if is_visible:
		_character_content_filters.clear()
		_set_mouse_filter_recursive(_character_content, Control.MOUSE_FILTER_IGNORE)
		# 两个展开按钮位于下拉面板之外；菜单打开时仍须能再次点击以收起。
		if _player_open_button != null: _player_open_button.mouse_filter = Control.MOUSE_FILTER_STOP
		if _opponent_open_button != null: _opponent_open_button.mouse_filter = Control.MOUSE_FILTER_STOP
	else:
		_restore_mouse_filters(_character_content)
	_character_scroll.move_to_front()

func _set_mouse_filter_recursive(node: Node, filter: Control.MouseFilter) -> void:
	if node is Control:
		var control: Control = node as Control
		_character_content_filters[control.get_path()] = control.mouse_filter
		control.mouse_filter = filter
	for child: Node in node.get_children():
		_set_mouse_filter_recursive(child, filter)

func _restore_mouse_filters(node: Node) -> void:
	if node is Control:
		var control: Control = node as Control
		var path: NodePath = control.get_path()
		if _character_content_filters.has(path):
			control.mouse_filter = _character_content_filters[path]
	for child: Node in node.get_children():
		_restore_mouse_filters(child)

func _unhandled_input(event: InputEvent) -> void:
	if not _character_background.visible: return
	if not event is InputEventMouseButton: return
	var mouse_event: InputEventMouseButton = event as InputEventMouseButton
	if not mouse_event.pressed or mouse_event.button_index != MOUSE_BUTTON_LEFT: return
	# 滚动列表本身拥有输入；落在其余蒙层区域的点击表示取消当前选择。
	if _character_scroll.get_global_rect().has_point(mouse_event.position): return
	_set_picker_visible(false)
	get_viewport().set_input_as_handled()

func _on_picker_backdrop_gui_input(event: InputEvent) -> void:
	if not _character_background.visible or not event is InputEventMouseButton: return
	var mouse_event: InputEventMouseButton = event as InputEventMouseButton
	if not mouse_event.pressed or mouse_event.button_index != MOUSE_BUTTON_LEFT: return
	if _character_scroll.get_global_rect().has_point(mouse_event.position): return
	_set_picker_visible(false)
	get_viewport().set_input_as_handled()

func _on_page_gui_input(event: InputEvent) -> void:
	if not _character_background.visible or not event is InputEventMouseButton: return
	var mouse_event: InputEventMouseButton = event as InputEventMouseButton
	if not mouse_event.pressed or mouse_event.button_index != MOUSE_BUTTON_LEFT: return
	# The scroll and both opener buttons are STOP controls, so an event arriving
	# here is a click in the remaining blank viewport area.
	_set_picker_visible(false)
	get_viewport().set_input_as_handled()

func _build_character_buttons() -> void:
	for child: Node in _character_list.get_children():
		child.queue_free()
	var visible_characters: Array[Dictionary] = _characters_for_current_picker()
	for character: Dictionary in visible_characters:
		var row := TextureButton.new()
		row.custom_minimum_size = Vector2(500.0, CHARACTER_ROW_HEIGHT)
		row.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		row.size_flags_vertical = Control.SIZE_SHRINK_BEGIN
		row.texture_normal = CHARACTER_ROW_TEXTURE
		row.texture_hover = CHARACTER_ROW_TEXTURE
		row.texture_pressed = CHARACTER_ROW_TEXTURE
		row.ignore_texture_size = true
		row.stretch_mode = TextureButton.STRETCH_SCALE
		row.mouse_filter = Control.MOUSE_FILTER_STOP
		row.mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
		row.focus_mode = Control.FOCUS_NONE
		row.set_meta("character_id", str(character.get("id", "")))
		row.set_meta("hover_feedback", true)
		row.pressed.connect(_select_character.bind(row))
		row.mouse_entered.connect(_on_character_row_mouse_entered.bind(row))
		row.mouse_exited.connect(_on_character_row_mouse_exited.bind(row))
		row.button_down.connect(_on_character_row_button_down.bind(row))
		row.button_up.connect(_on_character_row_button_up.bind(row))
		row.gui_input.connect(_on_character_row_gui_input.bind(row))
		_character_list.add_child(row)
		var name_label := Label.new()
		name_label.name = &"Name"
		# Keep the same coordinates as the authored CharacterBackground row,
		# scaled from 526px artwork width to the 500px scroll content width.
		name_label.position = Vector2(65.0, 52.0)
		name_label.size = Vector2(370.0, 62.0)
		name_label.add_theme_color_override("font_color", Color(0.0, 0.0, 0.0, 1.0))
		name_label.add_theme_font_size_override("font_size", 18)
		name_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		name_label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
		name_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		name_label.mouse_filter = Control.MOUSE_FILTER_IGNORE
		name_label.text = str(character.get("name", ""))
		row.add_child(name_label)
	_character_list.size_flags_vertical = Control.SIZE_EXPAND_FILL
	_character_list.add_theme_constant_override("separation", CHARACTER_ROW_SEPARATION)
	var content_height: float = float(visible_characters.size()) * CHARACTER_ROW_HEIGHT
	if visible_characters.size() > 1:
		content_height += float(visible_characters.size() - 1) * CHARACTER_ROW_SEPARATION
		_character_list.custom_minimum_size = Vector2(500.0, content_height)

func _characters_for_current_picker() -> Array[Dictionary]:
	if _selection_side != &"player": return _characters
	return _merge_card_characters(_characters)

## 登录卡只能补充角色；内置数据始终是选择器的完整基线。
func _merge_card_characters(built_ins: Array[Dictionary]) -> Array[Dictionary]:
	var result: Array[Dictionary] = built_ins.duplicate(true)
	var account: Node = get_node_or_null("/root/AccountState")
	if account == null or not account.has_method("card_characters"):
		return result
	var positions: Dictionary = {}
	for index: int in result.size(): positions[str(result[index].get("id", ""))] = index
	for stored: Dictionary in account.call("card_characters") as Array:
		var id: String = str(stored.get("id", ""))
		if id.is_empty(): continue
		if positions.has(id): result[int(positions[id])] = stored
		else:
			positions[id] = result.size()
			result.append(stored)
	return result

func _on_character_row_mouse_entered(row: TextureButton) -> void:
	row.modulate = Color(1.08, 1.08, 1.08, 1.0)

func _on_character_row_mouse_exited(row: TextureButton) -> void:
	row.modulate = Color.WHITE
	row.scale = Vector2.ONE

func _on_character_row_button_down(row: TextureButton) -> void:
	row.pivot_offset = row.size * 0.5
	row.scale = Vector2(0.98, 0.98)
	row.modulate = Color(0.92, 0.92, 0.98, 1.0)

func _on_character_row_button_up(row: TextureButton) -> void:
	row.scale = Vector2.ONE
	row.modulate = Color(1.08, 1.08, 1.08, 1.0)

func _on_character_row_gui_input(event: InputEvent, _row: TextureButton) -> void:
	if event is InputEventMouseButton and (event as InputEventMouseButton).pressed:
		var mouse_event: InputEventMouseButton = event as InputEventMouseButton
		if mouse_event.button_index == MOUSE_BUTTON_WHEEL_DOWN:
			_character_scroll.scroll_vertical = mini(
				_character_scroll.scroll_vertical + 86,
				roundi(_character_scroll.get_v_scroll_bar().max_value)
			)
			get_viewport().set_input_as_handled()
		elif mouse_event.button_index == MOUSE_BUTTON_WHEEL_UP:
			_character_scroll.scroll_vertical = maxi(_character_scroll.scroll_vertical - 86, 0)
			get_viewport().set_input_as_handled()

func _select_character(entry: Control) -> void:
	var id: String = str(entry.get_meta("character_id", ""))
	if id.is_empty(): return
	if _selection_side == &"player":
		_player_character_id = id
		_refresh_profile(_player_card, _player_name, id)
	else:
		_opponent_character_id = id
		_refresh_profile(_opponent_card, _opponent_name, id)
	_persist_selection()
	_set_picker_visible(false)

func _persist_selection() -> void:
	var selection: Node = get_node_or_null("/root/SelectionState")
	if selection != null and selection.has_method("set_characters"):
		selection.call("set_characters", _player_character_id, _opponent_character_id)

func _refresh_profile(card: Control, name_label: Label, character_id: String) -> void:
	var profile: Dictionary = _profiles.build(character_id)
	if profile.is_empty(): return
	var display_name: String = str(profile.get("name", character_id))
	if name_label != null:
		name_label.text = display_name
	var portrait_name: Label = card.get_node_or_null("Character/Name") as Label
	if portrait_name != null:
		portrait_name.text = display_name
	var stats: Dictionary = profile.get("stats", {}) as Dictionary
	for index: int in STAT_FIELDS.size():
		var stat_node: RichTextLabel = card.get_node_or_null("RichTextLabel%s" % ("" if index == 0 else str(index + 1))) as RichTextLabel
		if stat_node == null: continue
		# Keep the caption in the authored stat tile instead of drawing it inside
		# the RichTextLabel. The grade/value rows are laid out independently so
		# an inline second line cannot overlap the rating on the real page.
		stat_node.text = "   %s" % STAT_NAMES[index]
		var grade_label: Label = stat_node.get_node_or_null("Label") as Label
		var value_label: Label = stat_node.get_node_or_null("Label2") as Label
		var grade_text: String = str(stats.get(STAT_FIELDS[index], "-"))
		if grade_label != null:
			grade_label.add_theme_font_size_override("font_size", 28)
			grade_label.custom_minimum_size = Vector2.ZERO
			grade_label.text = grade_text
			# The authored label's minimum size expands with SSS. Use a full-width
			# centered grade row below the caption instead of a left-side badge;
			# this keeps every rating visually centered in its stat tile.
			grade_label.position = Vector2(0.0, 8.0)
			grade_label.size = Vector2(138.0, 36.0)
			grade_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
			grade_label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
			grade_label.clip_text = true
		if value_label != null:
			# The value caption is a distinct, centered second row below the
			# rating. It no longer sits on the tile's right edge or competes with
			# the rating's visual center.
			value_label.position = Vector2(0.0, 68.0)
			value_label.size = Vector2(138.0, 20.0)
			value_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
			value_label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
			value_label.add_theme_font_size_override("font_size", 12)
			value_label.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
			value_label.text = "实值：%s" % _format_stat_value(profile, STAT_FIELDS[index], grade_text)
	# RichTextLabel performs one layout pass for its authored children after
	# _ready. Re-apply the tile geometry after that pass so an SSS label cannot
	# restore its authored 69px height over the value row.
	call_deferred("_normalize_stat_label_geometry", card)
	_update_character_levels(card, profile, stats)
	_update_character_detail(card, profile, stats)

func _normalize_stat_label_geometry(card: Control) -> void:
	for index: int in STAT_FIELDS.size():
		var stat_node: RichTextLabel = card.get_node_or_null("RichTextLabel%s" % ("" if index == 0 else str(index + 1))) as RichTextLabel
		if stat_node == null:
			continue
		var grade_label: Label = stat_node.get_node_or_null("Label") as Label
		var value_label: Label = stat_node.get_node_or_null("Label2") as Label
		if grade_label != null:
			grade_label.custom_minimum_size = Vector2.ZERO
			grade_label.position = Vector2(0.0, 8.0)
			grade_label.size = Vector2(stat_node.size.x, 36.0)
		if value_label != null:
			value_label.custom_minimum_size = Vector2.ZERO
			value_label.position = Vector2(0.0, 68.0)
			value_label.size = Vector2(stat_node.size.x, 20.0)

func _update_character_detail(card: Control, profile: Dictionary, stats: Dictionary) -> void:
	var detail: RichTextLabel = card.get_node_or_null("Detail") as RichTextLabel
	if detail == null:
		return
	var axes: String = "咒术 %s / 肉体 %s / 悟性 %s / 构筑 %s" % [
		_format_axis_score(profile, stats, ["cursedEnergy", "control", "efficiency"]),
		_format_axis_score(profile, stats, ["body", "martial"]),
		_format_axis_score(profile, stats, ["talent", "control", "martial"]),
		("1" if not str(profile.get("domainId", "")).is_empty() else "0")
	]
	var flags: Dictionary = profile.get("flags", {}) as Dictionary
	var traits: Array = profile.get("traits", []) as Array
	var card_tags: Array = profile.get("cardTags", []) as Array
	var domain_id: String = str(profile.get("domainId", ""))
	var technique_text: String = _technique_display_name(profile)
	var equipment_text: String = "咒具" if bool(flags.get("usesCursedTools", false)) else "无"
	var special_terms: String = _format_detail_list(card_tags if not card_tags.is_empty() else traits)
	var trait_text: String = _format_detail_list(traits)
	var rows: Array[Array] = [
		["四轴", axes],
		["特质", trait_text],
		["术式/强度", technique_text],
		["领域", "已接入" if not domain_id.is_empty() else "无"],
		["装备/外部资源", equipment_text],
		["特殊词条", special_terms],
		["说明", "角色数据已接入"]
	]
	detail.text = _build_detail_table(rows)

func _build_detail_table(rows: Array[Array]) -> String:
	var parts: Array[String] = ["[table=2]", "[cell][color=#68798b]字段[/color][/cell]", "[cell][color=#68798b]信息[/color][/cell]"]
	for row: Array in rows:
		parts.append("[cell]%s[/cell]" % _escape_bbcode(str(row[0])))
		parts.append("[cell]%s[/cell]" % _escape_bbcode(str(row[1])))
	parts.append("[/table]")
	return "".join(parts)

func _escape_bbcode(value: String) -> String:
	return value.replace("[", "[lb]").replace("]", "[rb]")

func _format_axis_score(profile: Dictionary, stats: Dictionary, fields: Array[String]) -> String:
	if fields.is_empty():
		return "0"
	var total: float = 0.0
	for field: String in fields:
		total += _profile_stat_score(profile, field, str(stats.get(field, "-")))
	return String.num(total / float(fields.size()), 1)

func _profile_stat_score(profile: Dictionary, stat: String, grade: String) -> float:
	var raw: Dictionary = profile.get("raw", {}) as Dictionary
	var raw_keys: Dictionary = {"cursedEnergy":"cursedEnergyScore", "control":"controlScore", "efficiency":"efficiencyScore", "body":"bodyScore", "martial":"martialScore", "talent":"talentScore"}
	var raw_value: Variant = raw.get(str(raw_keys.get(stat, "")), null)
	if raw_value is float or raw_value is int: return maxf(0.0, float(raw_value))
	return float(_grade_score(grade))

func _format_stat_value(profile: Dictionary, stat: String, grade: String) -> String:
	var raw: Dictionary = profile.get("raw", {}) as Dictionary
	var raw_keys: Dictionary = {"cursedEnergy":"cursedEnergyScore", "control":"controlScore", "efficiency":"efficiencyScore", "body":"bodyScore", "martial":"martialScore", "talent":"talentScore"}
	var raw_value: Variant = raw.get(str(raw_keys.get(stat, "")), null)
	if raw_value is float or raw_value is int:
		return String.num(maxf(0.0, float(raw_value)), 1)
	return str(_grade_score(grade))

func _technique_display_name(profile: Dictionary) -> String:
	var names: Array[String] = []
	for raw: Variant in profile.get("techniques", []) as Array:
		if raw is Dictionary:
			var name: String = str((raw as Dictionary).get("name", (raw as Dictionary).get("displayName", ""))).strip_edges()
			if not name.is_empty() and not names.has(name): names.append(name)
	if not names.is_empty(): return "、".join(names)
	# 内置角色没有 techniques 数组时，优先显示能被玩家理解的中文特质，
	# 而不是错误的“已接入术式”内部状态提示。
	for raw: Variant in profile.get("traits", []) as Array:
		var trait_name: String = str(raw).strip_edges()
		if _contains_cjk(trait_name) and (trait_name.contains("术") or trait_name.contains("法")):
			return trait_name
	return "无"

func _format_detail_list(values: Array) -> String:
	if values.is_empty():
		return "无"
	var output: Array[String] = []
	for value: Variant in values:
		var text: String = str(value).strip_edges()
		# 详情面板面向玩家展示中文信息；内部 trait/tag 标识保持在数据层，不直接泄漏。
		if not text.is_empty() and _contains_cjk(text) and not output.has(text):
			output.append(text)
	return "、".join(output) if not output.is_empty() else "无"

func _contains_cjk(value: String) -> bool:
	for index: int in value.length():
		var codepoint: int = value.unicode_at(index)
		if codepoint >= 0x4e00 and codepoint <= 0x9fff: return true
	return false

func _update_character_levels(card: Control, profile: Dictionary, stats: Dictionary) -> void:
	var grades: Array[String] = []
	for field: String in STAT_FIELDS:
		grades.append(str(stats.get(field, "-")))
	var top_grade: String = _highest_grade(grades)
	var flags: Dictionary = profile.get("flags", {}) as Dictionary
	var traits: Array = profile.get("traits", []) as Array
	var card_tags: Array = profile.get("cardTags", []) as Array
	var has_domain: bool = bool(flags.get("hasDomainAccess", false)) or not str(profile.get("domainId", "")).is_empty()
	var trait_count: int = traits.size() + card_tags.size()
	var total_score: float = 0.0
	for index: int in grades.size():
		total_score += _profile_stat_score(profile, STAT_FIELDS[index], grades[index])
	_set_level_text(card, "Level", "等级：%s" % top_grade)
	_set_level_text(card, "Level2", "特性：%d" % trait_count)
	_set_level_text(card, "Level3", "领域：%s" % ("可用" if has_domain else "无"))
	var source_combat: float = float((profile.get("combatPowerUnit", {}) as Dictionary).get("value", 0.0))
	_set_level_text(card, "Level4", "战力：%s" % (String.num(source_combat, 0) if source_combat > 0.0 else String.num(total_score, 1)))
	_set_level_text(card, "Level5", "扰动：%d" % _disruption_score(profile))

func _set_level_text(card: Control, node_name: String, value: String) -> void:
	var label: Label = card.get_node_or_null(node_name) as Label
	if label != null:
		label.text = value

func _highest_grade(grades: Array[String]) -> String:
	var best: String = "-"
	var best_score: int = -1
	for grade: String in grades:
		var score: int = _grade_score(grade)
		if score > best_score:
			best = grade
			best_score = score
	return best

func _disruption_score(profile: Dictionary) -> int:
	var flags: Dictionary = profile.get("flags", {}) as Dictionary
	var tags: Array = profile.get("traits", []) as Array
	var score: int = 0
	if bool(flags.get("hasDomainAccess", false)): score += 20
	if bool(flags.get("hasInnateTechnique", false)): score += 15
	if bool(flags.get("isZeroCe", false)): score += 15
	if tags.size() >= 10: score += 20
	return mini(score, 100)

func _grade_score(value: String) -> int:
	return int(STAT_GRADE_SCORES.get(value.strip_edges().to_upper(), 4.0))

func _on_start_pressed() -> void:
	_persist_selection()
	UI.navigate(self, FIGHT_SCENE_PATH)

func _go_to_menu() -> void:
	UI.navigate(self, MENU_SCENE_PATH)

func _go_to_online_room() -> void:
	UI.navigate(self, ONLINE_ROOM_SCENE_PATH)

func _go_to_user_panel() -> void:
	UI.open_user_panel(self)


