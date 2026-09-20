extends RefCounted

## FightPresenter 的验收表面（acceptance surface）。
##
## 原先 22 个 `*_for_acceptance` 钩子直接堆在 FightPresenter.gd 里，把 1454 行的
## 页面类进一步撑大，其中 19 个已无任何调用方。这里只保留仍有测试依赖的入口。
##
## 访问方式：全部通过 `presenter.call(...)` / `presenter.get(...)` 反射调用，
## 因此本文件与 FightPresenter 之间**没有编译期依赖**，方向仍是
## `scenes/battle` → `battle/ui`，不会形成回环。
##
## 读取私有状态一律走 Presenter 暴露的 `acceptance_*` 只读访问器
## （枚举无法通过反射读取，必须由 Presenter 自己转换）。

const FLOW_SESSION_SCRIPT: Script = preload("res://battle/core/BattleFlowSession.gd")


## 回合摘要截图验收的完整前置：开局策略 → 发牌 → 弃牌 → 先手 → 进入出牌。
static func prepare_play_hand(presenter: Control) -> void:
	if _session_phase(presenter) == &"OPENING_STRATEGY":
		_flow(presenter).confirm_strategy(&"default")
		presenter.call("_sync_flow")
	if _hand_phase_name(presenter) == "OPENING":
		presenter.call("_finish_open")
	if _session_phase(presenter) == &"DISCARD":
		discard_two(presenter)
	if _session_phase(presenter) == &"INITIATIVE":
		_flow(presenter).confirm_initiative("Option01")
	presenter.call("_sync_flow")
	if _hand_phase_name(presenter) == "OPENING":
		presenter.call("_finish_open")


## 通过编排器提交两张弃牌，再推进先手；测试不绕过页面正式命令链。
static func discard_two(presenter: Control) -> void:
	if _session_phase(presenter) == &"OPENING_STRATEGY":
		_flow(presenter).confirm_strategy(&"default")
	var session: RefCounted = presenter.call("acceptance_session")
	var snapshot: Dictionary = session.get_state_snapshot()
	var actors: Array = snapshot.get("actors", []) as Array
	var local_side: int = int(presenter.get("_online_local_side")) if bool(presenter.get("_online_input_battle")) else 0
	var local_actor: Dictionary = actors[local_side] as Dictionary if local_side >= 0 and actors.size() > local_side else {}
	var remaining: Array = (local_actor.get("zones", {}) as Dictionary).get("hand", []) as Array
	var ids: Array[String] = []
	for index: int in mini(2, remaining.size()):
		ids.append(str((remaining[index] as Dictionary).get("instance_id", "")))
	if session.get_phase() == &"DISCARD" and ids.size() == int(FLOW_SESSION_SCRIPT.DISCARD_COUNT):
		_flow(presenter).submit_discard(ids)
	if session.get_phase() == &"INITIATIVE":
		_flow(presenter).confirm_initiative("Option01")
	presenter.call("_sync_flow")
	if session.get_phase() == &"PLAY":
		presenter.call("_set_action_controls_enabled", true)


## 打开手牌并选中第一张可用的牌。
static func select_first_card(presenter: Control) -> void:
	var session: RefCounted = presenter.call("acceptance_session")
	if session.get_phase() == &"OPENING_STRATEGY": _flow(presenter).confirm_strategy(&"default")
	if session.get_phase() == &"DEAL": _flow(presenter).continue_round()
	if session.get_phase() == &"INITIATIVE": _flow(presenter).confirm_initiative("Option01")
	presenter.set("_current_mode", &"normal")
	presenter.call("_sync_flow")
	if _hand_phase_name(presenter) == "OPEN":
		presenter.call("_refresh_open_hand")
	if _hand_phase_name(presenter) == "OPENING":
		presenter.call("_finish_open")
	var hand_cards: Array = presenter.get("_hand_cards") as Array
	if not hand_cards.is_empty() and _hand_phase_name(presenter) != "OPEN":
		presenter.call("_set_hand_phase_open_for_acceptance")
	for card: TextureButton in hand_cards:
		if not card.disabled:
			if bool(presenter.get("_discard_phase")):
				(presenter.call("acceptance_selected_cards") as Array).append(card)
				return
			presenter.call("_on_card_selected", card)
			return


## 结算当前已选牌，触发回合摘要。
static func resolve_selected(presenter: Control) -> void:
	presenter.call("_resolve_history")


static func opponent_response_count(presenter: Control) -> int:
	return (presenter.get("_opponent_response_cards") as Array).size()


static func _session(presenter: Control) -> RefCounted:
	return presenter.call("acceptance_session")


static func _flow(presenter: Control) -> RefCounted:
	return presenter.call("acceptance_flow")


static func _session_phase(presenter: Control) -> StringName:
	return presenter.call("acceptance_session").get_phase()


static func _hand_phase_name(presenter: Control) -> String:
	return str(presenter.call("acceptance_phase_name", presenter.call("acceptance_hand_phase")))
