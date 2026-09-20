extends AppPage

const UI: Script = preload("res://ui/ClientUi.gd")

const CLICK_SCALE: float = 0.96
const CLICK_DURATION: float = 0.12
const ENTRANCE_DURATION: float = 0.42
const CARD_DELAY: float = 0.08
const FIGHT_SCENE_PATH: String = "res://scenes/roster/roster_picker.tscn"
const WHEEL_SCENE_PATH: String = "res://scenes/wheel/wheel.tscn"
const ONLINE_ROOM_SCENE_PATH: String = "res://scenes/online/online_room.tscn"
const COMMUNITY_SCENE_PATH: String = "res://scenes/community/community.tscn"
const LOGIN_SCENE_PATH: String = "res://scenes/auth/auth_login.tscn"
const USER_SCENE_PATH: String = "res://scenes/profile/profile_page.tscn"
const STORY_SCENE_PATH: String = "res://scenes/story/StroyHome.tscn"

@onready var _background: TextureRect = $Background
@onready var _title: Label = $Content/Header/Title
@onready var _subtitle: Label = $Content/Header/Subtitle
@onready var _profile_section: Control = $Content/ProfileSection
@onready var _profile_panel: TextureRect = $Content/ProfileSection/ProfilePanel
@onready var _draw_button: TextureButton = $Content/ProfileSection/DrawButton
@onready var _mode_section: Control = $Content/ModeSection
@onready var _mode_grid: GridContainer = $Content/ModeSection/ModeGrid
@onready var _mode_card_01: BaseButton = $Content/ModeSection/ModeGrid/BattleModeCard
@onready var _bottom_nav: HBoxContainer = $Content/BottomNav
@onready var _user_button: TextureButton = $Content/Header/UserButton
@onready var _more_button: BaseButton = $Content/Header/MoreButton
@onready var _player_card_face: TextureRect = $Content/ProfileSection/ProfilePanel/PlayerCardFace
@onready var _player_name: Label = $Content/ProfileSection/PlayerName
@onready var _player_area: Label = $Content/ProfileSection/PlayerArea
@onready var _header_user_name: Label = $Content/Header/UserButton/UserName
@onready var _header_user_status: Label = $Content/Header/UserButton/UserStatus
var mode_cards: Array[Control] = []

func _ready() -> void:
	var audio_manager: Node = get_node_or_null("/root/AudioManager")
	if audio_manager != null and audio_manager.has_method("play_menu_music"):
		audio_manager.call("play_menu_music")
	UI.ignore_decorations(self)
	_apply_active_login_card()
	for child: Node in _mode_grid.get_children():
		if child is BaseButton:
			mode_cards.append(child as Control)
			(child as BaseButton).pressed.connect(_animate_click.bind(child as Control))
	_mode_card_01.pressed.connect(_on_mode_card_01_pressed)
	var story_card: BaseButton = $Content/ModeSection/ModeGrid/StoryModeCard
	story_card.pressed.connect(_on_story_entry_pressed)
	for index: int in range(2, mode_cards.size()):
		if index == 2 or index == 5: continue
		var card: BaseButton = mode_cards[index] as BaseButton
		if card != null: card.pressed.connect(_on_unavailable_mode_pressed.bind(card))
	if mode_cards.size() > 1:
		var online_card: BaseButton = mode_cards[1] as BaseButton
		if online_card != null: online_card.pressed.connect(_on_online_entry_pressed)
	if mode_cards.size() > 5:
		var community_card: BaseButton = mode_cards[5] as BaseButton
		if community_card != null: community_card.pressed.connect(_on_community_entry_pressed)
	_draw_button.pressed.connect(_animate_click.bind(_draw_button))
	_draw_button.pressed.connect(_on_wheel_entry_pressed)
	_user_button.pressed.connect(_on_user_pressed)
	_more_button.pressed.connect(_on_more_pressed)
	$Content/BottomNav/CharacterButton.pressed.connect(_on_fight_entry_pressed)
	$Content/BottomNav/BattleButton.pressed.connect(_on_fight_entry_pressed)
	$Content/BottomNav/ArchiveButton.pressed.connect(_on_online_entry_pressed)
	await _play_entrance_animation()

func _apply_active_login_card() -> void:
	var account: Node = get_node_or_null("/root/AccountState")
	if account == null:
		return
	var card: Dictionary = account.call("active_card") as Dictionary
	if card.is_empty():
		_player_card_face.texture = null
		_player_card_face.visible = false
		var is_guest: bool = account.has_method("is_guest_session") and bool(account.call("is_guest_session"))
		_player_name.text = "游客" if is_guest else "未选择登录卡"
		_player_area.text = "·游客登录·" if is_guest else "请选择登录卡后进入游戏"
		_header_user_name.text = "游客" if is_guest else "未登录"
		_header_user_status.text = "游客会话" if is_guest else "点击返回登录页"
		return
	_player_card_face.visible = true
	var nickname: String = str(card.get("nickname", "待认证咒术师"))
	var group_name: String = str(card.get("group_name", "·普通卡·"))
	_player_name.text = nickname
	_player_area.text = group_name
	_header_user_name.text = nickname
	_header_user_status.text = "已选择登录卡"
	var card_face_path: String = str(card.get("card_face_path", ""))
	if not card_face_path.is_empty() and ResourceLoader.exists(card_face_path):
		_player_card_face.texture = load(card_face_path) as Texture2D
	elif not card_face_path.is_empty() and FileAccess.file_exists(card_face_path):
		var image: Image = Image.load_from_file(card_face_path)
		if image != null:
			_player_card_face.texture = ImageTexture.create_from_image(image)

func _play_entrance_animation() -> void:
	var profile_origin: Vector2 = _profile_section.position
	var mode_origin: Vector2 = _mode_section.position
	var title_origin: Vector2 = _title.position
	var subtitle_origin: Vector2 = _subtitle.position
	_profile_panel.modulate.a = 0.0
	_draw_button.modulate.a = 0.0
	_profile_section.modulate.a = 0.0
	_mode_section.modulate.a = 0.0
	_bottom_nav.modulate.a = 0.0
	_user_button.modulate.a = 0.0
	_more_button.modulate.a = 0.0
	_title.modulate.a = 0.0
	_subtitle.modulate.a = 0.0
	_background.modulate.a = 0.0
	_profile_section.position = profile_origin + Vector2(-90.0, 0.0)
	_mode_section.position = mode_origin + Vector2(-90.0, 0.0)
	_title.position = title_origin + Vector2(0.0, -18.0)
	_subtitle.position = subtitle_origin + Vector2(0.0, -12.0)
	for card: Control in mode_cards:
		card.modulate.a = 0.0
		card.scale = Vector2(0.92, 0.92)

	var background_tween: Tween = create_tween()
	background_tween.set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_OUT)
	background_tween.tween_property(_background, "modulate:a", 1.0, 0.55)
	await background_tween.finished

	var header_tween: Tween = create_tween().set_parallel(true)
	header_tween.set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
	header_tween.tween_property(_title, "modulate:a", 1.0, 0.34)
	header_tween.tween_property(_subtitle, "modulate:a", 1.0, 0.42)
	header_tween.tween_property(_title, "position", title_origin, 0.42)
	header_tween.tween_property(_subtitle, "position", subtitle_origin, 0.48)
	await header_tween.finished

	var sections_tween: Tween = create_tween().set_parallel(true)
	sections_tween.set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	sections_tween.tween_property(_profile_section, "modulate:a", 1.0, ENTRANCE_DURATION)
	sections_tween.tween_property(_profile_section, "position", profile_origin, ENTRANCE_DURATION)
	sections_tween.tween_property(_profile_panel, "modulate:a", 1.0, ENTRANCE_DURATION)
	sections_tween.tween_property(_draw_button, "modulate:a", 1.0, ENTRANCE_DURATION + 0.06)
	sections_tween.tween_property(_mode_section, "modulate:a", 1.0, ENTRANCE_DURATION + 0.08)
	sections_tween.tween_property(_mode_section, "position", mode_origin, ENTRANCE_DURATION + 0.08)
	await sections_tween.finished

	for card: Control in mode_cards:
		var card_tween: Tween = create_tween().set_parallel(true)
		card_tween.set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
		card_tween.tween_property(card, "modulate:a", 1.0, 0.28)
		card_tween.tween_property(card, "scale", Vector2.ONE, 0.38)
		await get_tree().create_timer(CARD_DELAY).timeout

	var final_tween: Tween = create_tween().set_parallel(true)
	final_tween.set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	final_tween.tween_property(_bottom_nav, "modulate:a", 1.0, 0.42)
	final_tween.tween_property(_user_button, "modulate:a", 1.0, 0.42)
	final_tween.tween_property(_more_button, "modulate:a", 1.0, 0.48)
	await final_tween.finished

func _animate_click(target: Control) -> void:
	# ClientUi 保存首次 authored scale 作为固定基准；快速重复点击不累积缩放。
	UI.pulse(target)

func _on_user_pressed() -> void:
	UI.open_user_panel(self)

func _on_unavailable_mode_pressed(card: BaseButton) -> void:
	UI.pulse(card)
	var title_node: Label = card.get_node_or_null("Title") as Label
	UI.notice(self, "模式未开放", "%s 当前仅展示入口，联机服务尚未接入。" % (title_node.text if title_node != null else "该模式"))

func _on_mode_card_01_pressed() -> void:
	UI.navigate(self, FIGHT_SCENE_PATH)

func _on_story_entry_pressed() -> void:
	UI.navigate(self, STORY_SCENE_PATH)

func _on_online_entry_pressed() -> void:
	UI.navigate(self, ONLINE_ROOM_SCENE_PATH)

func _on_community_entry_pressed() -> void:
	UI.navigate(self, COMMUNITY_SCENE_PATH)

func _on_more_pressed() -> void:
	UI.show_settings(self, _return_to_login)

func _return_to_login() -> void:
	var account: Node = get_node_or_null("/root/AccountState")
	if account != null and account.has_method("clear_session"):
		account.call("clear_session")
	UI.navigate(self, LOGIN_SCENE_PATH)

func _on_wheel_entry_pressed() -> void:
	UI.navigate(self, WHEEL_SCENE_PATH)

func _on_fight_entry_pressed() -> void:
	UI.navigate(self, FIGHT_SCENE_PATH)








