## 社区容器：不改两个子场景排版，只在运行时连接既有控件和动画。
class_name Community
extends Control

const UI: Script = preload("res://ui/ClientUi.gd")
const PAGE_ENTRANCE: Script = preload("res://ui/PageEntrance.gd")

signal community_action_requested(action: StringName, payload: Dictionary)

@onready var _vote_page: Control = $VotePage
@onready var _discussion_page: Control = $DiscussionPage
@onready var _vote_tab: BaseButton = $VoteTab
@onready var _discussion_tab: BaseButton = $DiscussionTab

var _selected_discussion: StringName = &"discussion_01"
var _category_all: bool = true
var _sort_hot: bool = true
var _liked: bool = false

func _ready() -> void:
	UI.ignore_decorations(self)
	if not _vote_tab.pressed.is_connected(_on_vote_tab_pressed): _vote_tab.pressed.connect(_on_vote_tab_pressed)
	if not _discussion_tab.pressed.is_connected(_on_discussion_tab_pressed): _discussion_tab.pressed.connect(_on_discussion_tab_pressed)
	var vote: CommunityVote = _vote_page as CommunityVote
	if vote != null:
		vote.vote_requested.connect(_on_vote_requested)
		vote.topic_selected.connect(func(topic_key: StringName) -> void: community_action_requested.emit(&"select_topic", {"topic_key":String(topic_key)}))
	_bind_discussion_controls()
	show_vote_page(false)
	PAGE_ENTRANCE.play(self)

func show_vote_page(animate: bool = true) -> void:
	_switch_page(_discussion_page, _vote_page, animate)
	_vote_tab.disabled = true
	_discussion_tab.disabled = false

func show_discussion_page(animate: bool = true) -> void:
	_switch_page(_vote_page, _discussion_page, animate)
	_discussion_tab.disabled = true
	_vote_tab.disabled = false

func _switch_page(previous: Control, next: Control, animate: bool) -> void:
	if previous == next: return
	if not animate or UI.reduced_motion():
		previous.hide()
		next.show()
		return
	if previous.visible:
		previous.hide()
		next.modulate.a = 0.0
		next.show()
		var fade_in: Tween = create_tween()
		fade_in.set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
		fade_in.tween_property(next, "modulate:a", 1.0, 0.18)
	else:
		next.show()

func _bind_discussion_controls() -> void:
	_connect_button("DiscussionPage/DiscussionList/Discussion01", _on_discussion_pressed.bind(&"discussion_01"))
	_connect_button("DiscussionPage/DiscussionList/Discussion02", _on_discussion_pressed.bind(&"discussion_02"))
	_connect_button("DiscussionPage/DiscussionList/Filters/Category", _on_category_pressed)
	_connect_button("DiscussionPage/DiscussionList/Filters/Sort", _on_sort_pressed)
	_connect_button("DiscussionPage/TopicDetail/LikeButton", _on_like_pressed)
	_connect_button("DiscussionPage/ReplyList/Reply01/MoreButton", _on_reply_more_pressed)

func _on_discussion_pressed(discussion_key: StringName) -> void:
	_selected_discussion = discussion_key
	var title: Label = get_node_or_null("DiscussionPage/TopicDetail/Title") as Label
	var body: Label = get_node_or_null("DiscussionPage/TopicDetail/Body") as Label
	if discussion_key == &"discussion_01":
		if title != null: title.text = "领域展开的情报公开边界"
		if body != null: body.text = "把公开资料用于教学与复盘，同时保留参战者对敏感细节的决定权。"
	else:
		if title != null: title.text = "关于积分赛角色池的讨论"
		if body != null: body.text = "熟练度、阵容多样性与赛事公平需要共同被纳入规则。"
	var card: Control = get_node_or_null("DiscussionPage/DiscussionList/Discussion01" if discussion_key == &"discussion_01" else "DiscussionPage/DiscussionList/Discussion02") as Control
	if card != null: UI.pulse(card)
	community_action_requested.emit(&"select_discussion", {"discussion_key":String(discussion_key)})

func _on_category_pressed() -> void:
	_category_all = not _category_all
	var label: Label = get_node_or_null("DiscussionPage/DiscussionList/Filters/Category/Text") as Label
	if label != null: label.text = "全部讨论" if _category_all else "仅看议题"
	community_action_requested.emit(&"filter_discussion", {"category":"all" if _category_all else "topic"})

func _on_sort_pressed() -> void:
	_sort_hot = not _sort_hot
	var label: Label = get_node_or_null("DiscussionPage/DiscussionList/Filters/Sort/Text") as Label
	if label != null: label.text = "热度排序" if _sort_hot else "最新发布"
	community_action_requested.emit(&"sort_discussion", {"sort":"hot" if _sort_hot else "new"})

func _on_like_pressed() -> void:
	_liked = not _liked
	var button: Control = get_node_or_null("DiscussionPage/TopicDetail/LikeButton") as Control
	if button != null:
		button.modulate = Color(1.0, 0.76, 0.64, 1.0) if _liked else Color.WHITE
		button.tooltip_text = "已点赞" if _liked else "点赞"
		UI.pulse(button)
	community_action_requested.emit(&"like_discussion", {"discussion_key":String(_selected_discussion), "liked":_liked})

func _on_reply_more_pressed() -> void:
	UI.notice(self, "回复操作", "举报、屏蔽与复制链接将在社区服务接入后提供。")
	community_action_requested.emit(&"reply_more", {"discussion_key":String(_selected_discussion), "reply_index":0})

func _on_vote_requested(topic_key: StringName, side: StringName) -> void:
	community_action_requested.emit(&"vote", {"topic_key":String(topic_key), "side":String(side)})

func _on_vote_tab_pressed() -> void:
	UI.pulse(_vote_tab)
	show_vote_page()

func _on_discussion_tab_pressed() -> void:
	UI.pulse(_discussion_tab)
	show_discussion_page()

func _connect_button(node_path: NodePath, callback: Callable) -> void:
	var button: BaseButton = get_node_or_null(node_path) as BaseButton
	if button != null and not button.pressed.is_connected(callback): button.pressed.connect(callback)



