extends AppPage

const UI: Script = preload("res://ui/ClientUi.gd")

const MAIN_SCENE_PATH := "res://scenes/home/home.tscn"
const SELECTION_ART_CENTER_Y_RATIO: float = 0.49575
const LOGIN_CARD_METHOD_LABEL: String = "登录卡登录"

@onready var login_selector: OptionButton = $LoginContent/ResponsiveContent/LoginSelector
@onready var status_label: Label = $Footer
@onready var title: Control = $Title
@onready var login_content: Control = $LoginContent
@onready var selection_frame: TextureRect = $LoginContent/ResponsiveContent/SelectionFrame
@onready var start_button: Button = $LoginContent/ResponsiveContent/StartButton
@onready var register_button: Button = $LoginContent/ResponsiveContent/RegisterButton
@onready var settings_button: Button = $LoginContent/ResponsiveContent/SettingsButton
@onready var account_button: BaseButton = $Navigation/AccountButton

var _login_card_selected: bool = false
var _guest_login_selected: bool = false

func _ready() -> void:
	AudioManager.play_login_music()
	login_selector.item_selected.connect(_on_login_method_selected)
	login_selector.select(0)
	_on_login_method_selected(0)
	call_deferred("_play_independent_content_intro")
	UI.ignore_decorations(self)
	register_button.pressed.connect(_on_register_pressed)
	settings_button.pressed.connect(_on_settings_pressed)
	account_button.pressed.connect(_open_login_card_picker)
	$Navigation/AnnouncementButton.pressed.connect(_on_announcement_pressed)
	account_button.tooltip_text = "登录卡与账号"
	$Navigation/AnnouncementButton.tooltip_text = "公告"
	$Navigation/SupportButton.tooltip_text = "帮助与支持"
	for button in [start_button, register_button, settings_button]:
		button.focus_mode = Control.FOCUS_ALL
		button.mouse_entered.connect(button.grab_focus)
		button.focus_entered.connect(_on_button_focus_entered.bind(button))
	start_button.grab_focus()

func _play_independent_content_intro() -> void:
	var title_target: Vector2 = title.position
	var login_content_target: Vector2 = login_content.position

	title.position = title_target + Vector2(0.0, -180.0)
	title.modulate = Color(1.0, 1.0, 1.0, 0.0)
	var title_tween: Tween = create_tween()
	title_tween.set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_OUT)
	title_tween.tween_interval(0.48)
	title_tween.tween_property(title, "position", title_target, 0.82)
	title_tween.parallel().tween_property(title, "modulate:a", 1.0, 0.56).set_delay(0.25)

	login_content.position = login_content_target + Vector2(0.0, -180.0)
	login_content.modulate = Color(1.0, 1.0, 1.0, 0.0)
	var login_content_tween: Tween = create_tween()
	login_content_tween.set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_OUT)
	login_content_tween.tween_interval(0.66)
	login_content_tween.tween_property(login_content, "position", login_content_target, 0.82)
	login_content_tween.parallel().tween_property(login_content, "modulate:a", 1.0, 0.56).set_delay(0.25)

func _on_button_focus_entered(button: Button) -> void:
	var frame_parent := selection_frame.get_parent_control()
	var target_position := button.global_position - frame_parent.global_position
	var target_center_y: float = target_position.y + button.size.y * 0.5
	selection_frame.position.x = target_position.x + (button.size.x - selection_frame.size.x) * 0.5
	selection_frame.position.y = target_center_y - selection_frame.size.y * SELECTION_ART_CENTER_Y_RATIO

func _on_login_method_selected(index: int) -> void:
	_login_card_selected = index == 1
	_guest_login_selected = index == 2
	start_button.disabled = not (_login_card_selected or _guest_login_selected)
	if _login_card_selected:
		status_label.text = "已选择%s，请选择登录卡" % LOGIN_CARD_METHOD_LABEL
	elif _guest_login_selected:
		status_label.text = "已选择游客登录，请点击开始游戏"
	else:
		status_label.text = "请选择登录方式"

func _on_register_pressed() -> void:
	var account: Node = get_node_or_null("/root/AccountState")
	if account == null:
		UI.notice(self, "登录卡", "账户服务加载失败，请重启后重试。")
		return
	var response: Dictionary = account.call("begin_bilibili_registration") as Dictionary
	var message: String = str(response.get("message", "无法启动 Bilibili 认证。"))
	if response.has("pending_card"):
		message += "\n已建立待认证登录卡；上线后会自动使用 Bilibili 昵称。"
	UI.notice(self, "Bilibili 登录卡注册", message)
	_open_login_card_picker()

func _on_settings_pressed() -> void:
	UI.show_settings(self)

func _on_announcement_pressed() -> void:
	UI.notice(self, "公告", "当前版本提供本地转盘与离线战斗；联机和登录卡正在准备。")

func _on_start_pressed() -> void:
	if _login_card_selected:
		_open_login_card_picker()
		return
	if not _guest_login_selected:
		return

	status_label.text = "游客登录中……"
	var account: Node = get_node_or_null("/root/AccountState")
	if account != null and account.has_method("set_guest_session"):
		account.call("set_guest_session")
	UI.navigate(self, MAIN_SCENE_PATH)

func _open_login_card_picker() -> void:
	var account: Node = get_node_or_null("/root/AccountState")
	if account == null:
		UI.notice(self, "登录卡", "账户服务加载失败，请重启后重试。")
		return
	var dialog: AcceptDialog = get_node_or_null("LoginCardPicker") as AcceptDialog
	if dialog == null:
		dialog = AcceptDialog.new()
		dialog.name = "LoginCardPicker"
		dialog.exclusive = true
		dialog.title = "选择登录卡"
		add_child(dialog)
	for child: Node in dialog.get_children():
		child.queue_free()
	var content: VBoxContainer = VBoxContainer.new()
	content.name = "LoginCardList"
	content.custom_minimum_size = Vector2(440.0, 0.0)
	dialog.add_child(content)
	var cards: Array = account.call("cards") as Array
	if cards.is_empty():
		var hint: Label = Label.new()
		hint.text = "暂无登录卡，请先注册登录卡。"
		hint.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		content.add_child(hint)
	else:
		for raw_card: Variant in cards:
			if not raw_card is Dictionary:
				continue
			var card: Dictionary = raw_card as Dictionary
			var card_button: Button = Button.new()
			card_button.custom_minimum_size = Vector2(440.0, 62.0)
			card_button.text = "%s\n%s" % [str(card.get("nickname", "待认证咒术师")), str(card.get("group_name", "·普通卡·"))]
			card_button.pressed.connect(_select_login_card.bind(str(card.get("id", "")), dialog))
			content.add_child(card_button)
	var register_entry: Button = Button.new()
	register_entry.text = "注册 Bilibili 登录卡"
	register_entry.pressed.connect(_on_register_pressed)
	content.add_child(register_entry)
	var local_face_entry: Button = Button.new()
	local_face_entry.name = "ChooseLocalCardFace"
	local_face_entry.text = "导入本地登录卡 PNG"
	local_face_entry.pressed.connect(_open_local_card_face_picker.bind(dialog))
	content.add_child(local_face_entry)
	dialog.popup_centered_clamped(Vector2i(520, 360))

func _select_login_card(card_id: String, dialog: AcceptDialog) -> void:
	var account: Node = get_node_or_null("/root/AccountState")
	if account == null or not bool(account.call("select_card", card_id)):
		UI.notice(self, "登录卡", "无法选择该登录卡，请重新注册。")
		return
	dialog.hide()
	status_label.text = "登录卡验证完成，正在进入游戏……"
	UI.navigate(self, MAIN_SCENE_PATH)

func _open_local_card_face_picker(dialog: AcceptDialog) -> void:
	var picker: FileDialog = get_node_or_null("LocalCardFacePicker") as FileDialog
	if picker == null:
		picker = FileDialog.new()
		picker.name = "LocalCardFacePicker"
		picker.file_mode = FileDialog.FILE_MODE_OPEN_FILE
		picker.access = FileDialog.ACCESS_FILESYSTEM
		picker.filters = PackedStringArray(["*.png ; 源项目登录卡 PNG"])
		picker.file_selected.connect(_import_selected_card_face.bind(dialog))
		add_child(picker)
	picker.popup_centered_ratio(0.72)

func _import_selected_card_face(path: String, dialog: AcceptDialog) -> void:
	var account: Node = get_node_or_null("/root/AccountState")
	if account == null:
		return
	var imported: Dictionary = account.call("import_login_card_png", path) as Dictionary
	if not bool(imported.get("ok", false)):
		UI.notice(self, "登录卡", "未识别到有效登录卡：" + str(imported.get("error", "")))
		return
	dialog.hide()
	UI.notice(self, "登录卡", "已导入登录卡、昵称和卡内角色。")




