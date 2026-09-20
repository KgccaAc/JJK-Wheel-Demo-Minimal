class_name WheelRankEvaluator
extends RefCounted

## 平面 wheels.json 的“全抽取到评级”解释器。
## 源 Web 版依据流程图推进到 grade 节点；当前导入只有题库，因此这里明确
## 只从可识别的六维属性结果计算，并把原始答案完整保留给后续服务端复核。
const STAT_TITLES: Dictionary = {
	"咒力总量": "cursedEnergy", "咒力操纵": "control", "咒力效率": "efficiency",
	"体质（基础体质）": "body", "体术水平": "martial", "天赋": "talent"
}
const RANK_VALUES: Dictionary = {"E-": 0.0, "E": 1.0, "D": 2.0, "C": 3.0, "B": 4.0, "A": 5.0, "S": 6.0, "SS": 7.0, "SSS": 8.0, "EX-": 9.0, "EX": 10.0}
const GRADE_RANGES: Array[Dictionary] = [
	{"key":"support", "label":"辅助", "min":0.0}, {"key":"grade4", "label":"四级", "min":13.0},
	{"key":"grade3", "label":"三级", "min":22.0}, {"key":"grade2", "label":"二级", "min":40.0},
	{"key":"semiGrade1", "label":"准一级", "min":45.0}, {"key":"grade1", "label":"一级", "min":57.0},
	{"key":"semiSpecialGrade1", "label":"超一级", "min":67.0}, {"key":"specialGradeLow", "label":"下位特级", "min":78.0},
	{"key":"specialGrade", "label":"标准特级", "min":83.0}, {"key":"specialGradeHigh", "label":"上位特级", "min":90.0}
]

static func evaluate(answers: Dictionary) -> Dictionary:
	var stats: Dictionary = {}
	for title: String in STAT_TITLES:
		var rank: String = extract_rank(str(answers.get(title, "")))
		if not rank.is_empty(): stats[STAT_TITLES[title]] = rank
	var values: Array[float] = []
	for key: String in ["cursedEnergy", "control", "efficiency", "body", "martial", "talent"]:
		if stats.has(key): values.append(float(RANK_VALUES.get(stats[key], 0.0)))
	values.sort()
	values.reverse()
	# 对齐源项目的 top-3 主导思想；缺失属性不填零，避免把未配置题库误判成弱角色。
	var score: float = 0.0
	if not values.is_empty():
		score = values[0] * 3.8
		if values.size() > 1: score += values[1] * 2.4
		if values.size() > 2: score += values[2] * 1.6
		score = clampf(score, 0.0, 100.0)
	var grade: Dictionary = GRADE_RANGES[0].duplicate(true)
	for candidate: Dictionary in GRADE_RANGES:
		if score >= float(candidate["min"]): grade = candidate.duplicate(true)
	return {"stats":stats, "score":snappedf(score, 0.1), "grade_key":grade["key"], "grade_label":grade["label"], "source":"flat-wheel-compatible-v1", "answers":answers.duplicate(true)}

static func extract_rank(text: String) -> String:
	var normalized: String = text.to_upper().replace(" ", "")
	for rank: String in ["EX-", "EX", "SSS", "SS", "S", "A", "B", "C", "D", "E-", "E"]:
		if normalized.contains(rank): return rank
	return ""

