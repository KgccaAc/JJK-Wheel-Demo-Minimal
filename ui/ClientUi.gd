class_name ClientUi
extends RefCounted

## 跨页面共用的小型UI工具；不持有战斗状态或场景引用。
const SETTINGS_PATH: String = "user://client.cfg"
const USER_SCENE_PATH: String = "res://scenes/profile/profile_page.tscn"
const MENU_SCENE_PATH: String = "res://scenes/home/home.tscn"
const USER_PANEL_SCENE: PackedScene = preload("res://scenes/profile/profile_page.tscn")

static func settings() -> ConfigFile:
	var config: ConfigFile = ConfigFile.new()
	config.load(SETTINGS_PATH)
	return config

static func reduced_motion() -> bool:
	return bool(settings().get_value("display", "reduced_motion", false))

static func navigate(page: Node, path: String, bypass_transition: bool = false) -> void:
	if page.get_meta("navigating", false) and not bypass_transition: return
	page.set_meta("navigating", true)
	if not bypass_transition:
		var transition: Node = page.get_node_or_null("/root/StoryTransition")
		if transition != null and transition.has_method("play"):
			if bool(transition.call("play", page, path, "fade")): return
	var router: Node = page.get_node_or_null("/root/PageRouter")
	if router != null and router.has_method("navigate"):
		if bool(router.call("navigate", path)):
			return
		page.set_meta("navigating", false)
		notice(page, "无法打开页面", "页面加载失败，请返回后重试。")
		return
	var error: Error = page.get_tree().change_scene_to_file(path)
	if error != OK:
		page.set_meta("navigating", false)
		notice(page, "无法打开页面", "页面加载失败，请返回后重试。")

## 用户页是覆盖在来源页面上的临时面板。来源页面始终留在场景树内，
## 因此收起时不会重新触发来源页的开场动画或丢失页面中的临时状态。
static func open_user_panel(page: Node) -> void:
	if not page is Control:
		return
	var source := page as Control
	if source.get_node_or_null("UserPanelOverlay") != null:
		return
	var panel: Control = USER_PANEL_SCENE.instantiate() as Control
	if panel == null:
		notice(source, "无法打开账户页", "用户面板加载失败。")
		return
	panel.name = "UserPanelOverlay"
	panel.set_meta("user_panel_overlay", true)
	panel.z_index = 100
	panel.mouse_filter = Control.MOUSE_FILTER_STOP
	panel.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	source.add_child(panel)

static func return_from_user_panel(page: Node) -> void:
	if page is Control and bool(page.get_meta("user_panel_overlay", false)):
		var panel := page as Control
		if reduced_motion():
			panel.queue_free()
			return
		var tween: Tween = panel.create_tween()
		tween.set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_OUT)
		tween.tween_property(panel, "modulate:a", 0.0, 0.18)
		tween.finished.connect(panel.queue_free, CONNECT_ONE_SHOT)
		return
	# 用户场景若被开发者直接单独启动，没有来源层时才回退到菜单。
	navigate(page, MENU_SCENE_PATH)

static func notice(page: Node, heading: String, text: String) -> void:
	# A room response can arrive while a scene transition is already freeing the
	# lobby. Popups require an attached Window, so silently ignore stale notices.
	if page == null or not is_instance_valid(page) or not page.is_inside_tree():
		return
	var dialog: AcceptDialog = page.get_node_or_null("ClientNotice") as AcceptDialog
	if dialog == null:
		dialog = AcceptDialog.new()
		dialog.name = "ClientNotice"
		dialog.exclusive = true
		dialog.dialog_autowrap = true
		page.add_child(dialog)
	dialog.title = heading
	dialog.dialog_text = text
	if dialog.is_inside_tree(): dialog.popup_centered_clamped(Vector2i(560, 260))

static func show_settings(page: Node, on_return_to_login: Callable = Callable()) -> void:
	var dialog: AcceptDialog = page.get_node_or_null("ClientSettings") as AcceptDialog
	if dialog == null:
		dialog = AcceptDialog.new()
		dialog.name = "ClientSettings"
		dialog.title = "显示设置"
		dialog.exclusive = true
		var content: VBoxContainer = VBoxContainer.new()
		content.name = "SettingsContent"
		content.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
		content.offset_bottom = -48
		var motion: CheckButton = CheckButton.new()
		motion.name = "ReducedMotion"
		motion.text = "减少界面动画（下次进入页面生效）"
		motion.button_pressed = reduced_motion()
		motion.toggled.connect(func(enabled: bool) -> void: _save_setting("reduced_motion", enabled))
		content.add_child(motion)
		var audio: Node = page.get_node_or_null("/root/AudioManager")
		var music_enabled: CheckButton = CheckButton.new()
		music_enabled.name = "MusicEnabled"
		music_enabled.text = "开启背景音乐"
		music_enabled.button_pressed = bool(audio.call("music_enabled")) if audio != null and audio.has_method("music_enabled") else bool(settings().get_value("audio", "music_enabled", settings().get_value("audio", "sound_enabled", true)))
		music_enabled.toggled.connect(func(enabled: bool) -> void:
			if audio != null and audio.has_method("set_music_enabled"):
				audio.call("set_music_enabled", enabled)
			else:
				_save_setting_in_section("audio", "music_enabled", enabled))
		content.add_child(music_enabled)
		var sfx_enabled: CheckButton = CheckButton.new()
		sfx_enabled.name = "SfxEnabled"
		sfx_enabled.text = "开启音效"
		sfx_enabled.button_pressed = bool(audio.call("sfx_enabled")) if audio != null and audio.has_method("sfx_enabled") else bool(settings().get_value("audio", "sfx_enabled", settings().get_value("audio", "sound_enabled", true)))
		sfx_enabled.toggled.connect(func(enabled: bool) -> void:
			if audio != null and audio.has_method("set_sfx_enabled"):
				audio.call("set_sfx_enabled", enabled)
			else:
				_save_setting_in_section("audio", "sfx_enabled", enabled))
		content.add_child(sfx_enabled)
		var wheel_voice_enabled: CheckButton = CheckButton.new()
		wheel_voice_enabled.name = "WheelVoiceEnabled"
		wheel_voice_enabled.text = "播报抽取结果"
		wheel_voice_enabled.button_pressed = bool(audio.call("wheel_voice_enabled")) if audio != null and audio.has_method("wheel_voice_enabled") else bool(settings().get_value("audio", "wheel_voice_enabled", true))
		wheel_voice_enabled.toggled.connect(func(enabled: bool) -> void:
			if audio != null and audio.has_method("set_wheel_voice_enabled"):
				audio.call("set_wheel_voice_enabled", enabled)
			else:
				_save_setting_in_section("audio", "wheel_voice_enabled", enabled))
		content.add_child(wheel_voice_enabled)
		var music_label: Label = Label.new()
		music_label.name = "MusicVolumeLabel"
		music_label.text = "音乐音量（最高 -8 dB）"
		content.add_child(music_label)
		var music: HSlider = HSlider.new()
		music.name = "MusicVolume"
		music.min_value = -48.0
		music.max_value = -8.0
		music.step = 0.01
		music.value = float(audio.call("music_volume")) if audio != null and audio.has_method("music_volume") else float(settings().get_value("audio", "music_volume_db", -16.0))
		music.value_changed.connect(func(value: float) -> void:
			if audio != null and audio.has_method("set_music_volume"):
				audio.call("set_music_volume", value)
			else:
				_save_setting_in_section("audio", "music_volume_db", value))
		content.add_child(music)
		var sfx_label: Label = Label.new()
		sfx_label.name = "SfxVolumeLabel"
		sfx_label.text = "音效音量（最高 +4 dB）"
		content.add_child(sfx_label)
		var sfx: HSlider = HSlider.new()
		sfx.name = "SfxVolume"
		sfx.min_value = -48.0
		sfx.max_value = 4.0
		sfx.step = 0.01
		sfx.value = float(audio.call("sfx_volume")) if audio != null and audio.has_method("sfx_volume") else float(settings().get_value("audio", "sfx_volume_db", 0.0))
		sfx.value_changed.connect(func(value: float) -> void:
			if audio != null and audio.has_method("set_sfx_volume"):
				audio.call("set_sfx_volume", value)
			else:
				_save_setting_in_section("audio", "sfx_volume_db", value))
		content.add_child(sfx)
		var wheel_voice_label: Label = Label.new()
		wheel_voice_label.name = "WheelVoiceVolumeLabel"
		wheel_voice_label.text = "抽取语音音量"
		content.add_child(wheel_voice_label)
		var wheel_voice: HSlider = HSlider.new()
		wheel_voice.name = "WheelVoiceVolume"
		wheel_voice.min_value = 0.0
		wheel_voice.max_value = 1.0
		wheel_voice.step = 0.01
		wheel_voice.value = float(audio.call("wheel_voice_volume")) if audio != null and audio.has_method("wheel_voice_volume") else float(settings().get_value("audio", "wheel_voice_volume", 1.0))
		wheel_voice.value_changed.connect(func(value: float) -> void:
			if audio != null and audio.has_method("set_wheel_voice_volume"):
				audio.call("set_wheel_voice_volume", value)
			else:
				_save_setting_in_section("audio", "wheel_voice_volume", value))
		content.add_child(wheel_voice)
		var fullscreen: CheckButton = CheckButton.new()
		fullscreen.name = "Fullscreen"
		fullscreen.text = "全屏显示"
		fullscreen.button_pressed = DisplayServer.window_get_mode() == DisplayServer.WINDOW_MODE_FULLSCREEN
		fullscreen.toggled.connect(func(enabled: bool) -> void:
			_save_setting("fullscreen", enabled)
			DisplayServer.window_set_mode(DisplayServer.WINDOW_MODE_FULLSCREEN if enabled else DisplayServer.WINDOW_MODE_WINDOWED))
		content.add_child(fullscreen)
		dialog.add_child(content)
		page.add_child(dialog)
	var content_node: VBoxContainer = dialog.get_node_or_null("SettingsContent") as VBoxContainer
	var logout: Button = dialog.get_node_or_null("SettingsContent/ReturnToLogin") as Button
	if on_return_to_login.is_valid() and logout == null and content_node != null:
		logout = Button.new()
		logout.name = "ReturnToLogin"
		logout.text = "退出到登录界面"
		logout.pressed.connect(func() -> void:
			dialog.hide()
			on_return_to_login.call())
		content_node.add_child(logout)
	dialog.popup_centered_clamped(Vector2i(580, 230))

static func _save_setting(key: String, value: Variant) -> void:
	_save_setting_in_section("display", key, value)

static func _save_setting_in_section(section: String, key: String, value: Variant) -> void:
	var config: ConfigFile = settings()
	config.set_value(section, key, value)
	var error: Error = config.save(SETTINGS_PATH)
	if error != OK: push_warning("设置保存失败：%s" % error_string(error))

## 一个控件只允许一条点击缩放动画；基准只记录一次，连续点击不会越缩越小。
static func pulse(control: Control) -> void:
	if reduced_motion(): return
	if not control.has_meta("rest_scale"): control.set_meta("rest_scale", control.scale)
	var previous: Tween = control.get_meta("click_tween") as Tween if control.has_meta("click_tween") else null
	if previous != null and previous.is_valid(): previous.kill()
	var base: Vector2 = control.get_meta("rest_scale")
	var tween: Tween = control.create_tween()
	control.set_meta("click_tween", tween)
	tween.set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
	tween.tween_property(control, "scale", base * 0.96, 0.08)
	tween.tween_property(control, "scale", base, 0.12)

static func bind_button_feedback(node: Node) -> void:
	for child: Node in node.get_children():
		if child is BaseButton:
			var button := child as BaseButton
			if not button.has_meta("feedback_bound"):
				button.set_meta("feedback_bound", true)
				button.mouse_entered.connect(_on_button_hover.bind(button, true))
				button.mouse_exited.connect(_on_button_hover.bind(button, false))
				button.focus_entered.connect(_on_button_hover.bind(button, true))
				button.focus_exited.connect(_on_button_hover.bind(button, false))
				button.pressed.connect(pulse.bind(button))
		bind_button_feedback(child)

static func _on_button_hover(button: BaseButton, active: bool) -> void:
	if reduced_motion(): return
	if not button.has_meta("hover_scale"): button.set_meta("hover_scale", button.scale)
	var base: Vector2 = button.get_meta("hover_scale")
	var tween := button.create_tween()
	tween.set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_OUT)
	tween.tween_property(button, "scale", base * (1.025 if active else 1.0), 0.1)

## 纯装饰层不能拦截后方按钮；滚动区/文本输入保留自身事件处理。
static func ignore_decorations(node: Node) -> void:
	for child: Node in node.get_children():
		if child is Control and not child is BaseButton and not child is ScrollContainer and not child is Range and not child is LineEdit and not child is TextEdit:
			(child as Control).mouse_filter = Control.MOUSE_FILTER_IGNORE
		ignore_decorations(child)



