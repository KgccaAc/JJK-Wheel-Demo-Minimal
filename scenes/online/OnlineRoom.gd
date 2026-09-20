extends AppPage

## 联机大厅的运行时接线。房间状态仍完全由未来权威服务端返回，客户端不伪造成功结果。
const UI: Script = preload("res://ui/ClientUi.gd")
const PAGE_ENTRANCE: Script = preload("res://ui/PageEntrance.gd")
const GATEWAY_SCRIPT: Script = preload("res://battle/online/OnlineRoomGateway.gd")
const LOCAL_TRANSPORT_SCRIPT: Script = preload("res://battle/online/LocalHttpOnlineRoomTransport.gd")
const REMOTE_TRANSPORT_SCRIPT: Script = preload("res://battle/online/RemoteOnlineRoomTransport.gd")
const DATA_REPOSITORY_SCRIPT: Script = preload("res://battle/data/BattleDataRepository.gd")
const PROFILE_BUILDER_SCRIPT: Script = preload("res://battle/data/CharacterProfileBuilder.gd")
const OPPONENT_CACHE_SCRIPT: Script = preload("res://account/OnlineRoomOpponentCache.gd")
const ROOM_STATE_MODEL_SCRIPT: Script = preload("res://battle/online/RoomStateModel.gd")
const ONLINE_BATTLE_CONTEXT_SCRIPT: Script = preload("res://battle/online/OnlineBattleContext.gd")
const RECONNECT_SCRIPT: Script = preload("res://network/online/ReconnectController.gd")
const CHARACTER_SELECTION_SCENE: PackedScene = preload("res://scenes/roster/roster_picker.tscn")
const MENU_SCENE_PATH: String = "res://scenes/home/home.tscn"
const FIGHT_SCENE_PATH: String = "res://scenes/roster/roster_picker.tscn"
const FIGHT_RUNTIME_SCENE_PATH: String = "res://scenes/battle/battle_scene.tscn"
const COMMUNITY_SCENE_PATH: String = "res://scenes/community/community.tscn"
const LOGIN_SCENE_PATH: String = "res://scenes/auth/auth_login.tscn"
const ONLINE_ROOM_SCENE_PATH: String = "res://scenes/online/online_room.tscn"
const USER_SCENE_PATH: String = "res://scenes/profile/profile_page.tscn"
const SERVER_OPTIONS: Array[Dictionary] = [
	{"id":"local_mock", "label":"本地 Mock"},
	{"id":"official", "label":"官方联机服务器"},
]

signal request_finished(operation: StringName, response: Dictionary)

@onready var _room_page: Control = $RoomPage
@onready var _matchmaking_page: Control = $MatchmakingPage
@onready var _room_tab: BaseButton = $TopBar/RoomTab
@onready var _match_tab: BaseButton = $TopBar/MatchTab

var _gateway: OnlineRoomGateway = GATEWAY_SCRIPT.new() as OnlineRoomGateway
var _reconnect: ReconnectController = RECONNECT_SCRIPT.new() as ReconnectController
# 官方联机服务器是网页端和桌面端的默认目标；本地 Mock 仅在用户手动选择后启用。
var _server_index: int = 1
var _character_locked: bool = false
var _room_mode_index: int = 0
var _spectator_allowed: bool = true
var _room_character_id: String = ""
var _active_room_id: String = ""
var _active_room: Dictionary = {}
var _local_guest_id: String = ""
var _battle_transition_started: bool = false
var _room_socket_started: bool = false
var _room_socket_retry_at_ms: int = 0
var _picker: PopupPanel
var _server_picker: PopupPanel
var _room_character_picker: PopupPanel
const SERVERS: Array[String] = ["本地 Mock", "官方联机服务器"]
# The V3 authority currently owns a two-player match only.  Do not expose
# modes that would require a different room/battle contract and then turn a
# normal player click into an unsupported network request.
const ROOM_MODES: Array[String] = ["1v1"]
const POPUP_BUTTON_TEXTURE: Texture2D = preload("res://art/onlineroom/房间页面/按钮1.png")
const POPUP_BUTTON_HOVER_TEXTURE: Texture2D = preload("res://art/onlineroom/房间页面/按钮2.png")
const POPUP_PANEL_TEXTURE: Texture2D = preload("res://art/onlineroom/房间页面/服务器选择.png")

func _ready() -> void:
	UI.ignore_decorations(self)
	_configure_local_transport()
	_populate_matchmaking_options()
	_sync_server_choice_ui()
	_connect_button(_room_tab, show_room_page)
	_connect_button(_match_tab, show_matchmaking_page)
	_bind_room_controls()
	_bind_matchmaking_controls()
	_bind_navigation("RoomPage")
	_bind_navigation("MatchmakingPage/Background2")
	_apply_account_labels()
	_set_online_bottom_navigation_state()
	_room_character_id = _selection_player_id()
	_refresh_room_character_label()
	show_matchmaking_page(false)
	_refresh_player_score()
	_join_room_from_invite_link()
	_configure_room_code_input()
	# 联机大厅由两个独立页面组成：顶层只播放 Tab 淡入，当前子页按菜单式
	# 背景/Header/主体节奏播放，避免整张页面统一从左侧滑入。
	PAGE_ENTRANCE.play(self, ["RoomPage", "MatchmakingPage"])
	_play_online_page_entrance(_matchmaking_page)

func _process(_delta: float) -> void:
	if _battle_transition_started: return
	_ensure_room_socket()
	for event: Dictionary in _gateway.pump_socket():
		match str(event.get("type", "")):
			"room_state_changed":
				var room: Dictionary = event.get("room", {}) as Dictionary
				if not room.is_empty(): _apply_room_response({"ok":true, "room":room})
			"peer_disconnected":
				_room_socket_retry_at_ms = Time.get_ticks_msec() + 1500
			"error":
				push_warning("online room socket error: %s" % str(event.get("error", "unknown")))

func _ensure_room_socket() -> void:
	if _active_room_id.is_empty(): return
	if _room_socket_started:
		if _gateway.socket_state() != &"CLOSED": return
		_room_socket_started = false
	var now: int = Time.get_ticks_msec()
	if now < _room_socket_retry_at_ms: return
	var connected: Dictionary = _gateway.connect_room_socket(_active_room_id)
	if bool(connected.get("ok", false)):
		_room_socket_started = true
		_room_socket_retry_at_ms = 0
	else:
		_room_socket_retry_at_ms = now + 1500

func _disconnect_room_socket() -> void:
	if not _room_socket_started: return
	_gateway.disconnect_room_socket()
	_room_socket_started = false
	_room_socket_retry_at_ms = 0

func _exit_tree() -> void:
	_disconnect_room_socket()

## 未来 HTTP/WebSocket 层可注入一个实现 request_online_room(packet) 的 RefCounted。
func set_transport(transport: RefCounted) -> void:
	_gateway.set_transport(transport)

## The Worker is optional at runtime. When absent, request results remain explicit
## `local_worker_unavailable` errors instead of a fabricated online success state.
func _configure_local_transport() -> void:
	_apply_server_transport()

func _apply_server_transport() -> void:
	var server: Dictionary = SERVER_OPTIONS[_server_index]
	if str(server.get("id", "")) == "local_mock":
		# Local browser and desktop previews use the same V3 room authority as
		# production. Keeping room creation and battle input on one protocol
		# prevents a legacy 8787 packet from reaching the V3 endpoint.
		var local_endpoint: String = _local_room_endpoint()
		_gateway.set_transport(REMOTE_TRANSPORT_SCRIPT.new(local_endpoint, _remote_identity(), false) as RefCounted)
		return
	var remote_endpoint: String = _official_room_endpoint()
	_gateway.set_transport(REMOTE_TRANSPORT_SCRIPT.new(remote_endpoint, _remote_identity(), true) as RefCounted)

func _official_room_endpoint() -> String:
	var configured: String = OS.get_environment("PREVIEW_ROOM_URL").strip_edges()
	if not configured.is_empty(): return configured.rstrip("/")
	# Official mode always targets the deployed HTTPS service. The local origin
	# is reserved exclusively for the explicit Mock server selection below.
	return "https://119.91.224.223/preview-room-api"

func _local_mock_endpoint() -> String:
	var configured: String = OS.get_environment("LOCAL_ONLINE_WORKER_URL").strip_edges()
	if not configured.is_empty(): return configured
	if not OS.has_feature("web"): return ""
	var origin: Variant = JavaScriptBridge.eval("window.location.origin", true)
	return str(origin).rstrip("/") + "/local-worker-api" if origin is String and not str(origin).is_empty() else ""

func _local_room_endpoint() -> String:
	var configured: String = OS.get_environment("PREVIEW_ROOM_URL").strip_edges()
	if not configured.is_empty(): return configured.rstrip("/")
	if OS.has_feature("web"):
		var origin: Variant = JavaScriptBridge.eval("window.location.origin", true)
		if origin is String and not str(origin).is_empty(): return str(origin).rstrip("/") + "/preview-room-api"
	return "http://127.0.0.1:8789"

func _remote_identity() -> Dictionary:
	var account: Node = get_node_or_null("/root/AccountState")
	var card: Dictionary = account.call("active_card") as Dictionary if account != null and account.has_method("active_card") else {}
	var card_id: String = str(card.get("id", "")).strip_edges()
	# Room membership must use the same browser-tab identity from creation to
	# battle input.  Using card_id here while _local_player_id() stays tab-scoped
	# makes Fight unable to find its own side after a login card is loaded.
	var session_id: String = _local_player_id()
	if card_id.is_empty():
		return {"identityId":session_id, "guest":true, "storedCharacters":[]}
	return {"identityId":session_id, "cardId":card_id, "guest":false, "storedCharacters":card.get("stored_characters", []) as Array}

func _local_player_id() -> String:
	# Local Web mock runs in multiple tabs during two-player testing. A login-card
	# ID is shared by both tabs, so it cannot be used as the transport identity.
	# sessionStorage is tab-scoped and keeps each side distinct while preserving
	# the selected card/character snapshot in the room payload.
	if OS.has_feature("web") and ClassDB.class_exists("JavaScriptBridge"):
		if not _local_guest_id.is_empty(): return _local_guest_id
		var tab_id: Variant = JavaScriptBridge.eval("(() => { try { const key = 'jjk.preview.local_tab_id.' + String(performance.timeOrigin); let id = sessionStorage.getItem(key); if (!id) { id = 'tab-' + (crypto.randomUUID ? crypto.randomUUID() : (Date.now() + '-' + Math.random().toString(16).slice(2))); sessionStorage.setItem(key, id); } return id; } catch (e) { return ''; } })()", true)
		if tab_id is String and not str(tab_id).strip_edges().is_empty():
			_local_guest_id = str(tab_id).strip_edges()
			return _local_guest_id
		# A blocked browser storage API must still produce a per-runtime identity;
		# falling back to AccountState.card_id would merge two local tabs again.
		_local_guest_id = "tab-fallback-%d-%d" % [Time.get_ticks_msec(), randi()]
		return _local_guest_id
	var account: Node = get_node_or_null("/root/AccountState")
	if account != null and account.has_method("active_card"):
		var card: Dictionary = account.call("active_card") as Dictionary
		var card_id: String = str(card.get("id", "")).strip_edges()
		if not card_id.is_empty():
			return card_id
	if not _local_guest_id.is_empty(): return _local_guest_id
	_local_guest_id = "guest-%d-%d" % [Time.get_ticks_msec(), randi()]
	return _local_guest_id

func request_operation(operation: StringName, payload: Dictionary) -> Dictionary:
	if has_node("/root/ErrorService"):
		get_node("/root/ErrorService").record_action(String(operation), payload)
	var response: Dictionary = _gateway.request(operation, payload)
	if not bool(response.get("ok", false)):
		var raw_error: Variant = response.get("error", "")
		var code := str((raw_error as Dictionary).get("code", "")) if raw_error is Dictionary else str(raw_error)
		code = code.to_lower()
		if code.contains("stale") or code.contains("revision"):
			_reconnect.on_resync_response(false)
	request_finished.emit(operation, response)
	return response

func show_room_page(animate: bool = true) -> void:
	_set_active_page(_matchmaking_page, _room_page, animate)
	_room_tab.disabled = true
	_match_tab.disabled = false

func show_matchmaking_page(animate: bool = true) -> void:
	_set_active_page(_room_page, _matchmaking_page, animate)
	_room_tab.disabled = false
	_match_tab.disabled = true

func _set_active_page(previous: Control, next: Control, animate: bool) -> void:
	if not animate or UI.reduced_motion():
		previous.hide()
		next.show()
		_play_online_page_entrance(next)
		return
	previous.hide()
	next.modulate.a = 1.0
	next.show()
	_play_online_page_entrance(next)

func _play_online_page_entrance(page: Control) -> void:
	if page == null:
		return
	# 页面切换时允许该子页重新播放一次入口动画。
	page.set_meta("page_entrance_played", false)
	PAGE_ENTRANCE.play(page)
	# MatchmakingPage 的 Header 位于 Background2 内，不能由根层遍历识别；
	# 单独复用菜单标题上方进入和用户工具淡入的节奏。
	var header: Control = page.get_node_or_null("Background2/Header") as Control
	if header == null:
		header = page.get_node_or_null("Header") as Control
	if header == null:
		return
	if header == null or bool(header.get_meta("online_header_entrance_played", false)):
		return
	header.set_meta("online_header_entrance_played", true)
	var origin: Vector2 = header.position
	header.position = origin + Vector2(0.0, -18.0)
	header.modulate.a = 0.0
	var tween: Tween = create_tween().set_parallel(true)
	tween.set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_OUT)
	tween.tween_property(header, "position", origin, 0.45).set_delay(0.18)
	tween.tween_property(header, "modulate:a", 1.0, 0.42).set_delay(0.18)

func _bind_room_controls() -> void:
	_connect("RoomPage/ServeChoose/ServeChoose", _on_server_pressed)
	_connect("RoomPage/RoomSeeting/RoomControl/CreatNewRoom", _on_create_room_pressed)
	# 右侧区域负责输入房间码、选择入场角色并加入房间。
	_connect("RoomPage/RoomSeeting/CharacterSelect/CreatNewRoom", _on_join_room_pressed)
	_connect("RoomPage/RoomSeeting/RoomControl/JoinRoom", _on_join_room_pressed)
	_connect("RoomPage/RoomSeeting/RoomControl/RoomId/RoomId/CreatNewRoom", _on_copy_room_code_pressed)
	_connect("RoomPage/Join/LockCharacter", _on_lock_character_pressed)
	_connect("RoomPage/Join/LockCharacter/Visit", _on_watch_room_pressed)
	_connect("RoomPage/Join/Preview", _on_preview_pressed)
	_connect("RoomPage/Header/MoreButton", _on_more_pressed)
	_connect("RoomPage/Header/UserButton", _on_user_pressed)
	_connect("RoomPage/RoomSeeting/RoomControl/DeleteRoom", _on_delete_room_pressed)
	_bind_room_character_select()
	_bind_room_click_feedback(_room_page)
	var join_code: LineEdit = get_node_or_null("RoomPage/RoomSeeting/CharacterSelect/RoomId/ID") as LineEdit
	if join_code != null and not join_code.text_submitted.is_connected(_on_room_code_submitted): join_code.text_submitted.connect(_on_room_code_submitted)

func _bind_matchmaking_controls() -> void:
	_connect("MatchmakingPage/Basic/InteractiveLayer/RefreshButton", _on_refresh_servers_pressed)
	_connect("MatchmakingPage/Basic/InteractiveLayer/StartMatchButton", _on_start_match_pressed)
	_connect("MatchmakingPage/Background2/Header/MoreButton", _on_more_pressed)
	_connect("MatchmakingPage/Background2/Header/UserButton", _on_user_pressed)
	var character: OptionButton = get_node_or_null("MatchmakingPage/Basic/InteractiveLayer/ParticipantCharacter") as OptionButton
	if character != null and not character.item_selected.is_connected(_on_match_character_selected): character.item_selected.connect(_on_match_character_selected)
	var region: OptionButton = get_node_or_null("MatchmakingPage/Basic/InteractiveLayer/ServerRegion") as OptionButton
	if region != null and not region.item_selected.is_connected(_on_match_region_selected): region.item_selected.connect(_on_match_region_selected)

func _bind_navigation(root_path: String) -> void:
	_connect(root_path + "/BottomNav/HomeButton", func() -> void: UI.navigate(self, MENU_SCENE_PATH))
	_connect(root_path + "/BottomNav/CharacterButton", func() -> void: UI.navigate(self, FIGHT_SCENE_PATH))
	_connect(root_path + "/BottomNav/BattleButton", func() -> void: UI.navigate(self, FIGHT_SCENE_PATH))
	_connect(root_path + "/BottomNav/ForumButton", func() -> void: UI.navigate(self, COMMUNITY_SCENE_PATH))
	_connect(root_path + "/BottomNav/ArchiveButton", func() -> void: UI.navigate(self, ONLINE_ROOM_SCENE_PATH))

## 积分只采信服务端持久化数据。未接入传输层时保持占位值，绝不沿用场景里的设计稿假数据。
func _refresh_player_score() -> void:
	var label: Label = get_node_or_null("MatchmakingPage/Basic/Score/Score") as Label
	if label == null:
		return
	label.text = "--"
	label.tooltip_text = "等待联机积分服务"
	var response: Dictionary = request_operation(&"getPlayerScore", _score_request_payload())
	if not bool(response.get("ok", false)):
		return
	var score_value: Variant = response.get("score", (response.get("data", {}) as Dictionary).get("score", null))
	if score_value is int or score_value is float:
		label.text = String.num(float(score_value), 0)
		label.tooltip_text = "服务端已保存积分"

func _score_request_payload() -> Dictionary:
	var account: Node = get_node_or_null("/root/AccountState")
	if account == null or not account.has_method("active_card"):
		return {}
	var card: Dictionary = account.call("active_card") as Dictionary
	var player_id: String = str(card.get("id", "")).strip_edges()
	return {"player_id":player_id} if not player_id.is_empty() else {}

func _on_server_pressed() -> void:
	_show_server_picker()
	_pulse_path("RoomPage/ServeChoose/ServeChoose")

func _show_server_picker() -> void:
	if _server_picker != null and is_instance_valid(_server_picker):
		_server_picker.popup_centered()
		return
	_server_picker = PopupPanel.new()
	_server_picker.name = "OnlineServerPicker"
	_server_picker.size = Vector2i(430, 238)
	_apply_popup_panel_style(_server_picker)
	var options := VBoxContainer.new()
	options.name = "Options"
	options.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT, Control.PRESET_MODE_MINSIZE, 24)
	var title := Label.new()
	title.name = "Title"
	title.text = "选择联机服务器"
	title.custom_minimum_size = Vector2(0, 34)
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	title.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	title.add_theme_color_override("font_color", Color("2b211b"))
	title.add_theme_font_size_override("font_size", 20)
	options.add_child(title)
	var local: TextureButton = _make_texture_popup_button("LocalMock", "本地 Mock · V3 8789", Vector2(320, 52))
	local.pressed.connect(_select_server.bind(0))
	options.add_child(local)
	var official: TextureButton = _make_texture_popup_button("Official", "官方联机服务器 · HTTPS", Vector2(320, 52))
	official.pressed.connect(_select_server.bind(1))
	options.add_child(official)
	_server_picker.add_child(options)
	add_child(_server_picker)
	_server_picker.popup_centered()

func _select_server(index: int) -> void:
	_server_index = clampi(index, 0, SERVER_OPTIONS.size() - 1)
	_apply_server_transport()
	_refresh_server_choice()
	_refresh_player_score()
	if _server_picker != null: _server_picker.hide()
	_pulse_path("RoomPage/ServeChoose/ServeChoose")

func _refresh_server_choice() -> void:
	_sync_server_choice_ui()
	# Server choice is a client-side endpoint selector. Do not send a fake
	# listServers operation to the authority, which only owns room and battle state.

func _sync_server_choice_ui() -> void:
	var server_label: RichTextLabel = get_node_or_null("RoomPage/ServeChoose/RichTextLabel") as RichTextLabel
	if server_label != null: server_label.text = "当前服务器：" + SERVERS[_server_index]
	var region: OptionButton = get_node_or_null("MatchmakingPage/Basic/InteractiveLayer/ServerRegion") as OptionButton
	if region != null and region.selected != _server_index: region.select(_server_index)

func _on_create_room_pressed() -> void:
	var payload: Dictionary = {"mode":ROOM_MODES[_room_mode_index], "region":SERVERS[_server_index], "spectator_allowed":_spectator_allowed}
	payload.merge(_room_character_payload(), true)
	var response: Dictionary = request_operation(&"createRoom", payload)
	_apply_room_response(response)
	_show_response("创建房间", response)

func _on_room_mode_pressed() -> void:
	_room_mode_index = 0
	var label: Label = get_node_or_null("RoomPage/RoomSeeting/RoomControl/Room/Room") as Label
	if label != null: label.text = ROOM_MODES[_room_mode_index]
	var button: Control = get_node_or_null("RoomPage/InteractiveLayer/RoomModeTag") as Control
	if button != null:
		button.tooltip_text = "当前权威对战仅开放 1v1"
		UI.pulse(button)
	UI.notice(self, "房间模式", "当前联机服务支持 1v1 对战。")

func _on_spectate_policy_pressed() -> void:
	_spectator_allowed = not _spectator_allowed
	var button: Control = get_node_or_null("RoomPage/InteractiveLayer/SpectateTag") as Control
	if button != null:
		button.modulate = Color.WHITE if _spectator_allowed else Color(0.55, 0.55, 0.55, 1.0)
		button.tooltip_text = "允许观战" if _spectator_allowed else "禁止观战"
		UI.pulse(button)
	_show_response("观战设置", request_operation(&"setSpectatorPolicy", {"allowed":_spectator_allowed}))

func _on_join_room_pressed() -> void:
	var room_code: String = _room_code()
	if room_code.is_empty():
		UI.notice(self, "加入房间", "请先输入或粘贴房间码。")
		return
	var payload: Dictionary = {"room_id":room_code}
	payload.merge(_room_character_payload(), true)
	var response: Dictionary = request_operation(&"joinRoom", payload)
	_apply_room_response(response)
	_show_response("加入房间", response)

func _on_watch_room_pressed() -> void:
	UI.notice(self, "观战暂未开放", "当前权威服务仅允许两名参赛玩家进入房间。")

func _on_delete_room_pressed() -> void:
	var room_code: String = _room_code()
	if room_code.is_empty():
		UI.notice(self, "删除房间", "当前没有可删除的房间。")
		return
	var response: Dictionary = request_operation(&"deleteRoom", {"room_id":room_code})
	_apply_room_response(response)
	if bool(response.get("ok", false)):
		_active_room_id = ""
		_refresh_room_code_views()
	_show_response("删除房间", response)

func _on_room_code_submitted(_submitted: String) -> void:
	_on_join_room_pressed()

func _on_copy_room_code_pressed() -> void:
	var room_code: String = _room_code()
	if room_code.is_empty():
		UI.notice(self, "复制房间码", "当前尚未由服务器创建房间。")
		return
	DisplayServer.clipboard_set(room_code)
	UI.notice(self, "复制房间码", "房间码已复制。")

func _on_copy_room_link_pressed() -> void:
	var room_code: String = _room_code()
	if room_code.is_empty():
		UI.notice(self, "复制邀请链接", "请先创建或加入房间。")
		return
	DisplayServer.clipboard_set("https://119.91.224.223/preview/?room=" + room_code.uri_encode())
	UI.notice(self, "复制邀请链接", "房间邀请链接已复制。")

## Web invitations carry only the public room code.  On entering the room page,
## a recipient joins through the same backend operation as a manually supplied code.
func _join_room_from_invite_link() -> void:
	if not OS.has_feature("web") or not ClassDB.class_exists("JavaScriptBridge"):
		return
	var value: Variant = JavaScriptBridge.eval("new URLSearchParams(window.location.search).get('room')", true)
	var room_code: String = str(value).strip_edges().to_lower()
	if not room_code.begins_with("prv-"):
		return
	_active_room_id = room_code
	_refresh_room_code_views()
	_on_join_room_pressed()

func _on_lock_character_pressed() -> void:
	var room_code: String = _room_code()
	if room_code.is_empty():
		UI.notice(self, "角色锁定", "请先创建或加入房间。")
		return
	var next_locked: bool = not _character_locked
	var payload: Dictionary = {"locked":next_locked, "room_id":room_code}
	payload.merge(_room_character_payload(), true)
	var response: Dictionary = request_operation(&"lockCharacter", payload)
	_apply_room_response(response)
	if bool(response.get("ok", false)):
		_character_locked = next_locked
		var label: Label = get_node_or_null("RoomPage/Join/LockCharacter/Lock") as Label
		if label != null: label.text = "解锁角色" if _character_locked else "锁定角色"
		var phase: Label = get_node_or_null("RoomPage/Join/Label") as Label
		if phase != null: phase.text = "角色已锁定，等待对手" if _character_locked else "准备阶段"
	_show_response("角色锁定", response)

func _on_preview_pressed() -> void:
	_show_character_preview()
	_pulse_path("RoomPage/Join/Preview")

func _on_room_character_select_pressed() -> void:
	_show_character_picker()

func _bind_room_character_select() -> void:
	for node_path: NodePath in [NodePath("RoomPage/RoomSeeting/RoomControl/Select"), NodePath("RoomPage/RoomSeeting/CharacterSelect/Character1")]:
		var select: Control = get_node_or_null(node_path) as Control
		if select == null: continue
		select.mouse_filter = Control.MOUSE_FILTER_STOP
		select.tooltip_text = "点击选择联机角色"
		if not select.gui_input.is_connected(_on_room_character_select_input):
			select.gui_input.connect(_on_room_character_select_input)

func _on_room_character_select_input(event: InputEvent) -> void:
	if event is InputEventMouseButton and (event as InputEventMouseButton).pressed and (event as InputEventMouseButton).button_index == MOUSE_BUTTON_LEFT:
		_show_room_character_picker()

func _show_room_character_picker() -> void:
	if _room_character_picker != null and is_instance_valid(_room_character_picker):
		_room_character_picker.popup_centered_ratio(0.65)
		return
	_room_character_picker = PopupPanel.new()
	_room_character_picker.name = "RoomCharacterPicker"
	_room_character_picker.size = Vector2i(650, 540)
	_apply_popup_panel_style(_room_character_picker)
	var list := VBoxContainer.new()
	list.name = "CharacterPickerList"
	var scroll := ScrollContainer.new()
	scroll.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	scroll.add_child(list)
	_room_character_picker.add_child(scroll)
	var custom_entries: Array[Dictionary] = []
	var official_entries: Array[Dictionary] = []
	var seen: Dictionary = {}
	var account: Node = get_node_or_null("/root/AccountState")
	var card: Dictionary = account.call("active_card") as Dictionary if account != null and account.has_method("active_card") else {}
	for raw: Variant in card.get("stored_characters", []) as Array:
		if not raw is Dictionary: continue
		var entry: Dictionary = raw as Dictionary
		var character_id: String = str(entry.get("characterId", entry.get("id", ""))).strip_edges()
		if character_id.is_empty() or seen.has(character_id): continue
		seen[character_id] = true
		custom_entries.append({"id":character_id, "name":str(entry.get("displayName", entry.get("name", character_id))), "kind":"登录卡角色"})
	var repository: RefCounted = DATA_REPOSITORY_SCRIPT.new() as RefCounted
	for raw: Variant in repository.call("characters") as Array:
		if not raw is Dictionary: continue
		var entry: Dictionary = raw as Dictionary
		var character_id: String = str(entry.get("id", entry.get("characterId", ""))).strip_edges()
		if character_id.is_empty() or seen.has(character_id): continue
		seen[character_id] = true
		official_entries.append({"id":character_id, "name":str(entry.get("name", entry.get("displayName", character_id))), "kind":"官方角色"})
	for entry: Dictionary in custom_entries + official_entries:
		var button: TextureButton = _make_texture_popup_button("Character_" + str(entry.id), "%s  ·  %s" % [str(entry.name), str(entry.kind)], Vector2(580, 44))
		button.pressed.connect(_choose_room_character.bind(str(entry.id)))
		list.add_child(button)
	add_child(_room_character_picker)
	_room_character_picker.popup_centered_ratio(0.65)

func _show_character_picker() -> void:
	if _picker != null and is_instance_valid(_picker):
		_picker.popup_centered_ratio(0.65)
		return
	_picker = PopupPanel.new()
	_picker.name = "OnlineCharacterPicker"
	_picker.size = Vector2i(650, 540)
	_apply_popup_panel_style(_picker)
	var list := VBoxContainer.new()
	list.name = "CharacterPickerList"
	list.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT, Control.PRESET_MODE_MINSIZE, 18)
	var scroll := ScrollContainer.new()
	scroll.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	scroll.add_child(list)
	_picker.add_child(scroll)
	var repository: RefCounted = DATA_REPOSITORY_SCRIPT.new() as RefCounted
	for raw: Variant in repository.call("characters") as Array:
		if not raw is Dictionary: continue
		var entry: Dictionary = raw as Dictionary
		var id: String = str(entry.get("id", entry.get("characterId", "")))
		if id.is_empty(): continue
		var button: TextureButton = _make_texture_popup_button("Character_" + id, "%s  ·  %s" % [str(entry.get("name", entry.get("displayName", id))), str(entry.get("visibleGrade", ""))], Vector2(580, 44))
		button.pressed.connect(_choose_room_character.bind(id))
		list.add_child(button)
	add_child(_picker)
	_picker.popup_centered_ratio(0.65)

func _make_texture_popup_button(button_name: String, label_text: String, minimum_size: Vector2) -> TextureButton:
	var button: TextureButton = TextureButton.new()
	button.name = button_name
	button.custom_minimum_size = minimum_size
	button.ignore_texture_size = true
	button.stretch_mode = TextureButton.STRETCH_SCALE
	button.texture_normal = POPUP_BUTTON_TEXTURE
	button.texture_hover = POPUP_BUTTON_HOVER_TEXTURE
	button.texture_pressed = POPUP_BUTTON_HOVER_TEXTURE
	button.tooltip_text = label_text
	var label: Label = Label.new()
	label.name = "Label"
	label.text = label_text
	label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	label.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT, Control.PRESET_MODE_MINSIZE, 8)
	label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	label.add_theme_color_override("font_color", Color("2b211b"))
	label.add_theme_font_size_override("font_size", 16)
	button.add_child(label)
	return button

func _apply_popup_panel_style(popup: PopupPanel) -> void:
	if popup == null: return
	var panel := StyleBoxTexture.new()
	panel.texture = POPUP_PANEL_TEXTURE
	panel.texture_margin_left = 44.0
	panel.texture_margin_top = 24.0
	panel.texture_margin_right = 44.0
	panel.texture_margin_bottom = 24.0
	panel.expand_margin_left = 3.0
	panel.expand_margin_top = 3.0
	panel.expand_margin_right = 3.0
	panel.expand_margin_bottom = 3.0
	popup.add_theme_stylebox_override("panel", panel)

func _choose_room_character(character_id: String) -> void:
	_room_character_id = character_id
	var selection: Node = get_node_or_null("/root/SelectionState")
	if selection != null and selection.has_method("set_player_id"): selection.call("set_player_id", character_id)
	_refresh_room_character_label()
	if _picker != null: _picker.hide()
	if _room_character_picker != null: _room_character_picker.hide()

func _refresh_room_character_label() -> void:
	var custom_name: String = ""
	var account: Node = get_node_or_null("/root/AccountState")
	var card: Dictionary = account.call("active_card") as Dictionary if account != null and account.has_method("active_card") else {}
	for raw: Variant in card.get("stored_characters", []) as Array:
		if raw is Dictionary and str((raw as Dictionary).get("characterId", (raw as Dictionary).get("id", ""))) == _room_character_id:
			custom_name = str((raw as Dictionary).get("displayName", (raw as Dictionary).get("name", _room_character_id)))
			break
	var display_name: String = custom_name + " · 登录卡角色" if not custom_name.is_empty() else str(PROFILE_BUILDER_SCRIPT.new().build(_room_character_id).get("name", _room_character_id if not _room_character_id.is_empty() else "请选择角色"))
	for node_path: NodePath in [NodePath("RoomPage/RoomSeeting/RoomControl/Select/Character"), NodePath("RoomPage/RoomSeeting/CharacterSelect/Character1/Character")]:
		var label: Label = get_node_or_null(node_path) as Label
		if label != null: label.text = display_name

func _show_character_preview() -> void:
	var popup := PopupPanel.new()
	popup.name = "OnlineCharacterPreview"
	popup.size = Vector2i(1020, 560)
	_apply_popup_panel_style(popup)
	# 直接复用角色选择页的 CharacterContent，而非重画一份近似面板。
	var selection: Control = CHARACTER_SELECTION_SCENE.instantiate() as Control
	var player_card: Control = selection.get_node("CharacterContent/PlayerCharacterSlots/PlayerCharacter") as Control
	var player_name: Label = selection.get_node("CharacterContent/PlayerCharacterSlots/PlayerCharacter/Name") as Label
	var opponent_card: Control = selection.get_node("CharacterContent/OpponentCharacterSlots/OpponentCharacter") as Control
	var opponent_name: Label = selection.get_node("CharacterContent/OpponentCharacterSlots/OpponentCharacter/Name") as Label
	selection.call("_refresh_profile", player_card, player_name, _room_character_id)
	selection.call("_refresh_profile", opponent_card, opponent_name, _selection_opponent_id())
	var content: Control = (selection.get_node("CharacterContent") as Control).duplicate() as Control
	selection.queue_free()
	content.name = "CharacterContent"
	_remove_preview_picker_buttons(content)
	content.scale = Vector2(0.60, 0.60)
	content.position = Vector2(12, 18)
	popup.add_child(content)
	add_child(popup)
	popup.popup_centered()
	popup.popup_hide.connect(popup.queue_free)

func _remove_preview_picker_buttons(node: Node) -> void:
	for child: Node in node.get_children():
		if child is BaseButton and (str(child.name).contains("PlayerCharacterButton") or str(child.name).contains("OpponentCharacterButton")):
			child.queue_free()
		else:
			_remove_preview_picker_buttons(child)

func _on_refresh_servers_pressed() -> void:
	_show_response("刷新服务器", request_operation(&"listServers", {"preferred_region":SERVERS[_server_index]}))
	_pulse_path("MatchmakingPage/Basic/InteractiveLayer/RefreshButton")

func _on_start_match_pressed() -> void:
	var character: OptionButton = get_node_or_null("MatchmakingPage/Basic/InteractiveLayer/ParticipantCharacter") as OptionButton
	var region: OptionButton = get_node_or_null("MatchmakingPage/Basic/InteractiveLayer/ServerRegion") as OptionButton
	var character_id: String = str(character.get_item_metadata(character.selected)) if character != null else ""
	var payload: Dictionary = {"region":region.get_item_text(region.selected) if region != null else SERVERS[_server_index]}
	payload.merge(_room_character_payload_for(character_id), true)
	var response: Dictionary = request_operation(&"queueMatch", payload)
	# Older deployed room authorities predate queue_match but already support the
	# authoritative private-room battle flow.  Turning the user's matchmaking
	# click into an invite room keeps PvP playable while a rolling server update
	# reaches that cluster; a current authority never enters this branch.
	if _is_matchmaking_unsupported(response):
		var fallback_payload: Dictionary = {"spectator_allowed":false}
		fallback_payload.merge(_room_character_payload_for(character_id), true)
		response = request_operation(&"createRoom", fallback_payload)
		_apply_room_response(response)
		if bool(response.get("ok", false)):
			show_room_page()
			UI.notice(self, "匹配服务更新中", "已创建 1v1 邀请房间。复制房间码邀请好友后，双方锁定角色即可开战。")
			return
	_apply_room_response(response)
	if bool(response.get("ok", false)):
		show_room_page()
		var matched: bool = bool((response.get("data", {}) as Dictionary).get("matched", false))
		UI.notice(self, "快速匹配", "已匹配到对手，双方锁定角色后开始对战。" if matched else "已进入匹配队列，正在等待对手加入。")
	else:
		_show_response("开始匹配", response)
	_pulse_path("MatchmakingPage/Basic/InteractiveLayer/StartMatchButton")

func _is_matchmaking_unsupported(response: Dictionary) -> bool:
	if bool(response.get("ok", false)):
		return false
	var error_value: Variant = response.get("error", "")
	var code: String = str((error_value as Dictionary).get("code", "")) if error_value is Dictionary else str(error_value)
	return code.to_upper() == "INVALID_REQUEST"

func _on_match_character_selected(selected_index: int) -> void:
	var option: OptionButton = get_node_or_null("MatchmakingPage/Basic/InteractiveLayer/ParticipantCharacter") as OptionButton
	if option != null:
		option.tooltip_text = "参赛角色：" + option.get_item_text(selected_index)
		UI.pulse(option)

func _on_match_region_selected(selected_index: int) -> void:
	_server_index = clampi(selected_index, 0, SERVERS.size() - 1)
	_refresh_server_choice()
	var option: OptionButton = get_node_or_null("MatchmakingPage/Basic/InteractiveLayer/ServerRegion") as OptionButton
	if option != null: UI.pulse(option)

func _on_more_pressed() -> void:
	UI.show_settings(self, _return_to_login)

func _on_user_pressed() -> void:
	UI.open_user_panel(self)

func _return_to_login() -> void:
	var account: Node = get_node_or_null("/root/AccountState")
	if account != null and account.has_method("clear_session"): account.call("clear_session")
	UI.navigate(self, LOGIN_SCENE_PATH)

func _show_response(title: String, response: Dictionary) -> void:
	if bool(response.get("ok", false)):
		UI.notice(self, title, "请求已被联机服务接受。")
	else:
		var raw_error: Variant = response.get("error", "request_failed")
		var error_code: String = str((raw_error as Dictionary).get("code", "request_failed")) if raw_error is Dictionary else str(raw_error)
		var user_message := _error_user_message(error_code)
		var error_service: Node = get_node_or_null("/root/ErrorService")
		if error_service != null and error_service.has_method("report"):
			error_service.call("report", error_code.to_upper(), "NETWORK", error_code, user_message, {
				"request_id": str(response.get("requestId", response.get("request_id", ""))),
				"trace_id": str(response.get("traceId", response.get("trace_id", ""))),
				"room_id": _active_room_id,
				"scene": "OnlineRoom",
				"operation": title,
			}, {"response": response})
		UI.notice(self, title, "%s\n错误编号：%s" % [user_message, error_code.to_upper()])

func _error_user_message(code: String) -> String:
	match code.to_upper():
		"STALE_BATTLE_REVISION", "STALE_ROOM_REVISION": return "对局状态已变化，正在重新同步。"
		"ROOM_NOT_FOUND": return "房间不存在或已关闭。"
		"ROOM_FULL": return "房间已满，无法加入。"
		"BATTLE_NOT_READY": return "双方尚未完成角色锁定。"
		"UPSTREAM_UNAVAILABLE", "LOCAL_WORKER_UNAVAILABLE": return "联机服务暂时不可用，请稍后重试。"
		"INVALID_STAGE", "INVALID_STAGE_INPUT": return "当前阶段不允许执行该操作。"
		"INVALID_REQUEST": return "当前联机服务版本不支持此操作。"
		_: return "请求失败，请检查网络和当前对局状态。"

func _room_code() -> String:
	# 用户明确输入的房间码优先于当前房间，方便直接切换到另一间房。
	var visible_input: LineEdit = get_node_or_null("RoomPage/RoomSeeting/CharacterSelect/RoomId/ID") as LineEdit
	if visible_input != null and not visible_input.text.strip_edges().is_empty():
		return visible_input.text.strip_edges()
	if not _active_room_id.is_empty(): return _active_room_id
	return ""

func _apply_room_response(response: Dictionary) -> void:
	if not bool(response.get("ok", false)): return
	# 正式预览服务把房间放在 data.room / roomId；本地 mock 使用顶层 room / room_id。
	# 统一在边界处归一化，避免成功提示与房间码显示不一致。
	var data: Dictionary = response.get("data", {}) as Dictionary
	var room: Dictionary = _normalize_room_state(data.get("room", response.get("room", {})) as Dictionary)
	var room_id: String = str(room.get("roomId", room.get("room_id", ""))).strip_edges()
	if room_id.is_empty(): return
	_active_room_id = room_id
	_active_room = room.duplicate(true)
	_refresh_room_code_views()
	_apply_room_state(room)
	if not _active_room_id.is_empty() and not _room_socket_started:
		_room_socket_started = bool(_gateway.connect_room_socket(_active_room_id).get("ok", false))

func _normalize_room_state(raw: Dictionary) -> Dictionary:
	return ROOM_STATE_MODEL_SCRIPT.call("normalize", raw) as Dictionary

func _refresh_room_code_views() -> void:
	var visible_input: LineEdit = get_node_or_null("RoomPage/RoomSeeting/CharacterSelect/RoomId/ID") as LineEdit
	if visible_input != null: visible_input.text = _active_room_id
	var current_code: Label = get_node_or_null("RoomPage/RoomSeeting/RoomControl/RoomId/RoomId") as Label
	if current_code != null:
		current_code.text = "当前房间码：" + (_active_room_id if not _active_room_id.is_empty() else "未创建")

func _configure_room_code_input() -> void:
	var input: LineEdit = get_node_or_null("RoomPage/RoomSeeting/CharacterSelect/RoomId/ID") as LineEdit
	if input == null: return
	input.editable = true
	input.shortcut_keys_enabled = true
	input.context_menu_enabled = true
	input.tooltip_text = "可直接 Ctrl+V 粘贴房间码"

func _apply_room_state(room: Dictionary) -> void:
	var players: Array = room.get("players", []) as Array
	var local_id: String = _local_player_id()
	var opponent: Dictionary = ROOM_STATE_MODEL_SCRIPT.call("opponent_for", room, local_id) as Dictionary
	var enemy: Label = get_node_or_null("RoomPage/RoomSeeting/RoomControl/JoinRoom/Enemy") as Label
	var opponent_label: Label = get_node_or_null("RoomPage/RoomSeeting/CharacterSelect/Character2/Character") as Label
	if opponent.is_empty():
		if enemy != null: enemy.text = "等待对方加入中"
		if opponent_label != null: opponent_label.text = "等待对方加入中"
		return
	var opponent_id: String = str(opponent.get("character_id", "")).strip_edges()
	var snapshot: Dictionary = opponent.get("character_snapshot", {}) as Dictionary
	if not snapshot.is_empty(): OPPONENT_CACHE_SCRIPT.call("set_snapshot", snapshot)
	var opponent_name: String = str(snapshot.get("displayName", snapshot.get("name", ""))).strip_edges()
	if opponent_name.is_empty() and not opponent_id.is_empty():
		opponent_name = str(PROFILE_BUILDER_SCRIPT.new().build(opponent_id).get("name", opponent_id))
	if opponent_name.is_empty(): opponent_name = "对方角色待确认"
	if opponent_label != null: opponent_label.text = opponent_name
	# Joining is enough to make a character previewable; locking only gates battle start.
	var selection: Node = get_node_or_null("/root/SelectionState")
	if selection != null and selection.has_method("set_opponent_id") and not opponent_id.is_empty(): selection.call("set_opponent_id", opponent_id)
	if not bool(opponent.get("locked", false)):
		if enemy != null: enemy.text = "对方已加入，未锁定"
		return
	if enemy != null: enemy.text = opponent_name
	if str(room.get("state", "")) == "battle_ready": _start_locked_room_battle(players)

func _start_locked_room_battle(players: Array) -> void:
	if _battle_transition_started or not bool(ROOM_STATE_MODEL_SCRIPT.call("is_battle_ready", _active_room)): return
	# Fight 用占位会话进入页面，随后 getBattleBootstrap 返回仅对本方授权的
	# V3 投影。这里不得再下载双方完整登录卡快照。
	_battle_transition_started = true
	_disconnect_room_socket()
	# Fight 必须知道这来自双人房间；不能再退化为 start_fixed_offline 的 CPU 回合。
	var local_mode: bool = _server_index == 0
	var endpoint: String = _local_room_endpoint() if local_mode else _official_room_endpoint()
	if endpoint.is_empty(): endpoint = "http://127.0.0.1:8789" if local_mode else "https://119.91.224.223/preview-room-api"
	ONLINE_BATTLE_CONTEXT_SCRIPT.call("activate", _active_room, _local_player_id(), endpoint, "remote", _remote_identity())
	UI.navigate(self, FIGHT_RUNTIME_SCENE_PATH)

func _battle_snapshot_error_message(response: Dictionary) -> String:
	var error_value: Variant = response.get("error", "unknown")
	var code_value: Variant = error_value
	if error_value is Dictionary:
		code_value = error_value.get("code", "unknown")
	var code: String = str(code_value).to_lower()
	if code == "unsupported_online_room_operation":
		return "服务器未配置角色快照同步，当前无法开战。请切换到本地 Mock 或更新联机服务器。"
	if code in ["battle_not_ready", "room_not_ready"]:
		return "双方角色尚未完成锁定，暂时无法开战。"
	return "角色快照同步失败：%s" % code

func _bind_room_click_feedback(node: Node) -> void:
	for child: Node in node.get_children():
		if child is BaseButton and not str(child.get_path()).contains("BottomNav") and not bool(child.get_meta("online_click_animated", false)):
			var button: BaseButton = child as BaseButton
			if not bool(button.get_meta("room_button_feedback_bound", false)):
				button.set_meta("room_button_feedback_bound", true)
				button.button_down.connect(UI.pulse.bind(button))
		_bind_room_click_feedback(child)

func _selected_room_character() -> String:
	return _room_character_id

func _room_character_payload() -> Dictionary:
	return _room_character_payload_for(_selected_room_character())

func _room_character_payload_for(character_id: String) -> Dictionary:
	var snapshot: Dictionary = {}
	var account: Node = get_node_or_null("/root/AccountState")
	var card: Dictionary = account.call("active_card") as Dictionary if account != null and account.has_method("active_card") else {}
	for raw: Variant in card.get("stored_characters", []) as Array:
		if raw is Dictionary and str((raw as Dictionary).get("characterId", (raw as Dictionary).get("id", ""))) == character_id:
			snapshot = (raw as Dictionary).duplicate(true)
			break
	if snapshot.is_empty() and not character_id.is_empty(): snapshot = PROFILE_BUILDER_SCRIPT.new().build(character_id)
	return {"character_id":character_id, "character_snapshot":snapshot}

func _selection_player_id() -> String:
	var selection: Node = get_node_or_null("/root/SelectionState")
	return str(selection.call("get_player_id")) if selection != null and selection.has_method("get_player_id") else ""

func _selection_opponent_id() -> String:
	var selection: Node = get_node_or_null("/root/SelectionState")
	return str(selection.call("get_opponent_id")) if selection != null and selection.has_method("get_opponent_id") else ""

func _set_online_bottom_navigation_state() -> void:
	# 两个联机子页属于 OC/联机档案域：Archive 高亮、Home 保持未选中。
	for path: String in ["RoomPage/BottomNav", "MatchmakingPage/Background2/BottomNav"]:
		var nav: Node = get_node_or_null(path)
		if nav != null and nav.has_method("select"): nav.call("select", 4)

func _apply_account_labels() -> void:
	var account: Node = get_node_or_null("/root/AccountState")
	var card: Dictionary = account.call("active_card") as Dictionary if account != null and account.has_method("active_card") else {}
	var name: String = str(card.get("nickname", "游客"))
	for node_path: String in ["RoomPage/Header/UserButton/UserName", "MatchmakingPage/Background2/Header/UserButton/UserName"]:
		var label: Label = get_node_or_null(node_path) as Label
		if label != null: label.text = name

func _populate_matchmaking_options() -> void:
	var character: OptionButton = get_node_or_null("MatchmakingPage/Basic/InteractiveLayer/ParticipantCharacter") as OptionButton
	if character != null:
		character.clear()
		var repository: RefCounted = DATA_REPOSITORY_SCRIPT.new() as RefCounted
		var entries: Array = repository.call("characters") as Array
		for entry: Variant in entries:
			if not entry is Dictionary: continue
			var profile: Dictionary = entry as Dictionary
			var character_id: String = str(profile.get("id", profile.get("characterId", "")))
			if character_id.is_empty(): continue
			character.add_item(str(profile.get("name", profile.get("displayName", character_id))))
			character.set_item_metadata(character.item_count - 1, character_id)
		if character.item_count == 0:
			character.add_item("暂无可选角色")
			character.set_item_metadata(0, "")
	var region: OptionButton = get_node_or_null("MatchmakingPage/Basic/InteractiveLayer/ServerRegion") as OptionButton
	if region != null:
		region.clear()
		for server: String in SERVERS: region.add_item(server)

func _connect(node_path: NodePath, callback: Callable) -> void:
	var button: BaseButton = get_node_or_null(node_path) as BaseButton
	if button != null: _connect_button(button, callback)

func _connect_button(button: BaseButton, callback: Callable) -> void:
	if bool(button.get_meta("online_click_animated", false)): return
	button.set_meta("online_click_animated", true)
	button.pressed.connect(func() -> void:
		UI.pulse(button)
		callback.call())

func _pulse_path(node_path: NodePath) -> void:
	var control: Control = get_node_or_null(node_path) as Control
	if control != null: UI.pulse(control)





