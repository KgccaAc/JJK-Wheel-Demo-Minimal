extends RefCounted
## 纯抽取规则：概率与扇区共享同一份权重，页面只负责呈现。

static func validate(items: Array[Dictionary]) -> bool:
	if items.is_empty(): return false
	var total: float = 0.0
	for item: Dictionary in items:
		var weight: Variant = item.get("weight", 1.0)
		if not (weight is int or weight is float): return false
		if not is_finite(float(weight)) or float(weight) < 0.0: return false
		if str(item.get("text", "")).strip_edges().is_empty(): return false
		total += float(weight)
	return is_finite(total) and total > 0.0

static func angles(items: Array[Dictionary]) -> Array[float]:
	var result: Array[float] = []
	var total: float = 0.0
	if validate(items):
		for item: Dictionary in items: total += float(item.get("weight", 1.0))
	var angle: float = -PI / 2.0
	for item: Dictionary in items:
		result.append(angle)
		if total > 0.0: angle += TAU * float(item.get("weight", 1.0)) / total
	return result

static func pick(items: Array[Dictionary], unit: float) -> int:
	if not validate(items): return -1
	var total: float = 0.0
	for item: Dictionary in items: total += float(item.get("weight", 1.0))
	var target: float = clampf(unit, 0.0, 0.999999999999) * total
	var last_positive: int = -1
	for index: int in items.size():
		var weight: float = float(items[index].get("weight", 1.0))
		if weight <= 0.0: continue
		last_positive = index
		if target < weight: return index
		target -= weight
	return last_positive

static func landing_rotation(items: Array[Dictionary], index: int, pointer_angle: float = -PI / 2.0) -> float:
	var starts: Array[float] = angles(items)
	var end: float = starts[index + 1] if index + 1 < starts.size() else TAU - PI / 2.0
	return fposmod(pointer_angle - (starts[index] + end) * 0.5, TAU)

static func load_wheels(primary: String, fallback: String) -> Array[Dictionary]:
	for path: String in [primary, fallback]:
		var file: FileAccess = FileAccess.open(path, FileAccess.READ)
		if file == null: continue
		var json: JSON = JSON.new()
		if json.parse(file.get_as_text()) != OK: continue
		var parsed: Variant = json.data
		if not parsed is Dictionary or not parsed.get("wheels") is Array: continue
		var result: Array[Dictionary] = []
		for wheel: Variant in parsed["wheels"]:
			if not wheel is Dictionary or not wheel.get("items") is Array: continue
			var items: Array[Dictionary] = []
			for item: Variant in wheel["items"]:
				if item is Dictionary: items.append(item.duplicate(true))
			if items.size() != wheel["items"].size() or not validate(items): continue
			# flow-v1 的任务通过 dbId 指向盘；页面切盘也必须保留这个源标识。
			result.append({"dbId": int(wheel.get("dbId", -1)), "title": str(wheel.get("title", "转盘")), "items": items})
		if not result.is_empty(): return result
	return []


