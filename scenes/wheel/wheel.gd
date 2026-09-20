class_name WheelScreen
extends Control

const BACK_BUTTON_TEXTURE: Texture2D = preload("res://art/menu/菜单大按钮.png")
const NAV_BUTTON_TEXTURE: Texture2D = preload("res://art/wheel/选择跳转按钮.png")

const Run = preload("res://data/WheelRun.gd")
const RankEvaluator = preload("res://data/WheelRankEvaluator.gd")
const FlowSession = preload("res://data/wheel/WheelFlowSession.gd")
const WheelTechniqueRegistry = preload("res://scenes/wheel/WheelTechniqueRegistry.gd")
const LoginCardCharacterCache = preload("res://account/LoginCardCharacterCache.gd")
const UI: Script = preload("res://ui/ClientUi.gd")
const PAGE_ENTRANCE: Script = preload("res://ui/PageEntrance.gd")
var history: Array[Dictionary] = []
var results: Dictionary = {}
var history_path: String = "user://wheel_history.json"
var _generation: int = 0
var _batch: bool = false
var _summary: AcceptDialog
var _rank_result: Dictionary = {}
var _rank_decision: ConfirmationDialog
var _saved_character_details: AcceptDialog
var _advance_after_summary: bool = false
var _confirmed_character_snapshot: Dictionary = {}

@onready var wheel_segments: WheelSegments = $WheelArea/WheelSegments
@onready var result_label: Label = $WheelArea/ResultLabel
@onready var draw_button: BaseButton = $DrawButton
@onready var reset_button: BaseButton = $ResetButton
@onready var rank_button: BaseButton = $RankButton
@onready var animation_button: BaseButton = $Identity/SettingsRows/Options/Animation

const WHEEL_DATA_PATH: String = "res://public/wheels.json"
const FALLBACK_WHEEL_DATA_PATH: String = "res://data/wheels.json"
const STRENGTH_DATA_PATH: String = "res://data/wheel/source/strength-v0.2-candidate.json"
const USER_SCENE_PATH: String = "res://scenes/profile/profile_page.tscn"
var wheel_items: Array[Dictionary] = []
var wheel_title: String = "穿越后的初始身份"
var wheel_sets: Array[Dictionary] = []
var current_wheel_index: int = 0
var pre_delay_ms: int = 0
var spin_duration_ms: int = 1200
var post_delay_ms: int = 0
var result_jump_delay_ms: int = 0
var last_draw_pre_delay_ms: int = 0
var last_draw_spin_duration_ms: int = 1200
var last_draw_post_delay_ms: int = 0
var last_draw_jump_delay_ms: int = 0
var _rng: RandomNumberGenerator = RandomNumberGenerator.new()
var _is_spinning: bool = false
var _spin_tween: Tween = null
var animation_enabled: bool = true

func _ready() -> void:
	_rng.randomize()
	_load_history()
	_load_wheel_data()
	draw_button.pressed.connect(draw_wheel)
	reset_button.pressed.connect(reset_wheel)
	rank_button.pressed.connect(_on_rank_pressed)
	animation_button.pressed.connect(toggle_animation)
	var before_button: BaseButton = get_node_or_null("Identity/SettingsRows/Before/Control") as BaseButton
	var rotate_button: BaseButton = get_node_or_null("Identity/SettingsRows/Rotate/Control") as BaseButton
	var after_button: BaseButton = get_node_or_null("Identity/SettingsRows/After/Control") as BaseButton
	var jump_button: BaseButton = get_node_or_null("Identity/SettingsRows/Jump/Control") as BaseButton
	if before_button != null: before_button.tooltip_text = "切换抽取前等待时间"
	if rotate_button != null: rotate_button.tooltip_text = "切换转盘旋转时间"
	if after_button != null: after_button.tooltip_text = "切换结果展示时间"
	if jump_button != null: jump_button.tooltip_text = "切换自动跳转时间"
	animation_button.tooltip_text = "开启或关闭转盘动画"
	if before_button != null: before_button.pressed.connect(func() -> void: cycle_timing("pre"))
	if rotate_button != null: rotate_button.pressed.connect(func() -> void: cycle_timing("rotate"))
	if after_button != null: after_button.pressed.connect(func() -> void: cycle_timing("post"))
	if jump_button != null: jump_button.pressed.connect(func() -> void: cycle_timing("jump"))
	_create_wheel_navigation()
	_setup_controls()
	_bind_button_pulses(self)
	_refresh_status()
	_refresh_timing()
	# 转盘页的 WheelArea、右侧信息栏和底部操作栏使用已经确认的特殊排版。
	# 开场仍保留背景/内容淡入，但不移动这些布局节点，避免首帧错位、
	# 抽取完成后才回到 authored 坐标的视觉跳变。
	PAGE_ENTRANCE.play(self, [], false)

func _load_wheel_data() -> void:
	wheel_sets = Run.load_wheels(WHEEL_DATA_PATH, FALLBACK_WHEEL_DATA_PATH)
	if not wheel_sets.is_empty(): select_wheel(0)
	else: result_label.text = "没有有效转盘数据"
func get_wheel_count() -> int:
	return wheel_sets.size()

func get_current_wheel() -> Dictionary:
	if wheel_sets.is_empty(): return {}
	return wheel_sets[current_wheel_index].duplicate(true)

func get_wheel_items() -> Array[Dictionary]:
	var result: Array[Dictionary] = []
	for item: Dictionary in wheel_items: result.append(item.duplicate(true))
	return result

func select_wheel(index: int) -> void:
	_cancel_sequence()
	if wheel_sets.is_empty(): return
	current_wheel_index = clampi(index, 0, wheel_sets.size() - 1)
	var selected: Dictionary = wheel_sets[current_wheel_index]
	wheel_title = str(selected.get("title", "转盘"))
	wheel_items.clear()
	var raw_items: Variant = selected.get("items", [])
	if raw_items is Array:
		for item: Variant in raw_items:
			if item is Dictionary and not str(item.get("text", "")).is_empty(): wheel_items.append(item as Dictionary)
	wheel_segments.set_items(wheel_items)
	wheel_segments.rotation = 0.0
	result_label.text = str(results.get(wheel_title, "准备抽取"))
	# 恢复结果时也恢复对应落点，避免旧文本与新盘面矛盾。
	if results.has(wheel_title) and Run.validate(wheel_items):
		for item_index: int in wheel_items.size():
			if str(wheel_items[item_index]["text"]) == str(results[wheel_title]) and float(wheel_items[item_index].get("weight", 1.0)) > 0.0:
				var pointer: Control = $WheelArea/Pointer
				var local_pointer: Vector2 = pointer.position + pointer.size * 0.5 - wheel_segments.position - wheel_segments.pivot_offset
				wheel_segments.rotation = Run.landing_rotation(wheel_items, item_index, local_pointer.angle())
				break
	var title_label: Label = get_node_or_null("Header/TitleText") as Label
	if title_label != null: title_label.text = wheel_title
	var panel_title: Label = get_node_or_null("StatusPanel/PanelTitle") as Label
	if panel_title != null: panel_title.text = wheel_title

func next_wheel() -> void:
	select_wheel((current_wheel_index + 1) % maxi(get_wheel_count(), 1))

func previous_wheel() -> void:
	select_wheel((current_wheel_index - 1 + maxi(get_wheel_count(), 1)) % maxi(get_wheel_count(), 1))

func _create_wheel_navigation() -> void:
	var header: Control = get_node_or_null("Header") as Control
	if header == null or get_node_or_null("Header/WheelPrev") != null: return
	var prev := TextureButton.new()
	prev.name = "WheelPrev"
	prev.position = Vector2(230, 112)
	prev.size = Vector2(40, 40)
	prev.texture_normal = NAV_BUTTON_TEXTURE
	prev.ignore_texture_size = true
	prev.stretch_mode = TextureButton.STRETCH_SCALE
	prev.tooltip_text = "上一个转盘"
	var prev_label := Label.new()
	prev_label.name = "Label"
	prev_label.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	prev_label.text = "‹"
	prev_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	prev_label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	prev_label.add_theme_font_size_override("font_size", 24)
	prev.add_child(prev_label)
	prev.pressed.connect(previous_wheel)
	header.add_child(prev)
	var next := TextureButton.new()
	next.name = "WheelNext"
	next.position = Vector2(285, 112)
	next.size = Vector2(40, 40)
	next.texture_normal = NAV_BUTTON_TEXTURE
	next.ignore_texture_size = true
	next.stretch_mode = TextureButton.STRETCH_SCALE
	next.tooltip_text = "下一个转盘"
	var next_label := Label.new()
	next_label.name = "Label"
	next_label.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	next_label.text = "›"
	next_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	next_label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	next_label.add_theme_font_size_override("font_size", 24)
	next.add_child(next_label)
	next.pressed.connect(next_wheel)
	header.add_child(next)

## 用一条绑定页面的 Tween 管理所有阶段；重置/换盘/离开统一杀掉。
func draw_wheel() -> void:
	if _is_spinning or not Run.validate(wheel_items): return
	_start_draw()

func _start_draw() -> void:
	_is_spinning = true
	draw_button.disabled = true
	rank_button.disabled = true
	var selected_index: int = _weighted_index()
	if selected_index < 0:
		_cancel_sequence()
		return
	var audio_manager: Node = get_node_or_null("/root/AudioManager")
	if audio_manager != null and audio_manager.has_method("play_wheel_spin"):
		audio_manager.call("play_wheel_spin")
	last_draw_pre_delay_ms = maxi(pre_delay_ms, 0)
	last_draw_spin_duration_ms = maxi(spin_duration_ms, 0)
	last_draw_post_delay_ms = maxi(post_delay_ms, 0)
	last_draw_jump_delay_ms = maxi(result_jump_delay_ms, 0)
	var generation: int = _generation
	var pointer: Control = $WheelArea/Pointer
	var pointer_local: Vector2 = pointer.position + pointer.size * 0.5 - wheel_segments.position - wheel_segments.pivot_offset
	var landing: float = Run.landing_rotation(wheel_items, selected_index, pointer_local.angle())
	var target_rotation: float = wheel_segments.rotation + TAU * 3.0 + fposmod(landing - wheel_segments.rotation, TAU)
	result_label.text = "抽取中…"
	_spin_tween = create_tween()
	_spin_tween.tween_interval(float(last_draw_pre_delay_ms) / 1000.0)
	if animation_enabled and last_draw_spin_duration_ms > 0:
		_spin_tween.tween_property(wheel_segments, "rotation", target_rotation, float(last_draw_spin_duration_ms) / 1000.0).set_trans(Tween.TRANS_QUINT).set_ease(Tween.EASE_OUT)
	else:
		_spin_tween.tween_callback(func() -> void: wheel_segments.rotation = target_rotation)
	_spin_tween.tween_interval(float(last_draw_post_delay_ms) / 1000.0)
	_spin_tween.tween_callback(_reveal.bind(selected_index, generation))
	_spin_tween.tween_interval(float(last_draw_jump_delay_ms) / 1000.0)
	_spin_tween.tween_callback(_finish_draw.bind(generation))

func _reveal(index: int, generation: int) -> void:
	if generation != _generation: return
	var entry: Dictionary = {"wheel": wheel_title, "text": str(wheel_items[index]["text"]), "time": Time.get_datetime_string_from_system()}
	history.append(entry)
	results[wheel_title] = entry["text"]
	result_label.text = str(entry["text"])
	var audio_manager: Node = get_node_or_null("/root/AudioManager")
	if audio_manager != null and audio_manager.has_method("announce_wheel_result"):
		audio_manager.call("announce_wheel_result", str(entry["text"]))
	_save_history()
	_refresh_status()

func _finish_draw(generation: int) -> void:
	if generation != _generation: return
	_is_spinning = false
	draw_button.disabled = false
	rank_button.disabled = false
	if _batch:
		if current_wheel_index + 1 < wheel_sets.size():
			var next: int = current_wheel_index + 1
			select_wheel(next)
			_batch = true
			_start_draw()
		else:
			_batch = false
			_rank_result = RankEvaluator.evaluate(results)
			_refresh_status()
			_show_rank_decision()
	else:
		# 保留原有自动进入下一盘行为；结果持久化并明确标记为上次抽取。
		var previous_result: String = result_label.text
		var previous_title: String = wheel_title
		next_wheel()
		result_label.text = "上次：" + previous_result
		result_label.tooltip_text = previous_title + "：" + previous_result + "\n当前准备抽取：" + wheel_title

func _cancel_sequence() -> void:
	_generation += 1
	if _spin_tween != null: _spin_tween.kill()
	_spin_tween = null
	_is_spinning = false
	_batch = false
	if is_instance_valid(draw_button): draw_button.disabled = false
	if is_instance_valid(rank_button): rank_button.disabled = false

func reset_wheel() -> void:
	_cancel_sequence()
	results.clear()
	_rank_result.clear()
	# Reset 的语义是开始一轮新抽取，必须回到第一张盘，不能仅清空当前盘。
	select_wheel(0)
	_save_history()
	_refresh_status()

func _exit_tree() -> void:
	_cancel_sequence()

func _on_rank_pressed() -> void:
	if _is_spinning or wheel_sets.is_empty(): return
	# 完整题库使用源 flow-v1 自动推进到 computedGrade；小型自定义题库仍保留
	# 原先的逐盘批量行为，便于玩家自建盘和验收用例。
	if wheel_sets.size() > 50:
		_run_source_flow_to_grade()
		return
	# 开始新的批次时清本轮结果，长期历史保持不变。
	results.clear()
	_save_history()
	_refresh_status()
	select_wheel(0)
	_batch = true
	_start_draw()

func _run_source_flow_to_grade() -> void:
	var session: RefCounted = FlowSession.new() as RefCounted
	var generated: Dictionary = session.call("run_to_grade", _rng.randi()) as Dictionary
	if not bool(generated.get("ok", false)):
		UI.notice(self, "自动抽取到评级", "源流程配置无法推进到评级：%s" % str(generated.get("code", "unknown")))
		return
	results = session.call("display_answers") as Dictionary
	_rank_result = generated.get("grade", {}) as Dictionary
	_rank_result["stats"] = generated.get("stats", {})
	_rank_result["answers"] = generated.get("answers", {})
	_rank_result["skipped"] = generated.get("skipped", [])
	_rank_result["flags"] = generated.get("flags", {})
	_rank_result["effect_ledger"] = generated.get("effect_ledger", [])
	for title: String in results:
		history.append({"wheel":title, "text":str(results[title]), "time":Time.get_datetime_string_from_system(), "flow":"source-flow-v1"})
	result_label.text = "评级：%s" % str(_rank_result.get("grade_label", _rank_result.get("key", "未定")))
	_save_history()
	_refresh_status()
	_show_rank_decision()
func toggle_animation() -> void:
	animation_enabled = not animation_enabled
	animation_button.modulate.a = 1.0 if animation_enabled else 0.45
	_refresh_timing()

func cycle_timing(kind: String) -> void:
	var values: Array[int] = [0, 300, 600, 900]
	match kind:
		"pre": pre_delay_ms = _next_timing_value(pre_delay_ms, values)
		"rotate": spin_duration_ms = _next_timing_value(spin_duration_ms, [300, 600, 900, 1200])
		"post": post_delay_ms = _next_timing_value(post_delay_ms, values)
		"jump": result_jump_delay_ms = _next_timing_value(result_jump_delay_ms, values)

	_refresh_timing()

func _next_timing_value(current: int, values: Array[int]) -> int:
	var index: int = values.find(current)
	return values[(index + 1) % values.size()] if index >= 0 else values[0]

func get_draw_timing_for_acceptance() -> Dictionary:
	return {"pre_delay_ms": pre_delay_ms, "spin_duration_ms": spin_duration_ms, "post_delay_ms": post_delay_ms, "result_jump_delay_ms": result_jump_delay_ms}

func _weighted_index() -> int:
	return Run.pick(wheel_items, _rng.randf())

func _setup_controls() -> void:
	_ignore_decorative_mouse(self)
	($Header as Control).z_index = 20
	var more: TextureButton = $Header/MoreButton as TextureButton
	more.pressed.connect(func() -> void: UI.show_settings(self))
	var back := TextureButton.new()
	back.name = "BackButton"
	back.position = Vector2(30.0, 132.0)
	back.size = Vector2(187.0, 82.0)
	back.texture_normal = BACK_BUTTON_TEXTURE
	back.ignore_texture_size = true
	back.stretch_mode = TextureButton.STRETCH_SCALE
	back.tooltip_text = "返回菜单"
	var back_label := Label.new()
	back_label.name = "Label"
	back_label.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	back_label.text = "返回菜单"
	back_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	back_label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	back_label.add_theme_font_size_override("font_size", 20)
	back.add_child(back_label)
	back.pressed.connect(func() -> void:
		_cancel_sequence()
		get_tree().change_scene_to_file("res://scenes/home/home.tscn"))
	$Header.add_child(back)
	var user: BaseButton = $Header/UserButton
	user.pressed.connect(_open_user_panel)
	($Header/UserButton/UserStatus as Label).text = "账号与卡内角色"
	($StatsPanel/PanelTitle as Label).text = "本地抽取记录"
	($WheelArea/ResultLabel as Label).add_theme_font_size_override("font_size", 28)
	result_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	rank_button.tooltip_text = "自动抽取全部转盘，按六维属性计算等级；完成后可查看完整结果快照。"
	_summary = AcceptDialog.new()
	_summary.name = "Summary"
	_summary.title = "抽取结果与历史"
	_summary.min_size = Vector2i(780, 580)
	var text: TextEdit = TextEdit.new()
	text.name = "SummaryText"
	text.editable = false
	text.custom_minimum_size = Vector2(740, 500)
	_summary.add_child(text)
	_summary.confirmed.connect(_on_summary_confirmed)
	add_child(_summary)
	_rank_decision = ConfirmationDialog.new()
	_rank_decision.name = "RankDecision"
	_rank_decision.title = "评级完成"
	_rank_decision.ok_button_text = "确认保存角色"
	_rank_decision.cancel_button_text = "放弃"
	_rank_decision.confirmed.connect(_save_rank_draft)
	_rank_decision.canceled.connect(_abandon_rank_draft)
	add_child(_rank_decision)

## 所有转盘按钮（含运行时创建的导航/返回按钮）复用统一按压动效，
## 不触碰 tscn 中既有坐标、尺寸与美术资源。
func _bind_button_pulses(node: Node) -> void:
	if node is BaseButton:
		var button: BaseButton = node as BaseButton
		if not button.has_meta("wheel_pulse_bound"):
			button.set_meta("wheel_pulse_bound", true)
			button.pressed.connect(func() -> void: UI.pulse(button))
	for child: Node in node.get_children(): _bind_button_pulses(child)

func _ignore_decorative_mouse(node: Node) -> void:
	# 视觉层级不影响GUI命中顺序，纯装饰容器必须显式穿透鼠标。
	if node is Control and not node is BaseButton:
		(node as Control).mouse_filter = Control.MOUSE_FILTER_IGNORE
	for child: Node in node.get_children():
		_ignore_decorative_mouse(child)

func _show_summary() -> void:
	var lines: PackedStringArray = ["平面题库抽取记录；评级确认后会进入下一剧情盘。", "本轮结果："]
	for title: String in results: lines.append(title + "：" + str(results[title]))
	if not _rank_result.is_empty(): lines.append("\n评级：%s（评分 %s）" % [str(_rank_result.get("grade_label", "未定")), str(_rank_result.get("score", "-"))])
	lines.append("\n历史记录（最近 200 条）：")
	for index: int in range(maxi(0, history.size() - 200), history.size()):
		var entry: Dictionary = history[index]
		lines.append("%s · %s：%s" % [entry.get("time", ""), entry.get("wheel", ""), entry.get("text", "")])
	(_summary.get_node("SummaryText") as TextEdit).text = "\n".join(lines)
	_summary.popup_centered()

func _open_user_panel() -> void:
	_cancel_sequence()
	UI.open_user_panel(self)

func _on_summary_confirmed() -> void:
	if not _advance_after_summary: return
	_advance_after_summary = false
	var session: Node = get_node_or_null("/root/AppSession")
	if session != null and session.has_method("set_context"):
		var snapshot: Dictionary = _confirmed_character_snapshot.duplicate(true) if not _confirmed_character_snapshot.is_empty() else _wheel_rank_character_snapshot()
		# identity/story/battle must all receive the same complete character snapshot;
		# passing only _rank_result would silently drop techniques, tags and hand data.
		session.call("set_context", {"wheel_rank": snapshot, "story_timeline": str((_rank_result.get("answers", {}) as Dictionary).get("startTime", "剧情开始时"))})
	UI.navigate(self, "res://scenes/wheel/identity.tscn")

func _show_rank_decision() -> void:
	if _rank_result.is_empty():
		_show_summary()
		return
	_rank_decision.dialog_text = "评级：%s（%s）\n\n确认后会保存完整原始答案与评级快照为本地角色；依次查看角色详情与抽取记录后进入下一剧情盘。后端同步失败不会影响本地保存。" % [_rank_result.get("grade_label", "未定"), _rank_result.get("score", "-")]
	_rank_decision.popup_centered()

func _save_rank_draft() -> void:
	var pending_snapshot: Dictionary = _wheel_rank_character_snapshot()
	var match_error: String = str(pending_snapshot.get("techniqueMatchError", ""))
	if not match_error.is_empty():
		UI.notice(self, "角色保存失败", "转盘术式未匹配到官方内置术式：%s" % match_error)
		return
	_confirmed_character_snapshot = pending_snapshot.duplicate(true)
	var file: FileAccess = FileAccess.open("user://wheel-rank-draft.json", FileAccess.WRITE)
	if file == null:
		UI.notice(self, "保存草稿", "本地草稿写入失败；本轮结果仍可在汇总中查看。")
	else:
		file.store_string(JSON.stringify({"schema":"wheel-rank-draft-v1", "saved_at":Time.get_datetime_string_from_system(), "rank":_rank_result}))
		var snapshot: Dictionary = pending_snapshot
		var account: Node = get_node_or_null("/root/AccountState")
		var saved_character: Dictionary = account.call("append_local_character_snapshot", snapshot) as Dictionary if account != null and account.has_method("append_local_character_snapshot") else {}
		if not bool(saved_character.get("ok", false)):
			var existing: Array = LoginCardCharacterCache.active_characters()
			existing.append(snapshot)
			if LoginCardCharacterCache.replace_active_card("wheel-local", existing): saved_character = {"ok":true}
		if not bool(saved_character.get("ok", false)):
			UI.notice(self, "保存草稿", "草稿已保存，但本地角色缓存写入失败。")
			return
		_show_saved_character_details(snapshot)

func _wheel_rank_character_snapshot() -> Dictionary:
	var stats: Dictionary = _rank_result.get("stats", {}) as Dictionary
	var id: String = "wheel_rank_%d" % Time.get_unix_time_from_system()
	var technique_bundle: Dictionary = _technique_snapshot_bundle(_rank_result.get("answers", {}) as Dictionary)
	return {"schema":"generated-character-v2", "generationVersion":"v2", "origin":"wheel", "characterId":id, "displayName":"转盘角色 · %s" % str(_rank_result.get("grade_label", "未定")), "baseStats":stats, "stats":stats.duplicate(true), "raw":(_rank_result.get("raw", {}) as Dictionary).duplicate(true), "axes":(_rank_result.get("axes", {}) as Dictionary).duplicate(true), "techniques":technique_bundle.get("techniques", []), "cards":[], "traits":technique_bundle.get("traits", ["wheel_generated"]), "cardTags":technique_bundle.get("cardTags", []), "specialHandTags":technique_bundle.get("specialHandTags", []), "techniqueFamilies":technique_bundle.get("techniqueFamilies", []), "domain":technique_bundle.get("domain", null), "domainRef":technique_bundle.get("domainRef", {"id":"", "name":""}), "techniqueRef":technique_bundle.get("techniqueRef", {"key":"", "name":"", "source":"builtin"}), "techniquePower":technique_bundle.get("techniquePower", "B"), "initialCounters":technique_bundle.get("initialCounters", {}), "initialCounterLabels":technique_bundle.get("initialCounterLabels", {}), "techniqueMatchError":technique_bundle.get("techniqueMatchError", ""), "answers":(_rank_result.get("answers", {}) as Dictionary).duplicate(true), "sourceAnswers":(_rank_result.get("answers", {}) as Dictionary).duplicate(true), "notes":"由角色数据盘确认保存；剧情盘在角色详情与抽取记录后继续", "wheelRank":_rank_result.duplicate(true)}

func _technique_snapshot_bundle(answers: Dictionary) -> Dictionary:
	var selected: String = str(answers.get("familyInnateTechnique", answers.get("innateTechnique", ""))).strip_edges()
	if selected.is_empty() or selected in ["无", "否", "不会"]:
		return {"techniques":[], "traits":["wheel_generated"], "cardTags":[], "specialHandTags":[], "techniqueFamilies":[], "techniqueRef":{"key":"", "name":"", "source":"builtin"}, "domainRef":{"id":"", "name":""}, "techniquePower":"B", "initialCounters":{}, "initialCounterLabels":{}}
	if selected == "自定义": selected = "自定义术式"
	var resolved: Dictionary = WheelTechniqueRegistry.resolve(selected)
	var source: Dictionary = resolved.get("sourceData", {}) as Dictionary
	var display_name: String = str(source.get("displayName", resolved.get("displayName", selected)))
	if not bool(resolved.get("ok", false)):
		resolved = WheelTechniqueRegistry.resolve(display_name)
		source = resolved.get("sourceData", {}) as Dictionary
		display_name = str(source.get("displayName", resolved.get("displayName", selected)))
	var stable_key: String = str(resolved.get("key", ""))
	var technique_error: String = "" if bool(resolved.get("ok", false)) else str(resolved.get("error", "unknown_builtin_technique:%s" % selected))
	var technique_power: String = str(resolved.get("techniquePower", "B"))
	var traits: Array[String] = ["wheel_generated"]
	var card_tags: Array[String] = []
	var hand_tags: Array[String] = []
	for raw: Variant in source.get("tags", []) as Array:
		var tag: String = str(raw).strip_edges()
		if not tag.is_empty() and not traits.has(tag): traits.append(tag)
		if not tag.is_empty() and not card_tags.has(tag): card_tags.append(tag)
	for raw: Variant in source.get("specialHandTags", []) as Array:
		var tag: String = str(raw).strip_edges()
		if not tag.is_empty() and not hand_tags.has(tag): hand_tags.append(tag)
		if not tag.is_empty() and not card_tags.has(tag): card_tags.append(tag)
	# Registry aliases can resolve a technique even when the source strength table
	# uses a different display key. Keep the generated character matchable in the
	# card/deck pipeline instead of silently dropping all tags.
	if card_tags.is_empty() and not stable_key.is_empty():
		card_tags.append(stable_key)
	if hand_tags.is_empty() and not stable_key.is_empty():
		hand_tags.append(stable_key)
	var domain_name: String = str(source.get("domainName", ""))
	var domain_id: String = str(resolved.get("domainId", ""))
	if domain_name.is_empty() and domain_id == "gojo_unlimited_void": domain_name = "无量空处"
	if domain_name.is_empty() and domain_id == "megumi_chimera_shadow_garden": domain_name = "嵌合暗翳庭"
	var domain: Variant = {"id":domain_id, "name":domain_name, "source":"builtin"} if not domain_id.is_empty() or not domain_name.is_empty() else null
	var technique_tags: Array[String] = traits.duplicate()
	if not stable_key.is_empty() and not technique_tags.has(stable_key): technique_tags.append(stable_key)
	var technique_ref: Dictionary = {"key":stable_key, "name":display_name, "source":"builtin"}
	var initial_counters: Dictionary = {}
	var initial_labels: Dictionary = {}
	if stable_key == "blood_manipulation":
		initial_counters = {"blood_manipulation":{"blood":0.0, "pierce":0.0}}
		initial_labels = {"blood_manipulation.blood":"血", "blood_manipulation.pierce":"穿"}
	return {"techniques":[{"id":stable_key, "key":stable_key, "name":display_name, "sourceName":selected, "tags":technique_tags.duplicate()}], "traits":traits, "cardTags":card_tags, "specialHandTags":hand_tags, "techniqueFamilies":[stable_key] if not stable_key.is_empty() else [], "domain":domain, "domainRef":{"id":domain_id, "name":domain_name}, "techniqueRef":technique_ref, "techniquePower":technique_power, "initialCounters":initial_counters, "initialCounterLabels":initial_labels, "techniqueMatchError":technique_error}

func _show_saved_character_details(snapshot: Dictionary) -> void:
	if _saved_character_details == null:
		_saved_character_details = AcceptDialog.new()
		_saved_character_details.name = "SavedCharacterDetails"
		_saved_character_details.title = "角色快照已保存"
		_saved_character_details.ok_button_text = "进入后续剧情盘"
		_saved_character_details.min_size = Vector2i(720, 530)
		var text: TextEdit = TextEdit.new()
		text.name = "SnapshotText"
		text.editable = false
		text.custom_minimum_size = Vector2(680, 440)
		_saved_character_details.add_child(text)
		_saved_character_details.confirmed.connect(_show_post_save_summary)
		add_child(_saved_character_details)
	var techniques: Array = snapshot.get("techniques", []) as Array
	var technique_names: Array[String] = []
	for raw: Variant in techniques:
		if raw is Dictionary: technique_names.append(str((raw as Dictionary).get("name", "未命名术式")))
	(_saved_character_details.get_node("SnapshotText") as TextEdit).text = "评级：%s\n\n六维：\n%s\n\n术式：%s\n特色手牌标签：%s\n\n角色已保存到本地登录卡。确认后进入下一剧情盘。" % [str(_rank_result.get("grade_label", "未定")), JSON.stringify(snapshot.get("stats", {})), "、".join(technique_names) if not technique_names.is_empty() else "无", "、".join(snapshot.get("specialHandTags", []) as Array)]
	_saved_character_details.popup_centered()

func _show_post_save_summary() -> void:
	# AcceptDialog 的 confirmed 信号可能在窗口完成自动关闭前发出；先主动释放
	# 独占子窗口，避免抽取记录被 Godot 拒绝为第二个 exclusive child。
	if _saved_character_details != null and _saved_character_details.visible:
		_saved_character_details.hide()
	_advance_after_summary = true
	_summary.title = "角色已保存 · 抽取记录"
	_show_summary()

func _advance_to_story_wheel() -> void:
	var flow: Dictionary = JSON.parse_string(FileAccess.get_file_as_string("res://data/wheel/source/flow-v1-candidate.json")) as Dictionary
	var answers: Dictionary = _rank_result.get("answers", {}) as Dictionary
	var start_text: String = str(answers.get("startTime", ""))
	var mapping: Dictionary = (flow.get("timeline", {}) as Dictionary).get("startMapping", {}) as Dictionary
	var period: String = "mainStart"
	for source_name: String in mapping:
		if start_text.contains(source_name): period = str(mapping[source_name])
	var entries: Array = ((flow.get("timeline", {}) as Dictionary).get("periods", {}) as Dictionary).get(period, []) as Array
	if entries.is_empty(): return
	var story_wheel_id: int = int((entries[0] as Dictionary).get("wheelId", -1))
	for index: int in wheel_sets.size():
		if int((wheel_sets[index] as Dictionary).get("dbId", -2)) == story_wheel_id:
			select_wheel(index)
			return

func _abandon_rank_draft() -> void:
	# 放弃仅展示已抽结果；关闭记录后不再出现额外提示或跳转。
	_advance_after_summary = false
	_summary.title = "已放弃角色保存 · 抽取记录"
	_show_summary()

func _refresh_timing() -> void:
	($Identity/SettingsRows/Before as Label).text = "     前摇                                      %dms" % pre_delay_ms
	($Identity/SettingsRows/Rotate as Label).text = "     旋转                                      %dms" % spin_duration_ms
	($Identity/SettingsRows/After as Label).text = "     后摇                                      %dms" % post_delay_ms
	($Identity/SettingsRows/Jump as Label).text = "     选择跳转                                  %dms" % result_jump_delay_ms
	($Identity/SettingsRows/Options as Label).text = "     动画 %s       旋转音效/语音播报：已配置" % ("开启" if animation_enabled else "关闭")

func _refresh_status() -> void:
	var mapping: Dictionary = {"Identity": "穿越后的初始身份", "Time": "穿越后的时间点", "Location": "穿越后的地点", "Gender": "性别认同", "Faction": "决战阵营"}
	for node_name: String in mapping:
		var title: String = mapping[node_name]
		var label: Label = get_node("Identity3/StatusRows/" + node_name) as Label
		label.text = "%s：%s" % [title, str(results.get(title, "未抽取"))]
		label.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
		label.tooltip_text = label.text
	($Identity3/StatusRows/Mode as Label).text = "模式：独立随机抽取"
	if _rank_result.is_empty():
		($Identity3/StatusRows/Grade as Label).text = "评级：待全抽取"
		($Identity3/StatusRows/Special as Label).text = "评级：六维结果评分"
	else:
		($Identity3/StatusRows/Grade as Label).text = "评级：%s（%s）" % [_rank_result.get("grade_label", "未定"), _rank_result.get("score", "-")]
		($Identity3/StatusRows/Special as Label).text = "来源：平面题库兼容评级"
	($Identity2/StatRows/Users as Label).text = "%d\n本地抽取" % history.size()
	($Identity2/StatRows/Today as Label).text = "%d\n本轮结果" % results.size()
	($Identity2/StatRows/Rare as Label).text = "未配置\n稀有规则"
	($Identity2/StatRows/Rate as Label).text = "本地保存\n点击头像查看"

func _save_history() -> void:
	var file: FileAccess = FileAccess.open(history_path, FileAccess.WRITE)
	if file == null:
		result_label.tooltip_text = "本地保存失败；本次结果仍保留在内存"
		return
	file.store_string(JSON.stringify({"version": 1, "history": history, "results": results}))

func _load_history() -> void:
	var file: FileAccess = FileAccess.open(history_path, FileAccess.READ)
	if file == null: return
	var json: JSON = JSON.new()
	if json.parse(file.get_as_text()) != OK: return
	var parsed: Variant = json.data
	if not parsed is Dictionary: return
	var raw: Variant = parsed.get("history", [])
	if raw is Array:
		for item: Variant in raw:
			if item is Dictionary and item.get("wheel") is String and item.get("text") is String: history.append(item)
	if parsed.get("results") is Dictionary: results = parsed["results"].duplicate(true)




