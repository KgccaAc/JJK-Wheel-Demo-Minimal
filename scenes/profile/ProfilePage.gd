class_name ProfilePage
extends AppPage

## 账户与角色面板的运行时接线。
## 场景内已有的六个 Character 行仅用作视觉模板；实际列表在运行时复用该
## 模板创建，故不修改设计师在 user.tscn 中调好的任何坐标或尺寸。
const UI: Script = preload("res://ui/ClientUi.gd")
const PROJECTOR: Script = preload("res://account/LoginCardCharacterProjector.gd")
const WEB_LOCAL_FILE_PICKER: Script = preload("res://account/WebLocalFilePicker.gd")
const MAX_CARD_CHARACTERS: int = 15
const PANEL_ANIMATION_DURATION: float = 0.22

@onready var _user_button: BaseButton = $Background/Header/UserButton
@onready var _more_button: BaseButton = $Background/Header/MoreButton
@onready var _setting: Control = $Setting
@onready var _character_panel: Control = $Character
@onready var _character_region: Control = $Character/Character
@onready var _count_label: Label = $Character/Number/Num
@onready var _player_name: Label = $Character/PlayerName

var _expanded: bool = true
var _toggle_locked: bool = false
var _selected_character_ids: Dictionary = {}
var _character_scroll: ScrollContainer
var _rows: VBoxContainer
var _row_template: TextureButton
var _file_dialog: FileDialog
var _pending_file_action: StringName = &""
var _panel_tween: Tween

func _ready() -> void:
	UI.ignore_decorations(self)
	_prepare_character_scroll()
	_bind_controls()
	_refresh_account_display()
	_bind_button_feedback(self)

func set_expanded(expanded: bool, immediate: bool = false) -> void:
	_expanded = expanded
	if _panel_tween != null and _panel_tween.is_valid():
		_panel_tween.kill()
	if immediate or UI.reduced_motion():
		_set_content_visibility(expanded)
		return
	if expanded:
		_set_content_visibility(true)
		_setting.modulate.a = 0.0
		_character_panel.modulate.a = 0.0
		_setting.scale = Vector2(0.98, 0.98)
		_character_panel.scale = Vector2(0.98, 0.98)
		_panel_tween = create_tween().set_parallel(true)
		_panel_tween.set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
		_panel_tween.tween_property(_setting, "modulate:a", 1.0, PANEL_ANIMATION_DURATION)
		_panel_tween.tween_property(_character_panel, "modulate:a", 1.0, PANEL_ANIMATION_DURATION).set_delay(0.06)
		_panel_tween.tween_property(_setting, "scale", Vector2.ONE, PANEL_ANIMATION_DURATION)
		_panel_tween.tween_property(_character_panel, "scale", Vector2.ONE, PANEL_ANIMATION_DURATION).set_delay(0.06)
		return
	_panel_tween = create_tween().set_parallel(true)
	_panel_tween.set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_IN)
	_panel_tween.tween_property(_setting, "modulate:a", 0.0, 0.16)
	_panel_tween.tween_property(_character_panel, "modulate:a", 0.0, 0.16)
	_panel_tween.finished.connect(func() -> void: _set_content_visibility(false), CONNECT_ONE_SHOT)

func render_character_rows(characters: Array) -> void:
	_prepare_character_scroll()
	for child: Node in _rows.get_children():
		child.queue_free()
	_selected_character_ids.clear()
	var visible_count: int = mini(characters.size(), MAX_CARD_CHARACTERS)
	for index: int in visible_count:
		var raw: Variant = characters[index]
		if raw is Dictionary:
			_add_character_row(raw as Dictionary, index)
	_count_label.text = "%d/%d" % [visible_count, MAX_CARD_CHARACTERS]
	_character_scroll.scroll_vertical = 0

func _prepare_character_scroll() -> void:
	if _character_scroll != null:
		return
	_row_template = _character_region.get_node_or_null("Character1") as TextureButton
	if _row_template == null:
		if has_node("/root/ErrorService"):
			var error_service: Node = get_node_or_null("/root/ErrorService")
			if error_service != null and error_service.has_method("report_warning"):
				error_service.call("report_warning", "PROFILE_TEMPLATE_MISSING", "SCENE", "Character1 template missing; cannot render login-card characters.", {"scene": scene_file_path, "operation": "render_characters"})
		push_warning("Character1 template missing; cannot render login-card characters.")
		return
	_character_scroll = ScrollContainer.new()
	_character_scroll.name = "CharacterScroll"
	_character_scroll.position = _character_region.position
	_character_scroll.size = _character_region.size
	_character_scroll.mouse_filter = Control.MOUSE_FILTER_STOP
	_character_scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	_rows = VBoxContainer.new()
	_rows.name = "Rows"
	_rows.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_rows.add_theme_constant_override("separation", 1)
	_character_scroll.add_child(_rows)
	_character_panel.add_child(_character_scroll)
	for child: Node in _character_region.get_children():
		if child is Control:
			(child as Control).hide()
	_character_region.hide()

func _bind_controls() -> void:
	_user_button.pressed.connect(_toggle_expanded)
	_more_button.pressed.connect(func() -> void: UI.show_settings(self, _return_to_login))
	_bind($Setting/Button, _cycle_interface_color)
	_bind($Setting/Button2, _cycle_card_skin)
	_bind($Setting/Button3, _open_skin_json_picker)
	_bind($Character/Button1, _open_login_card_picker)
	_bind($Character/Button2, _open_card_face_picker)
	_bind($Character/Button3, _export_login_card)
	_bind($Character/Button4, _toggle_select_all)
	_bind($Character/Button5, _delete_selected_characters)
	# Button6 is optional: the latest layout may omit the server-sync action.
	# Keep the sync API available without making the panel fail on older layouts.
	_bind($Character.get_node_or_null("Button6"), _sync_server_card)

func _bind(node: Node, callback: Callable) -> void:
	var button: BaseButton = node as BaseButton
	if button != null and not button.pressed.is_connected(callback):
		button.pressed.connect(callback)

func _toggle_expanded() -> void:
	if _toggle_locked:
		return
	_toggle_locked = true
	if _expanded:
		set_expanded(false)
		# 收起补间结束后淡出覆盖层，底下保留的来源页面会直接显现。
		get_tree().create_timer(PANEL_ANIMATION_DURATION).timeout.connect(func() -> void:
			_toggle_locked = false
			UI.return_from_user_panel(self), CONNECT_ONE_SHOT)
		return
	set_expanded(true)
	get_tree().create_timer(PANEL_ANIMATION_DURATION).timeout.connect(func() -> void: _toggle_locked = false, CONNECT_ONE_SHOT)

func _refresh_account_display() -> void:
	var account: Node = get_node_or_null("/root/AccountState")
	var card: Dictionary = account.call("active_card") as Dictionary if account != null and account.has_method("active_card") else {}
	var name: String = str(card.get("nickname", "游客"))
	($Background/Header/UserButton/UserName as Label).text = name
	($Background/Header/UserButton/UserStatus as Label).text = str(card.get("group_name", "游客会话"))
	_player_name.text = name
	var characters: Array = account.call("card_characters") as Array if account != null and account.has_method("card_characters") else []
	render_character_rows(characters)

func _add_character_row(raw: Dictionary, index: int) -> void:
	var projected: Dictionary = PROJECTOR.call("project", raw) as Dictionary
	var character_id: String = str(projected.get("id", raw.get("id", raw.get("characterId", "")))).strip_edges()
	if character_id.is_empty():
		return
	var row: TextureButton = _row_template.duplicate() as TextureButton
	row.name = "Character_%02d" % (index + 1)
	row.show()
	row.custom_minimum_size = Vector2(_row_template.size.x, _row_template.size.y)
	row.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row.set_meta("character_id", character_id)
	var name_label: Label = row.get_node_or_null("Name") as Label
	var info_label: Label = row.get_node_or_null("Info") as Label
	if name_label != null:
		name_label.text = str(projected.get("name", raw.get("name", "未命名角色")))
	if info_label != null:
		info_label.text = _character_info(projected)
	row.tooltip_text = "点击选择；已选择的角色可由“删除所选”移出当前登录卡。"
	row.pressed.connect(_toggle_character_selection.bind(row))
	_rows.add_child(row)

func _character_info(profile: Dictionary) -> String:
	var grade: String = str(profile.get("visibleGrade", profile.get("officialGrade", profile.get("grade", "未评级")))).strip_edges()
	if grade.is_empty(): grade = "未评级"
	var combat: Dictionary = profile.get("combatPowerUnit", {}) as Dictionary
	var power: Variant = combat.get("value", profile.get("powerTier", "未计算"))
	var techniques: Array = profile.get("techniques", []) as Array
	var technique_name: String = "无"
	if not techniques.is_empty() and techniques[0] is Dictionary:
		technique_name = str((techniques[0] as Dictionary).get("name", (techniques[0] as Dictionary).get("displayName", "无")))
	return "%s  ·  战力%s  ·  术式名称：%s" % [grade, str(power), technique_name]

func _toggle_character_selection(row: TextureButton) -> void:
	var character_id: String = str(row.get_meta("character_id", ""))
	if character_id.is_empty(): return
	if _selected_character_ids.has(character_id):
		_selected_character_ids.erase(character_id)
		row.modulate = Color.WHITE
	else:
		_selected_character_ids[character_id] = true
		row.modulate = Color(0.82, 0.93, 1.0, 1.0)
	UI.pulse(row)

func _toggle_select_all() -> void:
	var should_select_all: bool = _selected_character_ids.size() < _rows.get_child_count()
	_selected_character_ids.clear()
	for child: Node in _rows.get_children():
		if not child is TextureButton: continue
		var row := child as TextureButton
		var character_id: String = str(row.get_meta("character_id", ""))
		if should_select_all and not character_id.is_empty(): _selected_character_ids[character_id] = true
		row.modulate = Color(0.82, 0.93, 1.0, 1.0) if should_select_all else Color.WHITE

func _delete_selected_characters() -> void:
	if _selected_character_ids.is_empty():
		UI.notice(self, "删除角色", "请先选择要从当前登录卡移除的角色。")
		return
	var account: Node = get_node_or_null("/root/AccountState")
	if account == null or not account.has_method("remove_active_card_characters"):
		UI.notice(self, "删除角色", "账户服务未加载，未执行删除。")
		return
	var ids: Array[String] = []
	for raw_id: Variant in _selected_character_ids.keys(): ids.append(str(raw_id))
	var removed: Dictionary = account.call("remove_active_card_characters", ids) as Dictionary
	if bool(removed.get("ok", false)):
		_refresh_account_display()
		UI.notice(self, "删除角色", "已从当前登录卡移除 %d 个角色。" % int(removed.get("removed", 0)))
	else:
		UI.notice(self, "删除角色", "删除失败：%s" % str(removed.get("error", "unknown")))

func _sync_server_card() -> void:
	var account: Node = get_node_or_null("/root/AccountState")
	if account == null or not account.has_method("sync_active_card_from_server"):
		UI.notice(self, "同步登录卡", "账户服务未加载，未执行同步。")
		return
	var result: Dictionary = account.call("sync_active_card_from_server") as Dictionary
	if bool(result.get("ok", false)):
		_refresh_account_display()
		UI.notice(self, "同步登录卡", "已从服务器更新当前登录卡及完整角色快照。")
	else:
		UI.notice(self, "同步登录卡", "同步失败：%s" % str(result.get("error", result.get("code", "unknown"))))

func _open_login_card_picker() -> void:
	if OS.has_feature("web"):
		if not bool(WEB_LOCAL_FILE_PICKER.call("request_png", _on_web_login_card_selected)):
			UI.notice(self, "登录卡", "浏览器文件选择器不可用，请刷新页面后重试。")
		return
	_open_file_picker(&"login_card", FileDialog.FILE_MODE_OPEN_FILE, PackedStringArray(["*.png ; 登录卡 PNG"]), "导入登录卡")

func _on_web_login_card_selected(bytes: PackedByteArray, filename: String) -> void:
	var account: Node = get_node_or_null("/root/AccountState")
	var result: Dictionary = account.call("import_login_card_png_bytes", bytes, filename) as Dictionary if account != null else {}
	if bool(result.get("ok", false)):
		_refresh_account_display()
		UI.notice(self, "登录卡", "已从本机浏览器文件选择器读取登录卡及全部卡内角色数据。")
	else:
		UI.notice(self, "登录卡", "无法读取登录卡：%s" % str(result.get("error", "account_unavailable")))

func _open_card_face_picker() -> void:
	_open_file_picker(&"card_face", FileDialog.FILE_MODE_OPEN_FILE, PackedStringArray(["*.png, *.jpg, *.jpeg, *.webp ; 卡面图片"]), "选择卡面图片")

func _open_skin_json_picker() -> void:
	_open_file_picker(&"skin_json", FileDialog.FILE_MODE_OPEN_FILE, PackedStringArray(["*.json ; 自制皮肤 JSON"]), "加载自制皮肤")

func _export_login_card() -> void:
	_open_file_picker(&"export_card", FileDialog.FILE_MODE_SAVE_FILE, PackedStringArray(["*.png ; 登录卡 PNG"]), "导出当前登录卡")

func _open_file_picker(action: StringName, mode: FileDialog.FileMode, filters: PackedStringArray, title: String) -> void:
	_pending_file_action = action
	if _file_dialog == null:
		_file_dialog = FileDialog.new()
		_file_dialog.name = "UserPanelFilePicker"
		_file_dialog.access = FileDialog.ACCESS_FILESYSTEM
		_file_dialog.file_selected.connect(_on_file_selected)
		add_child(_file_dialog)
	_file_dialog.file_mode = mode
	_file_dialog.filters = filters
	_file_dialog.title = title
	_file_dialog.popup_centered_ratio(0.72)

func _on_file_selected(path: String) -> void:
	var action: StringName = _pending_file_action
	_pending_file_action = &""
	var account: Node = get_node_or_null("/root/AccountState")
	if action == &"login_card":
		var result: Dictionary = account.call("import_login_card_png", path) as Dictionary if account != null else {}
		if bool(result.get("ok", false)):
			_refresh_account_display()
			UI.notice(self, "登录卡", "已读取登录卡及全部卡内角色数据。")
		else: UI.notice(self, "登录卡", "无法读取登录卡：%s" % str(result.get("error", "account_unavailable")))
	elif action == &"card_face":
		var copied: Dictionary = account.call("import_card_face_from_local_file", path) as Dictionary if account != null else {}
		var saved: bool = bool(copied.get("ok", false)) and bool(account.call("set_active_card_face_path", str(copied.get("path", ""))))
		UI.notice(self, "更换卡面", "当前登录卡面已更新。" if saved else "卡面更新失败。")
	elif action == &"skin_json":
		var parsed: Variant = JSON.parse_string(FileAccess.get_file_as_string(path))
		if parsed is Dictionary:
			var config: ConfigFile = UI.settings()
			config.set_value("display", "custom_skin_json_path", path)
			config.save(UI.SETTINGS_PATH)
			UI.notice(self, "自制皮肤", "已校验并保存皮肤 JSON 路径；皮肤字段将在支持的界面读取。")
		else: UI.notice(self, "自制皮肤", "文件不是有效 JSON，未加载。")
	elif action == &"export_card":
		_export_card_to(path, account)

func _export_card_to(target_path: String, account: Node) -> void:
	var card: Dictionary = account.call("active_card") as Dictionary if account != null and account.has_method("active_card") else {}
	var source_path: String = str(card.get("card_face_path", ""))
	if source_path.is_empty() or not FileAccess.file_exists(source_path):
		UI.notice(self, "导出登录卡", "当前卡面文件不存在，无法导出。")
		return
	var source := FileAccess.open(source_path, FileAccess.READ)
	var target := FileAccess.open(target_path, FileAccess.WRITE)
	if source == null or target == null:
		UI.notice(self, "导出登录卡", "无法写入所选导出位置。")
		return
	target.store_buffer(source.get_buffer(source.get_length()))
	UI.notice(self, "导出登录卡", "当前登录卡 PNG 已导出。")

func _cycle_interface_color() -> void:
	var config: ConfigFile = UI.settings()
	var next: String = "对比模式" if str(config.get_value("display", "interface_color", "原色模式")) == "原色模式" else "原色模式"
	config.set_value("display", "interface_color", next)
	config.save(UI.SETTINGS_PATH)
	($Setting/Button/Color as Label).text = "界面颜色：%s" % next

func _cycle_card_skin() -> void:
	var config: ConfigFile = UI.settings()
	var next: String = "简洁" if str(config.get_value("display", "card_skin", "默认")) == "默认" else "默认"
	config.set_value("display", "card_skin", next)
	config.save(UI.SETTINGS_PATH)
	($Setting/Button2/Color as Label).text = "卡牌皮肤：%s" % next

func _return_to_login() -> void:
	var account: Node = get_node_or_null("/root/AccountState")
	if account != null and account.has_method("clear_session"): account.call("clear_session")
	UI.navigate(self, "res://scenes/auth/auth_login.tscn")

func _set_content_visibility(show_content: bool) -> void:
	_setting.visible = show_content
	_character_panel.visible = show_content
	if show_content:
		_setting.modulate.a = 1.0
		_character_panel.modulate.a = 1.0
		_setting.scale = Vector2.ONE
		_character_panel.scale = Vector2.ONE

func _bind_button_feedback(node: Node) -> void:
	if node is BaseButton:
		var button := node as BaseButton
		if not bool(button.get_meta("user_panel_pulse_bound", false)):
			button.set_meta("user_panel_pulse_bound", true)
			button.pressed.connect(func() -> void: UI.pulse(button))
	for child: Node in node.get_children():
		_bind_button_feedback(child)



