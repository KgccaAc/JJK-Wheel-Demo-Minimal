extends SceneTree

const PAGES: Array[String] = [
	"res://scenes/auth/auth_login.tscn",
	"res://scenes/home/home.tscn",
	"res://scenes/wheel/wheel.tscn",
	"res://scenes/wheel/identity.tscn",
	"res://scenes/wheel/Select.tscn",
	"res://scenes/story/StroyHome.tscn",
	"res://scenes/story/RPG.tscn",
	"res://scenes/story/selection.tscn",
	"res://scenes/story/settlement.tscn",
	"res://scenes/story/Map.tscn",
	"res://scenes/roster/roster_picker.tscn",
	"res://scenes/community/community_vote.tscn",
	"res://scenes/community/community_discussion.tscn",
	"res://scenes/battle/character_selection.tscn",
	"res://scenes/battle/battle_scene.tscn",
	"res://scenes/online/online_room.tscn",
	"res://scenes/profile/profile_page.tscn",
]

var _rows: Array[Dictionary] = []

func _initialize() -> void:
	call_deferred("_run")

func _run() -> void:
	_prepare_story_state()
	for path: String in PAGES:
		var packed: PackedScene = load(path) as PackedScene
		if packed == null:
			_rows.append({"page": path, "error": "load_failed"})
			continue
		var page: Node = packed.instantiate()
		root.add_child(page)
		await process_frame
		await process_frame
		_collect_page(path, page)
		page.queue_free()
		await process_frame
	var failures := _write_report()
	quit(1 if failures > 0 else 0)

func _prepare_story_state() -> void:
	var story: Node = root.get_node_or_null("StoryState")
	if story == null:
		return
	if story.has_method("reset_story"):
		story.call("reset_story")
	if story.has_method("begin_from_identity"):
		story.call("begin_from_identity", {
			"name": "按钮审计角色", "rank": "一级", "technique": "无下限术式",
			"stats": {"hp": 100, "ce": 100, "exp": 0, "stability": 100, "money": 100},
		})

func _collect_page(path: String, page: Node) -> void:
	var buttons: Array[Node] = page.find_children("*", "BaseButton", true, false)
	if page is BaseButton:
		buttons.push_front(page)
	for raw: Node in buttons:
		var button := raw as BaseButton
		var connected := (
			button.pressed.get_connections().size() > 0
			or button.button_down.get_connections().size() > 0
			or button.button_up.get_connections().size() > 0
			or button.toggled.get_connections().size() > 0
			or button.gui_input.get_connections().size() > 0
		)
		_rows.append({
			"page": path,
			"button": str(page.get_path_to(button)),
			"type": button.get_class(),
			"text": button.text if button is Button else "",
			"visible": button.is_visible_in_tree(),
			"disabled": button.disabled,
			"connected": connected,
			"focus_mode": button.focus_mode,
			"tooltip": button.tooltip_text,
			"has_visible_label": _has_visible_label(button),
			"feedback_bound": button.has_meta("feedback_bound"),
			"texture_normal": (button as TextureButton).texture_normal != null if button is TextureButton else false,
			"texture_hover": (button as TextureButton).texture_hover != null if button is TextureButton else false,
			"texture_pressed": (button as TextureButton).texture_pressed != null if button is TextureButton else false,
		})

func _has_visible_label(button: BaseButton) -> bool:
	if button is Button and not (button as Button).text.strip_edges().is_empty():
		return true
	for child: Node in button.find_children("*", "Label", true, false):
		var label := child as Label
		if label.visible and not label.text.strip_edges().is_empty():
			return true
	return not button.tooltip_text.strip_edges().is_empty()

func _write_report() -> int:
	var unbound: Array[Dictionary] = []
	var load_errors: Array[Dictionary] = []
	for row: Dictionary in _rows:
		if row.has("error"):
			load_errors.append(row)
		if row.has("button") and bool(row.get("visible", false)) and not bool(row.get("disabled", false)) and not bool(row.get("connected", false)):
			unbound.append(row)
	var page_summaries: Array[Dictionary] = []
	for page: String in PAGES:
		var page_rows: Array[Dictionary] = []
		for row: Dictionary in _rows:
			if str(row.get("page", "")) == page and row.has("button"):
				page_rows.append(row)
		var page_unbound := 0
		for row: Dictionary in page_rows:
			if bool(row.get("visible", false)) and not bool(row.get("disabled", false)) and not bool(row.get("connected", false)):
				page_unbound += 1
		page_summaries.append({"page": page, "buttons": page_rows.size(), "unbound": page_unbound})
	var report := {
		"schema": "page-button-wiring-audit-v1",
		"generated_at": Time.get_datetime_string_from_system(true),
		"pages": page_summaries,
		"load_errors": load_errors,
		"unbound": unbound,
		"rows": _rows,
	}
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path("res://reports/ui-audit"))
	var file := FileAccess.open("res://reports/ui-audit/page-button-wiring-latest.json", FileAccess.WRITE)
	file.store_string(JSON.stringify(report, "  "))
	file.close()
	print("PAGE_BUTTON_WIRING_AUDIT %s pages=%d buttons=%d load_errors=%d unbound=%d" % ["PASS" if load_errors.is_empty() and unbound.is_empty() else "FAIL", PAGES.size(), _rows.size(), load_errors.size(), unbound.size()])
	for row: Dictionary in load_errors:
		print("LOAD_ERROR page=%s error=%s" % [row.page, row.error])
	for row: Dictionary in unbound:
		print("UNBOUND page=%s button=%s text=%s" % [row.page, row.button, row.text])
	return load_errors.size() + unbound.size()
