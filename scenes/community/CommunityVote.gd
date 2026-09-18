class_name CommunityVote
extends Control

## 只处理既有投票场景的本地呈现和操作意图；父容器负责把意图交给后端接口。
signal faction_balance_changed(pro_ratio: float, con_ratio: float)
signal vote_requested(topic_key: StringName, side: StringName)
signal topic_selected(topic_key: StringName)

const UI: Script = preload("res://ui/ClientUi.gd")
const USER_SCENE_PATH: String = "res://scenes/profile/profile_page.tscn"
var _topics: Dictionary = {
	&"topic_01": {"title":"咒术师是否应公开领域展开数据？", "description":"公开战斗资料能降低新人风险，但也可能暴露术式弱点。", "pro":92, "con":8},
	&"topic_02": {"title":"积分赛是否应限制重复角色？", "description":"讨论公平性与角色熟练度之间的平衡。", "pro":63, "con":37},
	&"topic_03": {"title":"高危任务是否应设置旁观权限？", "description":"实时记录能促进复盘，也需保护参战者资料。", "pro":48, "con":52}
}

@export var bar_width: float = 918.0
@onready var _pro_fill: Control = $FactionOverview/Frame/BarSlot/ProFill
@onready var _con_fill: Control = $FactionOverview/Frame/BarSlot/ConFill
@onready var _pro_percent: Label = $FactionOverview/ProPercent
@onready var _con_percent: Label = $FactionOverview/ConPercent
@onready var _topic_pro_fill: Control = $CurrentTopic/TitleArt/TopicBarSlot/ProFill
@onready var _topic_con_fill: Control = $CurrentTopic/TitleArt/TopicBarSlot/ConFill
@onready var _topic_pro_percent: Label = $CurrentTopic/TitleArt/TopicBarSlot/ProPercent
@onready var _topic_con_percent: Label = $CurrentTopic/TitleArt/TopicBarSlot/ConPercent

var _selected_topic: StringName = &"topic_01"
var _faction_pro: float = 77.0
var _faction_con: float = 23.0

func _ready() -> void:
	_connect_button("Background/Header/UserButton", _open_user_panel)
	_connect_button("TopicList/Topic01", _on_topic_pressed.bind(&"topic_01"))
	_connect_button("TopicList/Topic02", _on_topic_pressed.bind(&"topic_02"))
	_connect_button("TopicList/Topic03", _on_topic_pressed.bind(&"topic_03"))
	_connect_button("CurrentTopic/ProVoteButton", _on_vote_pressed.bind(&"pro"))
	_connect_button("CurrentTopic/ConVoteButton", _on_vote_pressed.bind(&"con"))
	select_topic(_selected_topic, false)
	set_faction_balance(_faction_pro, _faction_con, false)

func _open_user_panel() -> void:
	UI.open_user_panel(self)

func select_topic(topic_key: StringName, announce: bool = true) -> void:
	if not _topics.has(topic_key): return
	_selected_topic = topic_key
	var topic: Dictionary = _topics[topic_key] as Dictionary
	var title: Label = get_node_or_null("CurrentTopic/TitleArt/Title") as Label
	var description: Label = get_node_or_null("CurrentTopic/TitleArt/Description") as Label
	if title != null: title.text = str(topic.get("title", ""))
	if description != null: description.text = str(topic.get("description", ""))
	set_topic_balance(int(topic.get("pro", 0)), int(topic.get("con", 0)), announce)
	for index: int in 3:
		var card: Control = get_node_or_null("TopicList/Topic%02d" % (index + 1)) as Control
		if card != null: card.modulate = Color(1.0, 0.91, 0.74, 1.0) if index == int(str(topic_key).trim_prefix("topic_").to_int()) - 1 else Color.WHITE
	if announce: topic_selected.emit(topic_key)

func set_faction_balance(pro_ratio: float, con_ratio: float, animate: bool = false) -> void:
	var normalized: Vector2 = _normalized_ratios(pro_ratio, con_ratio)
	_faction_pro = normalized.x * 100.0
	_faction_con = normalized.y * 100.0
	_set_fill_pair(_pro_fill, _con_fill, bar_width, normalized, animate)
	_pro_percent.text = "%d%%\n正方" % roundi(normalized.x * 100.0)
	_con_percent.text = "%d%%\n反方" % roundi(normalized.y * 100.0)
	faction_balance_changed.emit(normalized.x, normalized.y)

func set_topic_balance(pro_votes: int, con_votes: int, animate: bool = false) -> void:
	var normalized: Vector2 = _normalized_ratios(float(maxi(pro_votes, 0)), float(maxi(con_votes, 0)))
	var width: float = _topic_pro_fill.get_parent_control().size.x
	_set_fill_pair(_topic_pro_fill, _topic_con_fill, width, normalized, animate)
	_topic_pro_percent.text = "正方 %d%%" % roundi(normalized.x * 100.0)
	_topic_con_percent.text = "反方 %d%%" % roundi(normalized.y * 100.0)

func _on_topic_pressed(topic_key: StringName) -> void:
	var target: Control = get_node_or_null("TopicList/Topic%02d" % int(str(topic_key).trim_prefix("topic_").to_int())) as Control
	if target != null: UI.pulse(target)
	select_topic(topic_key)

func _on_vote_pressed(side: StringName) -> void:
	var topic: Dictionary = _topics[_selected_topic] as Dictionary
	var key: String = "pro" if side == &"pro" else "con"
	topic[key] = int(topic.get(key, 0)) + 1
	_topics[_selected_topic] = topic
	_faction_pro += 1.0 if side == &"pro" else 0.0
	_faction_con += 1.0 if side == &"con" else 0.0
	set_topic_balance(int(topic.get("pro", 0)), int(topic.get("con", 0)), true)
	set_faction_balance(_faction_pro, _faction_con, true)
	var button: Control = get_node_or_null("CurrentTopic/ProVoteButton" if side == &"pro" else "CurrentTopic/ConVoteButton") as Control
	if button != null: UI.pulse(button)
	vote_requested.emit(_selected_topic, side)

func _set_fill_pair(pro_fill: Control, con_fill: Control, width: float, normalized: Vector2, animate: bool) -> void:
	var pro_width: float = width * normalized.x
	var con_width: float = width * normalized.y
	if not animate or UI.reduced_motion():
		pro_fill.size.x = pro_width
		con_fill.size.x = con_width
		con_fill.position.x = width - con_width
		return
	var previous: Tween = get_meta("balance_tween") as Tween if has_meta("balance_tween") else null
	if previous != null and previous.is_valid(): previous.kill()
	var tween: Tween = create_tween().set_parallel(true)
	set_meta("balance_tween", tween)
	tween.set_trans(Tween.TRANS_QUART).set_ease(Tween.EASE_OUT)
	tween.tween_property(pro_fill, "size:x", pro_width, 0.28)
	tween.tween_property(con_fill, "size:x", con_width, 0.28)
	tween.tween_property(con_fill, "position:x", width - con_width, 0.28)

func _connect_button(node_path: NodePath, callback: Callable) -> void:
	var button: BaseButton = get_node_or_null(node_path) as BaseButton
	if button != null and not button.pressed.is_connected(callback): button.pressed.connect(callback)

func _normalized_ratios(pro_ratio: float, con_ratio: float) -> Vector2:
	var total: float = maxf(pro_ratio + con_ratio, 0.0001)
	var pro: float = clampf(pro_ratio / total, 0.0, 1.0)
	return Vector2(pro, 1.0 - pro)



