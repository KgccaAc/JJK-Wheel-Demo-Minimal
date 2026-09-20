extends SceneTree

# CoreActionResolver 直接单元测试。
#
# 背景：CoreActionResolver.gd 共 820 行，此前只被 BattleFlowSession / CardAvailabilityService
# 间接驱动，没有直接测试锚点。一旦其内部实现漂移，只能靠端到端回合测试暴露问题，
# 定位成本高。本测试直接锁定它的两个公开入口：
#
#   1. first_unsupported_atomic_tool(card) —— 纯静态，DSL 支持面判定
#   2. preview_action_values(card, actor, target, state) —— 纯预演，不得改写入参
#
# 断言重点包含「预演不得污染入参」这一关键不变量：preview_action_values 是
# CardAvailabilityService 判断可用性的基础，若它修改了 actor/target/state，
# UI 的可用性预览就会产生真实副作用。

const RESOLVER_SCRIPT: Script = preload("res://battle/core/CoreActionResolver.gd")
const INTERPRETER_SCRIPT: Script = preload("res://battle/rules/AtomicEffectInterpreter.gd")
const STATE_SCRIPT: Script = preload("res://battle/rules/BattleState.gd")

var _failures: Array[String] = []
var _checks: int = 0

func _initialize() -> void:
	_test_first_unsupported_atomic_tool()
	_test_preview_purity()
	_test_preview_values_shape()
	_test_preview_rejects_unsupported()
	_test_resolve_selected_guards()

	var passed := _failures.is_empty()
	print("CORE_ACTION_RESOLVER_UNIT %s checks=%d failures=%s" % [
		"PASS" if passed else "FAIL", _checks, ";".join(_failures)])
	quit(0 if passed else 1)

# ---------- helpers ----------

func _check(condition: bool, label: String) -> void:
	_checks += 1
	if not condition:
		_failures.append(label)

func _make_state() -> BattleState:
	var state: BattleState = STATE_SCRIPT.new()
	state.initialize("battle-rules-v3", 20260920, _profile("hero", 120.0, 100.0), _profile("foe", 200.0, 80.0))
	return state

func _profile(id: String, hp: float, ce: float) -> Dictionary:
	return {"id": id, "displayName": id, "hp": hp, "max_hp": hp, "ce": ce, "max_ce": ce,
		"stats": {"cursedEnergy": "B", "control": "C", "efficiency": "C",
			"body": "C", "martial": "C", "talent": "C"},
		"techniqueFamilies": [], "cardTags": [], "initial_counters": {}}

func _card(action_id: String, tool: String, params: Dictionary = {}) -> Dictionary:
	return {
		"id": action_id, "action_id": action_id, "instance_id": "inst:%s" % action_id,
		"type": "basic", "category": "basic", "zone": "hand",
		"cost": {"ce": 0.0},
		"effect": {"special": {"atomicEffects": [
			{"tool": tool, "trigger": "pre-action", "params": params}
		]}}
	}

# 直伤类卡：damage 直接挂在 effect 上（见 _initial_values），
# 与「效果工具」不同层；另附一条 pre-action 修饰工具以覆盖 DSL 路径。
func _damage_card(action_id: String, amount: float) -> Dictionary:
	return {
		"id": action_id, "action_id": action_id, "instance_id": "inst:%s" % action_id,
		"type": "basic", "category": "basic", "zone": "hand",
		"cost": {"ce": 0.0},
		"effect": {
			"damage": amount,
			"special": {"atomicEffects": [
				{"tool": "adjust_resource", "trigger": "pre-action",
					"params": {"resource": "damage", "amount": 0.0}}
			]}
		}
	}

# ---------- 1. first_unsupported_atomic_tool ----------

func _test_first_unsupported_atomic_tool() -> void:
	# 空卡：无 effect → 无不支持项
	_check(RESOLVER_SCRIPT.first_unsupported_atomic_tool({}) == "", "fuat_empty_card")

	# 支持的 tool → 返回空串。
	# 注意：damage/heal 等「直伤工具」属于 AtomicEffectInterpreter 的 SUPPORTED_TOOLS，
	# 不在 CoreActionResolver.SUPPORTED_TOOLS 内 —— 两张表按职责互不重叠。
	_check(RESOLVER_SCRIPT.first_unsupported_atomic_tool(_card("a", "adjust_resource")) == "",
		"fuat_supported_adjust_resource")

	# 不支持的 tool → 返回该 tool 名
	_check(RESOLVER_SCRIPT.first_unsupported_atomic_tool(_card("b", "not_a_real_tool")) == "not_a_real_tool",
		"fuat_unsupported_returns_name")

	# SUPPORTED_TOOLS 里的每一项都必须被 first_unsupported_atomic_tool 认作支持
	# （防止声明表与判定逻辑漂移）
	for tool: String in RESOLVER_SCRIPT.SUPPORTED_TOOLS:
		var unsupported: String = RESOLVER_SCRIPT.first_unsupported_atomic_tool(_card("t", tool))
		_check(unsupported == "", "fuat_declared_supported:%s" % tool)

	# 多个效果时返回第一个不支持的
	var multi: Dictionary = _card("c", "adjust_resource")
	multi["effect"]["special"]["atomicEffects"] = [
		{"tool": "adjust_resource", "params": {}},
		{"tool": "bogus_tool", "params": {}},
		{"tool": "add_status", "params": {}},
	]
	_check(RESOLVER_SCRIPT.first_unsupported_atomic_tool(multi) == "bogus_tool", "fuat_first_unsupported_of_many")

	# 两张 SUPPORTED_TOOLS 表是「嵌套」关系而非「互斥」：
	# AtomicEffectInterpreter(51) ⊇ CoreActionResolver(28)。
	# resolver 只处理「修饰/前置」类工具，直伤类（damage/heal/block…）
	# 由 interpreter 独占。此处锁定该包含关系，防止任一侧表被误删。
	for tool: String in RESOLVER_SCRIPT.SUPPORTED_TOOLS:
		_check(INTERPRETER_SCRIPT.SUPPORTED_TOOLS.has(tool),
			"fuat_resolver_tools_subset_of_interpreter:%s" % tool)
	_check(INTERPRETER_SCRIPT.SUPPORTED_TOOLS.size() > RESOLVER_SCRIPT.SUPPORTED_TOOLS.size(),
		"fuat_interpreter_table_is_strict_superset")

# ---------- 2. preview_action_values 不得污染入参 ----------

func _test_preview_purity() -> void:
	var state: BattleState = _make_state()
	var actor: Dictionary = (state.actors[0] as Dictionary).duplicate(true)
	var target: Dictionary = (state.actors[1] as Dictionary).duplicate(true)
	var before_actor: String = JSON.stringify(actor)
	var before_target: String = JSON.stringify(target)
	var before_revision: int = state.revision

	var card: Dictionary = _damage_card("purity", 12.0)
	var result: Dictionary = RESOLVER_SCRIPT.new().preview_action_values(card, actor, target, state)

	_check(bool(result.get("ok", false)), "preview_ok")
	_check(JSON.stringify(actor) == before_actor, "preview_does_not_mutate_actor")
	_check(JSON.stringify(target) == before_target, "preview_does_not_mutate_target")
	_check(state.revision == before_revision, "preview_does_not_bump_revision")

# ---------- 3. preview_action_values 输出结构 ----------

func _test_preview_values_shape() -> void:
	var state: BattleState = _make_state()
	var actor: Dictionary = (state.actors[0] as Dictionary).duplicate(true)
	var target: Dictionary = (state.actors[1] as Dictionary).duplicate(true)

	var card: Dictionary = _damage_card("shape", 25.0)
	var result: Dictionary = RESOLVER_SCRIPT.new().preview_action_values(card, actor, target, state)

	_check(bool(result.get("ok", false)), "shape_ok")
	_check(result.has("values"), "shape_has_values")
	_check(result.has("trace"), "shape_has_trace")
	_check(result.get("values") is Dictionary, "shape_values_is_dict")
	_check(result.get("trace") is Array, "shape_trace_is_array")

	# trace 必须可序列化（联机与诊断日志依赖）
	var values: Dictionary = result.get("values", {}) as Dictionary
	_check(values.has("damage"), "shape_values_has_damage_key")

# ---------- 4. 不支持的 DSL 必须被拒绝而非静默通过 ----------

func _test_preview_rejects_unsupported() -> void:
	var state: BattleState = _make_state()
	var actor: Dictionary = (state.actors[0] as Dictionary).duplicate(true)
	var target: Dictionary = (state.actors[1] as Dictionary).duplicate(true)
	var card: Dictionary = _card("bad", "definitely_not_supported")

	var result: Dictionary = RESOLVER_SCRIPT.new().preview_action_values(card, actor, target, state)
	_check(not bool(result.get("ok", true)), "unsupported_tool_rejected")
	_check(str(result.get("error", "")) != "", "unsupported_tool_has_error")

# ---------- 5. resolve_selected 的边界守卫 ----------

func _test_resolve_selected_guards() -> void:
	var resolver: RefCounted = RESOLVER_SCRIPT.new()

	var null_result: Dictionary = resolver.resolve_selected(null, 0)
	_check(not bool(null_result.get("ok", true)), "resolve_null_state_rejected")
	_check(str(null_result.get("error", "")) == "missing_state", "resolve_null_state_error")

	var state: BattleState = _make_state()
	var bad_actor: Dictionary = resolver.resolve_selected(state, 5)
	_check(not bool(bad_actor.get("ok", true)), "resolve_invalid_actor_rejected")
	_check(str(bad_actor.get("error", "")) == "invalid_actor", "resolve_invalid_actor_error")

	# selected 为空 → no_committed_cards
	var empty_selection: Dictionary = resolver.resolve_selected(state, 0)
	_check(not bool(empty_selection.get("ok", true)), "resolve_no_selection_rejected")
	_check(str(empty_selection.get("error", "")) == "no_committed_cards", "resolve_no_selection_error")
