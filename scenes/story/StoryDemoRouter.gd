extends Control
class_name StoryDemoRouter

const Catalog = preload("res://story/core/StoryNodeCatalog.gd")
const Run = preload("res://story/core/StoryRun.gd")

var catalog: StoryNodeCatalog
var run: StoryRun
var title_label: Label
var body_label: Label
var status_label: Label
var actions: VBoxContainer
var difficulty_select: OptionButton
var ai_check: CheckButton

func _ready() -> void:
    _build_ui()
    _show_setup()

func _build_ui() -> void:
    var bg := ColorRect.new(); bg.color = Color("10131d"); bg.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT); add_child(bg)
    var margin := MarginContainer.new(); margin.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT); margin.add_theme_constant_override("margin_left", 48); margin.add_theme_constant_override("margin_right", 48); margin.add_theme_constant_override("margin_top", 36); margin.add_theme_constant_override("margin_bottom", 36); add_child(margin)
    var column := VBoxContainer.new(); column.add_theme_constant_override("separation", 18); margin.add_child(column)
    title_label = Label.new(); title_label.add_theme_font_size_override("font_size", 34); column.add_child(title_label)
    status_label = Label.new(); status_label.modulate = Color("c7a86b"); column.add_child(status_label)
    var panel := PanelContainer.new(); panel.size_flags_vertical = Control.SIZE_EXPAND_FILL; column.add_child(panel)
    var inner := VBoxContainer.new(); inner.add_theme_constant_override("separation", 14); panel.add_child(inner)
    body_label = Label.new(); body_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART; body_label.custom_minimum_size = Vector2(0, 130); inner.add_child(body_label)
    actions = VBoxContainer.new(); actions.add_theme_constant_override("separation", 10); inner.add_child(actions)

func _clear_actions() -> void:
    for child in actions.get_children(): child.queue_free()

func _show_setup() -> void:
    title_label.text = "故事模式 · 预设剧情 Demo"
    status_label.text = "第一阶段：纯预设剧情树｜AI 接口已预留"
    body_label.text = "从当前角色判定结果开始，体验一个包含有限选择、转盘、真实战斗桥接和成长结算的章节。"
    _clear_actions()
    difficulty_select = OptionButton.new(); difficulty_select.add_item("故事模式", 0); difficulty_select.add_item("标准模式", 1); difficulty_select.add_item("铁人模式", 2); actions.add_child(difficulty_select)
    ai_check = CheckButton.new(); ai_check.text = "启用 AI 模式（当前服务未配置，仅展示预留状态）"; actions.add_child(ai_check)
    var start := Button.new(); start.text = "开始第一幕"; start.pressed.connect(_start_run); actions.add_child(start)
    var back := Button.new(); back.text = "返回首页"; back.pressed.connect(func(): get_tree().change_scene_to_file("res://scenes/home/home.tscn")); actions.add_child(back)

func _start_run() -> void:
    catalog = Catalog.new(); if not catalog.load_from_file("res://data/story/nodes.json"): body_label.text = "剧情数据加载失败"; return
    run = Run.new(); run.difficulty = ["story","standard","ironman"][difficulty_select.selected]; run.ai_enabled = ai_check.button_pressed
    run.start(catalog, {"display_name":"转盘角色","stats":{"power":10,"control":10,"body":10,"efficiency":10}})
    _render_node()

func _render_node() -> void:
    if run == null: return
    var node := run.current_node(); if node == null: return
    title_label.text = node.title
    status_label.text = "章节：第一幕  ·  难度：%s  ·  AI：%s" % [run.difficulty, "开启但未配置" if run.ai_enabled else "关闭"]
    body_label.text = node.summary
    _clear_actions()
    match node.node_type:
        "choice":
            for choice in node.choices:
                var b := Button.new(); b.text = str(choice.get("label", choice.get("id", "选择"))); b.pressed.connect(_choose.bind(str(choice.get("id", "")))); actions.add_child(b)
        "wheel":
            var wheel := Button.new(); wheel.text = "转盘结果：发现低级咒灵"; wheel.pressed.connect(func(): run.submit_wheel_result("发现低级咒灵"); _render_node()); actions.add_child(wheel)
        "battle":
            var battle := Button.new(); battle.text = "进入真实战斗（Demo 回传胜利）"; battle.pressed.connect(func(): run.submit_battle_result("victory", {"demo":true}); _render_node()); actions.add_child(battle)
            var lose := Button.new(); lose.text = "模拟战斗失败"; lose.pressed.connect(func(): run.submit_battle_result("defeat", {"demo":true}); _render_node()); actions.add_child(lose)
        "ending": _show_result()

func _choose(choice_id: String) -> void:
    run.submit_choice(choice_id); _render_node()

func _show_result() -> void:
    title_label.text = "第一幕完成 · 双结算"
    status_label.text = "事件日志 %d 条 · 状态：%s" % [run.event_log.size(), run.status]
    var lines := ["角色数值面板", "经验：%d" % int(run.growth.xp)]
    for key in run.growth.stats: lines.append("成长 · %s：%+d" % [key, int(run.growth.stats[key])])
    lines.append("\n经历事件与结果")
    for entry in run.event_log: lines.append("%d · %s" % [int(entry.index) + 1, str(entry.kind)])
    body_label.text = "\n".join(lines)
    _clear_actions()
    var restart := Button.new(); restart.text = "重新开始"; restart.pressed.connect(_show_setup); actions.add_child(restart)
    var home := Button.new(); home.text = "返回首页"; home.pressed.connect(func(): get_tree().change_scene_to_file("res://scenes/home/home.tscn")); actions.add_child(home)
