class_name WheelFlowSession
extends RefCounted

## 源项目 flow-v1 的纯数据会话。UI 只负责展示 task；此类保留节点、答案和跳过原因，
## 让“自动到评级”与角色草稿生成共享同一份可复放状态。
const FLOW_PATH: String = "res://data/wheel/source/flow-v1-candidate.json"
const STRENGTH_PATH: String = "res://data/wheel/source/strength-v0.2-candidate.json"
const OPTION_EFFECTS_PATH: String = "res://data/wheel/source/option-effects-v0.1.json"
const WHEELS_PATH: String = "res://public/wheels.json"
const WHEELS_FALLBACK_PATH: String = "res://data/wheels.json"

var _flow: Dictionary = {}
var _strength: Dictionary = {}
var _option_effects: Dictionary = {}
var _wheels: Dictionary = {}
var _main_index: int = 0
var _answers: Dictionary = {}
var _skipped: Array[Dictionary] = []
var _task_queue: Array[Dictionary] = []
var _flags: Dictionary = {"skipPeriods": {}}
var _effect_ledger: Array[Dictionary] = []

func load_source_config() -> Dictionary:
	_flow = _read_json(FLOW_PATH)
	_strength = _read_json(STRENGTH_PATH)
	_option_effects = _read_json(OPTION_EFFECTS_PATH)
	var wheel_document: Dictionary = _read_json_with_fallback(WHEELS_PATH, WHEELS_FALLBACK_PATH)
	_wheels.clear()
	for raw: Variant in wheel_document.get("wheels", []):
		if raw is Dictionary:
			var wheel: Dictionary = raw as Dictionary
			_wheels[int(wheel.get("dbId", -1))] = wheel.duplicate(true)
	_main_index = 0
	_answers.clear()
	_skipped.clear()
	_task_queue.clear()
	_flags = {"skipPeriods": {}}
	_effect_ledger.clear()
	return {"ok":not _flow.is_empty() and not _strength.is_empty() and not _wheels.is_empty(), "flow_version":_flow.get("version", ""), "wheel_count":_wheels.size()}

func next_task() -> Dictionary:
	while not _task_queue.is_empty():
		var queued: Dictionary = _task_queue.pop_front()
		var period: String = str(queued.get("timeline_period", ""))
		if bool((_flags.get("skipPeriods", {}) as Dictionary).get(period, false)):
			_skipped.append({"node_id":queued.get("node_id", ""), "reason":"timeline_period_skipped"})
		elif _condition_matches(str(queued.get("condition", ""))): return queued
		else: _skipped.append({"node_id":queued.get("node_id", ""), "reason":"condition_false", "condition":queued.get("condition", "")})
	var main_flow: Array = _flow.get("mainFlow", []) as Array
	var nodes: Dictionary = _flow.get("nodes", {}) as Dictionary
	while _main_index < main_flow.size():
		var node_id: String = str(main_flow[_main_index])
		_main_index += 1
		var node: Dictionary = nodes.get(node_id, {}) as Dictionary
		if node.is_empty():
			_skipped.append({"node_id":node_id, "reason":"node_missing"})
			continue
		if not _condition_matches(str(node.get("condition", ""))):
			_skipped.append({"node_id":node_id, "reason":"condition_false", "condition":node.get("condition", "")})
			continue
		if str(node.get("type", "")) == "timelineSubflow":
			_enqueue_timeline()
			return next_task()
		var task: Dictionary = _task_from_node(node_id, node)
		if task.is_empty():
			_skipped.append({"node_id":node_id, "reason":"non_interactive_branch"})
			continue
		return task
	return {"type":"end", "node_id":"complete", "title":"流程完成", "answers":_answers.duplicate(true), "skipped":_skipped.duplicate(true)}

func accept_result(task: Dictionary, result: String) -> void:
	var node_id: String = str(task.get("node_id", ""))
	if node_id.is_empty() or str(task.get("type", "")) == "end": return
	_answers[node_id] = result
	_apply_option_effects(int(task.get("wheel_id", -1)), result)

func answers() -> Dictionary:
	return _answers.duplicate(true)

func display_answers() -> Dictionary:
	var result: Dictionary = {}
	var nodes: Dictionary = _flow.get("nodes", {}) as Dictionary
	for node_id: String in _answers:
		var node: Dictionary = nodes.get(node_id, {}) as Dictionary
		result[str(node.get("title", node_id))] = _answers[node_id]
	return result

func skipped() -> Array[Dictionary]:
	return _skipped.duplicate(true)

func flags() -> Dictionary:
	return _flags.duplicate(true)

func effect_ledger() -> Array[Dictionary]:
	return _effect_ledger.duplicate(true)

## 源项目 runCompetitionFlowToGrade 的离线等价入口：使用同一 flow/mainFlow，
## 自动为可抽取节点选项取样，直到 computedGrade。非可执行扩展节点会保留 skip 诊断。
func run_to_grade(seed: int = 0) -> Dictionary:
	var loaded: Dictionary = load_source_config()
	if not bool(loaded.get("ok", false)): return {"ok":false, "code":"source_config_missing"}
	var rng := RandomNumberGenerator.new()
	if seed == 0: rng.randomize()
	else: rng.seed = seed
	var steps: int = 0
	while steps < 220:
		var task: Dictionary = next_task()
		if str(task.get("type", "")) == "computed_grade":
			var stats: Dictionary = _stats_from_answers()
			return {"ok":true, "steps":steps, "answers":_answers.duplicate(true), "skipped":_skipped.duplicate(true), "flags":_flags.duplicate(true), "effect_ledger":_effect_ledger.duplicate(true), "grade":evaluate_grade(stats), "stats":stats}
		if str(task.get("type", "")) == "end": return {"ok":false, "code":"grade_node_not_reached", "steps":steps, "answers":_answers.duplicate(true), "skipped":_skipped.duplicate(true)}
		var choice: String = _pick_task_result(task, rng)
		if choice.is_empty():
			_skipped.append({"node_id":task.get("node_id", ""), "reason":"no_options"})
		else:
			accept_result(task, choice)
		steps += 1
	return {"ok":false, "code":"max_steps", "steps":steps, "answers":_answers.duplicate(true), "skipped":_skipped.duplicate(true)}

## 完整离线复放入口：评分节点不停止，而是保存结果后继续到 timeline/终局。
func run_full(seed: int = 0) -> Dictionary:
	var loaded: Dictionary = load_source_config()
	if not bool(loaded.get("ok", false)): return {"ok":false, "code":"source_config_missing"}
	var rng := RandomNumberGenerator.new()
	if seed == 0: rng.randomize()
	else: rng.seed = seed
	var steps: int = 0
	var grade: Dictionary = {}
	while steps < 480:
		var task: Dictionary = next_task()
		var type: String = str(task.get("type", ""))
		if type == "computed_grade":
			grade = evaluate_grade(_stats_from_answers())
			accept_result(task, str(grade.get("grade_label", grade.get("key", "未定"))))
		elif type == "end":
			return {"ok":not grade.is_empty(), "completed":true, "steps":steps, "grade":grade, "answers":_answers.duplicate(true), "skipped":_skipped.duplicate(true)}
		else:
			var choice: String = _pick_task_result(task, rng)
			if choice.is_empty(): _skipped.append({"node_id":task.get("node_id", ""), "reason":"no_options"})
			else: accept_result(task, choice)
		steps += 1
	return {"ok":false, "completed":false, "code":"max_steps", "steps":steps, "grade":grade, "answers":_answers.duplicate(true), "skipped":_skipped.duplicate(true)}

func evaluate_grade(stats: Dictionary) -> Dictionary:
	var ranks: Dictionary = _strength.get("rankScale", {}) as Dictionary
	var values: Array[float] = []
	for key: String in ["cursedEnergy", "control", "efficiency", "body", "martial", "talent"]:
		var value: Variant = stats.get(key, "E-")
		values.append(float(ranks.get(str(value), 0.0)))
	values.sort()
	values.reverse()
	var score: float = 0.0
	if not values.is_empty():
		score = values[0] * 3.8
		if values.size() > 1: score += values[1] * 2.4
		if values.size() > 2: score += values[2] * 1.6
		score = clampf(score, 0.0, 100.0)
	var ranges: Array = _strength.get("deterministicGradeRanges", {}).get("ranges", []) as Array
	if ranges.is_empty(): ranges = [{"grade":"support", "min":0}, {"grade":"grade4", "min":13}, {"grade":"grade3", "min":22}, {"grade":"grade2", "min":40}, {"grade":"semiGrade1", "min":45}, {"grade":"grade1", "min":57}, {"grade":"semiSpecialGrade1", "min":67}, {"grade":"specialGradeLow", "min":78}, {"grade":"specialGrade", "min":83}, {"grade":"specialGradeHigh", "min":90}]
	var selected: Dictionary = ranges[0] as Dictionary
	for raw: Variant in ranges:
		if raw is Dictionary and score >= float((raw as Dictionary).get("min", 0.0)): selected = raw as Dictionary
	var grade_key: String = str(selected.get("grade", "support"))
	var labels: Dictionary = {"support":"辅助", "grade4":"四级", "grade3":"三级", "grade2":"二级", "semiGrade1":"准一级", "grade1":"一级", "semiSpecialGrade1":"超一级", "specialGradeLow":"下位特级", "specialGrade":"标准特级", "specialGradeHigh":"上位特级"}
	return {"key":grade_key, "grade_label":str(labels.get(grade_key, grade_key)), "score":snappedf(score, 0.1), "source":"source-strength-v0.2"}

func _task_from_node(node_id: String, node: Dictionary) -> Dictionary:
	var type: String = str(node.get("type", "wheel"))
	if type == "computedGrade": return {"type":"computed_grade", "node_id":node_id, "title":node.get("title", "等级判定")}
	if type == "customChoice":
		return {"type":"choice", "node_id":node_id, "title":node.get("title", "选择"), "options":node.get("options", [])}
	if type == "wheel":
		var wheel_id: int = int(node.get("wheelId", -1))
		if wheel_id < 0: return {"type":"choice", "node_id":node_id, "title":node.get("title", "选择"), "options":node.get("options", [])}
		var wheel: Dictionary = _wheels.get(wheel_id, {}) as Dictionary
		return {"type":"wheel", "node_id":node_id, "wheel_id":wheel_id, "title":node.get("title", wheel.get("title", "转盘")), "items":wheel.get("items", [])}
	if type == "dynamicWheel":
		var selected_wheel: int = -1
		for raw: Variant in node.get("wheelSelection", []):
			if not raw is Dictionary: continue
			var selection: Dictionary = raw as Dictionary
			if _when_matches(str(selection.get("when", "default"))):
				selected_wheel = int(selection.get("wheelId", -1))
				break
		var selected: Dictionary = _wheels.get(selected_wheel, {}) as Dictionary
		return {"type":"wheel", "node_id":node_id, "wheel_id":selected_wheel, "title":node.get("title", selected.get("title", "转盘")), "items":selected.get("items", [])}
	if type == "multiDraw":
		var content_id: int = int(node.get("contentWheelId", -1))
		var content: Dictionary = _wheels.get(content_id, {}) as Dictionary
		return {"type":"multi_wheel", "node_id":node_id, "wheel_id":content_id, "title":node.get("title", content.get("title", "多选转盘")), "items":content.get("items", []), "count":_answer_count(str(node.get("countFrom", "")))}
	if type == "subflow":
		return {"type":"multi_wheel", "node_id":node_id, "title":node.get("title", "子流程"), "wheel_ids":node.get("wheels", []), "count":-1}
	return {}

func _condition_matches(expression: String) -> bool:
	var source: String = expression.strip_edges()
	if source.is_empty(): return true
	for or_term: String in source.split(" or "):
		var all_match: bool = true
		for and_term: String in or_term.split(" and "):
			if not _term_matches(and_term.strip_edges()):
				all_match = false
				break
		if all_match: return true
	return false

func _term_matches(term: String) -> bool:
	if term == "default": return true
	if term.ends_with(" unset"):
		return not _answers.has(term.trim_suffix(" unset").strip_edges())
	if term.contains(" is humanlike"):
		var identity: String = str(_value_for_key(term.trim_suffix(" is humanlike").strip_edges()))
		return identity != "咒灵" and identity != ""
	if term.contains(" includes "):
		var pieces: PackedStringArray = term.split(" includes ")
		return str(_value_for_key(pieces[0].strip_edges())).contains(pieces[1].strip_edges())
	if term.contains(" != "):
		var pieces: PackedStringArray = term.split(" != ")
		return str(_value_for_key(pieces[0].strip_edges())) != pieces[1].strip_edges()
	if term.contains(" == "):
		var pieces: PackedStringArray = term.split(" == ")
		var expected: String = pieces[1].strip_edges()
		var actual: Variant = _value_for_key(pieces[0].strip_edges())
		var actual_text: String = str(actual).to_lower()
		if expected == "true": return actual_text == "true" or actual_text == "是"
		if expected == "false": return actual_text == "false" or actual_text == "否"
		return str(actual) == expected
	return false

func _enqueue_timeline() -> void:
	var timeline: Dictionary = _flow.get("timeline", {}) as Dictionary
	var start_text: String = str(_answers.get("startTime", ""))
	var start_period: String = "mainStart"
	for mapping_key: String in (timeline.get("startMapping", {}) as Dictionary):
		if start_text.contains(mapping_key):
			start_period = str((timeline.get("startMapping", {}) as Dictionary)[mapping_key])
			break
	var periods: Dictionary = timeline.get("periods", {}) as Dictionary
	var ordered: Array[String] = []
	for key: String in ["ancient", "hiddenInventory", "volume0", "mainStart", "shibuya", "cullingGame", "shinjuku", "after68"]:
		if periods.has(key): ordered.append(key)
	var start_index: int = maxi(ordered.find(start_period), 0)
	for index: int in range(start_index, ordered.size()):
		var period: String = ordered[index]
		for raw: Variant in periods.get(period, []):
			if not raw is Dictionary: continue
			var item: Dictionary = raw as Dictionary
			var wheel_id: int = int(item.get("contentWheelId", item.get("wheelId", -1)))
			var task: Dictionary = {"type":"multi_wheel" if item.has("countFrom") else "wheel", "node_id":str(item.get("nodeId", "timeline-%s-%d" % [period, wheel_id])), "wheel_id":wheel_id, "title":item.get("title", "剧情事件"), "condition":item.get("condition", ""), "items":item.get("options", (_wheels.get(wheel_id, {}) as Dictionary).get("items", [])), "count":_answer_count(str(item.get("countFrom", ""))), "timeline_period":period}
			_task_queue.append(task)

func _value_for_key(key: String) -> Variant:
	return _flags.get(key, _answers.get(key, ""))

func _apply_option_effects(wheel_id: int, option_text: String) -> void:
	var normalized_id: String = "W%03d" % wheel_id
	for raw: Variant in _option_effects.get("records", []):
		if not raw is Dictionary: continue
		var record: Dictionary = raw as Dictionary
		if str(record.get("wheelId", "")) != normalized_id or str(record.get("optionText", "")) != option_text: continue
		for raw_effect: Variant in record.get("effects", []):
			if not raw_effect is Dictionary: continue
			var effect: Dictionary = raw_effect as Dictionary
			_effect_ledger.append({"wheel_id":wheel_id, "option_text":option_text, "effect":effect.duplicate(true)})
			match str(effect.get("type", "")):
				"setFlag": _flags[str(effect.get("flag", ""))] = effect.get("value", true)
				"skipPeriod": (_flags.get("skipPeriods", {}) as Dictionary)[str(effect.get("value", ""))] = true
				"deathOutcome": _flags["dead"] = true
				"battleResult": _flags[str(effect.get("target", "battleResult"))] = effect.get("value", "")
				"hiddenStrengthEligibility": _append_flag_value("hiddenStrengthEligibility", effect.get("value", ""))
				"storyBenefit": _flags["storyBenefit"] = float(_flags.get("storyBenefit", 0.0)) + float(effect.get("value", 0.0))
				"storyRisk": _flags["storyRisk"] = float(_flags.get("storyRisk", 0.0)) + float(effect.get("value", 0.0))
				"factionOutcome", "playerContribution": _append_flag_value(str(effect.get("type", "effect")), effect.get("value", ""))

func _append_flag_value(key: String, value: Variant) -> void:
	var entries: Array = _flags.get(key, []) as Array
	if not entries.has(value): entries.append(value)
	_flags[key] = entries

func _read_json(path: String) -> Dictionary:
	var file: FileAccess = FileAccess.open(path, FileAccess.READ)
	if file == null: return {}
	var parsed: Variant = JSON.parse_string(file.get_as_text())
	return parsed as Dictionary if parsed is Dictionary else {}

func _read_json_with_fallback(primary_path: String, fallback_path: String) -> Dictionary:
	var primary: Dictionary = _read_json(primary_path)
	if not primary.is_empty(): return primary
	return _read_json(fallback_path)

func _pick_task_result(task: Dictionary, rng: RandomNumberGenerator) -> String:
	if str(task.get("type", "")) == "multi_wheel":
		var outputs: Array[String] = []
		var wheel_ids: Array = task.get("wheel_ids", []) as Array
		if wheel_ids.is_empty():
			var repeat: int = maxi(int(task.get("count", 1)), 1)
			for _index: int in repeat: outputs.append(_pick_items(task.get("items", []) as Array, rng))
		else:
			for raw_id: Variant in wheel_ids:
				var wheel: Dictionary = _wheels.get(int(raw_id), {}) as Dictionary
				outputs.append(_pick_items(wheel.get("items", []) as Array, rng))
		outputs = outputs.filter(func(value: String) -> bool: return not value.is_empty())
		return "、".join(outputs)
	return _pick_items(task.get("items", task.get("options", [])) as Array, rng)

func _pick_items(items: Array, rng: RandomNumberGenerator) -> String:
	if items.is_empty(): return ""
	var total: float = 0.0
	for raw: Variant in items:
		if raw is Dictionary: total += maxf(float((raw as Dictionary).get("weight", 1.0)), 0.0)
	if total <= 0.0: return ""
	var target: float = rng.randf() * total
	for raw: Variant in items:
		if not raw is Dictionary: continue
		var item: Dictionary = raw as Dictionary
		target -= maxf(float(item.get("weight", 1.0)), 0.0)
		if target <= 0.0: return str(item.get("text", item.get("label", "")))
	return str((items.back() as Dictionary).get("text", (items.back() as Dictionary).get("label", "")))

func _when_matches(when: String) -> bool:
	if when == "default": return true
	var stats: Dictionary = _stats_from_answers()
	if when == "highTalent": return float((_strength.get("rankScale", {}) as Dictionary).get(str(stats.get("talent", "E-")), 0.0)) >= 5.0
	if when == "weakPower":
		var total: float = 0.0
		for value: Variant in stats.values(): total += float((_strength.get("rankScale", {}) as Dictionary).get(str(value), 0.0))
		return total <= 10.0
	return false

func _answer_count(node_id: String) -> int:
	var answer: String = str(_answers.get(node_id, "1"))
	var digits: String = ""
	for index: int in answer.length():
		var character: String = answer.substr(index, 1)
		if character >= "0" and character <= "9": digits += character
	return clampi(int(digits) if not digits.is_empty() else 1, 1, 8)

func _stats_from_answers() -> Dictionary:
	var result: Dictionary = {}
	for node_id: String in ["cursedEnergy", "control", "efficiency", "body", "martial", "talent"]:
		var rank: String = _extract_rank(str(_answers.get(node_id, "")))
		if not rank.is_empty(): result[node_id] = rank
	return result

func _extract_rank(text: String) -> String:
	var normalized: String = text.to_upper().replace(" ", "")
	for rank: String in ["EX-", "EX", "SSS", "SS", "S", "A", "B", "C", "D", "E-", "E"]:
		if normalized.contains(rank): return rank
	return "E-"

