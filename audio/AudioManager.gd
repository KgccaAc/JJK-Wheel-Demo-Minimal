class_name GameAudioManager
extends Node

## 全局音频边界：页面只表达语义事件，不保存播放器或本地文件路径。
## 音乐来自用户本机提供的文件，已转码为 Godot 原生支持的 MP3；请勿把这些
## 非 CC0 音乐作为项目可再分发素材发布。

const SETTINGS_PATH: String = "user://client.cfg"
const LOGIN_MUSIC: String = "res://assets/audio/music/login_blue_sumi_ka.mp3"
const MENU_MUSIC: String = "res://assets/audio/music/menu_lost_in_paradise.mp3"
const GOJO_BATTLE_MUSIC: String = "res://assets/audio/music/battle_gojo_shinjuku.mp3"
const BATTLE_MUSIC: Array[String] = [
	"res://assets/audio/music/battle_specialz.mp3",
	"res://assets/audio/music/battle_kaikai_kitan.mp3",
	"res://assets/audio/music/battle_aizo.mp3",
]
const SFX: Dictionary = {
	&"ui_click": "res://assets/audio/groups/LIKE/所战斗外点击.ogg",
	&"battle_click": "res://assets/audio/groups/LIKE/战斗内点击.ogg",
	&"card_deal": "res://assets/audio/groups/LIKE/卡牌收发.ogg",
	&"card_play": "res://assets/audio/groups/LIKE/出牌.ogg",
	&"card_discard": "res://assets/audio/groups/LIKE/06_卡牌弃置.ogg",
	&"wheel_spin": "res://assets/audio/groups/LIKE/卡牌收发.ogg",
}
const SWORD_ATTACKS: Array[String] = [
	"res://assets/audio/groups/LIKE/攻击音效组/01_剑鸣_清响.ogg",
	"res://assets/audio/groups/LIKE/攻击音效组/02_剑鸣_短促.ogg",
	"res://assets/audio/groups/LIKE/攻击音效组/03_剑鸣_锐响.ogg",
	"res://assets/audio/groups/LIKE/攻击音效组/04_剑鸣_重响.ogg",
	"res://assets/audio/groups/LIKE/攻击音效组/05_剑鸣_格挡.ogg",
	"res://assets/audio/groups/LIKE/攻击音效组/06_剑鸣_交锋.ogg",
	"res://assets/audio/groups/LIKE/攻击音效组/07_剑鸣_铮然.ogg",
	"res://assets/audio/groups/LIKE/攻击音效组/08_剑鸣_回荡.ogg",
	"res://assets/audio/groups/LIKE/攻击音效组/09_剑鸣_震颤.ogg",
	"res://assets/audio/groups/LIKE/攻击音效组/10_剑鸣_余韵.ogg",
]
const DOMAIN_EXPANSION_SFX: Array[String] = [
	"res://领域展开音效库/领域展开1.mp3",
	"res://领域展开音效库/领域展开2.mp3",
	"res://领域展开音效库/领域展开3.mp3",
	"res://领域展开音效库/领域展开4.mp3",
	"res://领域展开音效库/领域展开6.mp3",
	"res://领域展开音效库/领域展开7.mp3",
	"res://领域展开音效库/领域展开8.mp3",
	"res://领域展开音效库/领域展开9.mp3",
]
const GOJO_ID: String = "gojo_satoru_shinjuku"
const GOJO_THEME_CHANCE: float = 0.5
const MIN_VOLUME_DB: float = -48.0
const MAX_MUSIC_VOLUME_DB: float = -8.0
const MAX_SFX_VOLUME_DB: float = 4.0
const DEFAULT_MUSIC_VOLUME_DB: float = -16.0
const DEFAULT_SFX_VOLUME_DB: float = 0.0
## 领域展开是独立的叙事爆点；不改变普通按钮/出牌音效的默认响度。
const DOMAIN_EXPANSION_GAIN_DB: float = 6.0
const DEFAULT_WHEEL_VOICE_VOLUME: float = 1.0
const MAX_WHEEL_VOICE_VOLUME: int = 100

## These short, frequent sounds are decoded before the first input event.
## It avoids a disk/PCK lookup on the audio-critical click and card paths.
const PRELOADED_SFX_EVENTS: Array[StringName] = [
	&"ui_click", &"battle_click", &"card_deal", &"card_play", &"card_discard", &"wheel_spin",
]

var _music_player: AudioStreamPlayer
var _sfx_player: AudioStreamPlayer
var _rng: RandomNumberGenerator = RandomNumberGenerator.new()
var _current_music_path: String = ""
var _stream_cache: Dictionary = {}

func _ready() -> void:
	_rng.randomize()
	_music_player = AudioStreamPlayer.new()
	_music_player.name = "MusicPlayer"
	_music_player.bus = &"Master"
	_music_player.volume_db = music_volume()
	add_child(_music_player)
	_music_player.finished.connect(_on_music_finished)
	_sfx_player = AudioStreamPlayer.new()
	_sfx_player.name = "SfxPlayer"
	_sfx_player.bus = &"Master"
	_sfx_player.volume_db = sfx_volume()
	add_child(_sfx_player)
	_warm_frequent_sfx_cache()
	get_tree().node_added.connect(_on_node_added)
	call_deferred("_bind_existing_buttons")

func sound_enabled() -> bool:
	return music_enabled() or sfx_enabled()

func music_enabled() -> bool:
	var config: ConfigFile = ConfigFile.new()
	config.load(SETTINGS_PATH)
	return bool(config.get_value("audio", "music_enabled", config.get_value("audio", "sound_enabled", true)))

func sfx_enabled() -> bool:
	var config: ConfigFile = ConfigFile.new()
	config.load(SETTINGS_PATH)
	return bool(config.get_value("audio", "sfx_enabled", config.get_value("audio", "sound_enabled", true)))

func set_sound_enabled(enabled: bool) -> void:
	set_music_enabled(enabled)
	set_sfx_enabled(enabled)

func set_music_enabled(enabled: bool) -> void:
	var config: ConfigFile = ConfigFile.new()
	config.load(SETTINGS_PATH)
	config.set_value("audio", "music_enabled", enabled)
	var error: Error = config.save(SETTINGS_PATH)
	if error != OK:
		push_warning("声音设置保存失败：%s" % error_string(error))
	if not enabled:
		_music_player.stop()
	elif not _current_music_path.is_empty():
		_play_music_path(_current_music_path)

func set_sfx_enabled(enabled: bool) -> void:
	_save_audio_setting("sfx_enabled", enabled)
	if not enabled and _sfx_player != null:
		_sfx_player.stop()

func wheel_voice_enabled() -> bool:
	var config: ConfigFile = ConfigFile.new()
	config.load(SETTINGS_PATH)
	return bool(config.get_value("audio", "wheel_voice_enabled", true))

func set_wheel_voice_enabled(enabled: bool) -> void:
	_save_audio_setting("wheel_voice_enabled", enabled)

func wheel_voice_volume() -> float:
	var config: ConfigFile = ConfigFile.new()
	config.load(SETTINGS_PATH)
	return clampf(float(config.get_value("audio", "wheel_voice_volume", DEFAULT_WHEEL_VOICE_VOLUME)), 0.0, 1.0)

func set_wheel_voice_volume(value: float) -> void:
	_save_audio_setting("wheel_voice_volume", clampf(value, 0.0, 1.0))

func music_volume() -> float:
	return _saved_volume("music_volume_db", DEFAULT_MUSIC_VOLUME_DB, MAX_MUSIC_VOLUME_DB)

func sfx_volume() -> float:
	return _saved_volume("sfx_volume_db", DEFAULT_SFX_VOLUME_DB, MAX_SFX_VOLUME_DB)

func set_music_volume(value_db: float) -> void:
	var normalized: float = clampf(value_db, MIN_VOLUME_DB, MAX_MUSIC_VOLUME_DB)
	_save_audio_setting("music_volume_db", normalized)
	if _music_player != null:
		_music_player.volume_db = normalized

func set_sfx_volume(value_db: float) -> void:
	var normalized: float = clampf(value_db, MIN_VOLUME_DB, MAX_SFX_VOLUME_DB)
	_save_audio_setting("sfx_volume_db", normalized)
	if _sfx_player != null:
		_sfx_player.volume_db = normalized

func play_login_music() -> void:
	_play_music_path(LOGIN_MUSIC)

func play_menu_music() -> void:
	_play_music_path(MENU_MUSIC)

func play_battle_music(player_id: String, opponent_id: String) -> void:
	_play_music_path(choose_battle_music(player_id, opponent_id))

func choose_battle_music(player_id: String, opponent_id: String, force_gojo_theme: bool = false) -> String:
	var has_gojo: bool = player_id == GOJO_ID or opponent_id == GOJO_ID
	if has_gojo and (force_gojo_theme or _rng.randf() < GOJO_THEME_CHANCE):
		return GOJO_BATTLE_MUSIC
	return BATTLE_MUSIC[_rng.randi_range(0, BATTLE_MUSIC.size() - 1)]

func current_music_path() -> String:
	return _current_music_path

func play_ui_sfx(event: StringName) -> void:
	if not sfx_enabled() or not SFX.has(event):
		return
	var stream: AudioStream = _load_stream(str(SFX[event]))
	if stream == null:
		push_warning("音效资源不可用：%s" % event)
		return
	_sfx_player.stream = stream
	_sfx_player.play()


func bind_click_sfx(value: Variant) -> void:
	if value == null or not is_instance_valid(value): return
	if not value is BaseButton: return
	var button: BaseButton = value as BaseButton
	if not is_instance_valid(button): return
	if button.has_meta("audio_click_bound"):
		return
	button.set_meta("audio_click_bound", true)
	# `pressed` fires on release. Playing on button_down keeps browser input and
	# audio in the same user gesture, which removes the perceptible delay.
	button.button_down.connect(play_ui_sfx.bind(&"ui_click"))


func is_sfx_preloaded(event: StringName) -> bool:
	return SFX.has(event) and _stream_cache.has(str(SFX[event]))

func play_sword_attack() -> void:
	if SWORD_ATTACKS.is_empty():
		return
	_play_parallel_sfx(SWORD_ATTACKS[_rng.randi_range(0, SWORD_ATTACKS.size() - 1)])

func choose_domain_expansion_paths(count: int) -> Array[String]:
	var remaining: Array[String] = DOMAIN_EXPANSION_SFX.duplicate()
	var chosen: Array[String] = []
	for _index: int in range(mini(maxi(count, 0), remaining.size())):
		var index: int = _rng.randi_range(0, remaining.size() - 1)
		chosen.append(remaining[index])
		remaining.remove_at(index)
	return chosen

func play_domain_expansions(count: int) -> void:
	for path: String in choose_domain_expansion_paths(count):
		_play_parallel_sfx(path, DOMAIN_EXPANSION_GAIN_DB)

func play_wheel_spin() -> void:
	play_ui_sfx(&"wheel_spin")

func announce_wheel_result(result_text: String) -> void:
	if not wheel_voice_enabled() or result_text.is_empty():
		return
	# Godot 的第三个参数才是音量；此前把音量错误传给了语速，导致
	# 即使滑块为最大仍固定以 50% 朗读。
	DisplayServer.tts_speak(result_text, "", roundi(wheel_voice_volume() * MAX_WHEEL_VOICE_VOLUME), 1.0, 1.0, 0, true)

func _play_music_path(path: String) -> void:
	_current_music_path = path
	if not music_enabled():
		return
	var stream: AudioStream = _load_stream(path)
	if stream == null:
		push_warning("背景音乐资源不可用：%s" % path)
		return
	if _music_player.playing and _music_player.stream == stream:
		return
	_music_player.stream = stream
	_music_player.play()

func _on_music_finished() -> void:
	if _music_player == null or _current_music_path.is_empty() or not music_enabled():
		return
	# Keep the current stream; changing pages calls _play_music_path and replaces
	# the path before this callback can fire for the next track.
	_music_player.play()

func _saved_volume(key: String, default_value: float, maximum: float) -> float:
	var config: ConfigFile = ConfigFile.new()
	config.load(SETTINGS_PATH)
	return clampf(float(config.get_value("audio", key, default_value)), MIN_VOLUME_DB, maximum)

func _save_audio_setting(key: String, value: Variant) -> void:
	var config: ConfigFile = ConfigFile.new()
	config.load(SETTINGS_PATH)
	config.set_value("audio", key, value)
	var error: Error = config.save(SETTINGS_PATH)
	if error != OK:
		push_warning("声音设置保存失败：%s" % error_string(error))

func _play_parallel_sfx(path: String, gain_db: float = 0.0) -> void:
	if not sfx_enabled():
		return
	var stream: AudioStream = _load_stream(path)
	if stream == null:
		push_warning("音效资源不可用：%s" % path)
		return
	var player: AudioStreamPlayer = AudioStreamPlayer.new()
	player.stream = stream
	player.bus = &"Master"
	player.volume_db = sfx_volume() + gain_db
	add_child(player)
	player.finished.connect(player.queue_free)
	player.play()


func _warm_frequent_sfx_cache() -> void:
	for event: StringName in PRELOADED_SFX_EVENTS:
		if SFX.has(event):
			_load_stream(str(SFX[event]))
	for path: String in SWORD_ATTACKS:
		_load_stream(path)
	for path: String in DOMAIN_EXPANSION_SFX:
		_load_stream(path)


func _load_stream(path: String) -> AudioStream:
	if _stream_cache.has(path):
		return _stream_cache[path] as AudioStream
	var stream: AudioStream = load(path) as AudioStream
	if stream != null:
		_stream_cache[path] = stream
	return stream

func _on_node_added(node: Node) -> void:
	if node is BaseButton:
		call_deferred("bind_click_sfx", node as BaseButton)

func _bind_existing_buttons() -> void:
	_bind_buttons_in(get_tree().root)

func _bind_buttons_in(node: Node) -> void:
	if node is BaseButton:
		bind_click_sfx(node as BaseButton)
	for child: Node in node.get_children():
		_bind_buttons_in(child)

