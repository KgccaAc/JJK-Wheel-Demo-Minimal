class_name LoginCardCharacterProjector
extends RefCounted

## 将源项目 jjk.custom-character.v3（或其登录卡 entry 包装）转换成当前战斗管线。
## 原始快照会保留在 canonicalV3，投影失败则明确标记 snapshot_valid=false，绝不悄悄降级成空角色。
const STAT_KEYS: Array[String] = ["cursedEnergy", "control", "efficiency", "body", "martial", "talent"]
const VALID_RANKS: Array[String] = ["E-", "E", "D", "C", "B", "A", "S", "SS", "SSS", "EX-", "EX"]
const VALID_CARD_TYPES: Array[String] = ["attack", "support", "defense", "resource", "domain"]
## 源 V3 的运行牌面类型比当前战斗展示分类更细；在投影边界统一折叠，
## 而不是把真实登录卡标为损坏并丢失整张角色快照。
const CARD_TYPE_ALIASES: Dictionary = {"technique":"attack", "ce_burst":"attack", "soul_pressure":"attack", "counter":"defense", "rule":"support"}

static func project(entry: Dictionary) -> Dictionary:
	var source: Dictionary = _unwrap(entry)
	var id: String = str(source.get("characterId", source.get("id", entry.get("characterId", entry.get("id", ""))))).strip_edges()
	var name: String = str(source.get("displayName", source.get("name", entry.get("displayName", "未命名角色")))).strip_edges()
	var errors: Array[String] = []
	if id.is_empty(): errors.append("character_id_missing")
	if name.is_empty(): errors.append("display_name_missing")
	var raw_stats: Dictionary = source.get("stats", source.get("baseStats", {})) as Dictionary
	var stats: Dictionary = {}
	for key: String in STAT_KEYS:
		var rank: String = str(raw_stats.get(key, "")).to_upper().strip_edges()
		if not VALID_RANKS.has(rank):
			errors.append("invalid_stat_" + key)
		else: stats[key] = rank
	var techniques: Array = source.get("techniques", []) as Array
	var technique_families: Array[String] = _strings(source.get("techniqueFamilies", source.get("technique_families", [])))
	for raw: Variant in techniques:
		if raw is Dictionary:
			var technique: Dictionary = raw as Dictionary
			var technique_id: String = str(technique.get("id", technique.get("name", ""))).strip_edges()
			if not technique_id.is_empty() and not technique_families.has(technique_id): technique_families.append(technique_id)
	var owner_family: String = "custom_" + id if not id.is_empty() else ""
	if not owner_family.is_empty(): technique_families.append(owner_family)
	# 登录卡历史版本把手札拆在多个字段中；不能用 get 的单一 fallback，
	# 否则 cards 存在但 specialHandCards 存在时会静默漏牌。
	# `特殊手札` is a source tag-list alias, not a hand-card list. Treating it
	# as cards turns identifiers into `invalid_card_N` and invalidates the whole
	# otherwise complete login-card snapshot.
	var raw_cards: Array = _combined_arrays(source, ["cards", "customHandCards", "specialHands", "specialHandCards", "handCards", "duelHandCards"])
	var cards: Array[Dictionary] = []
	var card_ids: Dictionary = {}
	for index: int in raw_cards.size():
		var projected: Dictionary = _project_card(raw_cards[index], id, owner_family, index)
		if bool(projected.get("valid", false)):
			var projected_card: Dictionary = projected.get("card", {}) as Dictionary
			var projected_id: String = str(projected_card.get("id", ""))
			if not card_ids.has(projected_id):
				card_ids[projected_id] = true
				cards.append(projected_card)
		else: errors.append(str(projected.get("error", "invalid_card_%d" % index)))
	var traits: Array[String] = _combined_strings(source, ["traits", "innateTraits", "specialTraits", "tags"])
	var card_tags: Array[String] = _combined_strings(source, ["cardTags", "specialHandTags", "specialhandTags", "特殊手札", "tags"])
	var special_hand_tags: Array[String] = _combined_strings(source, ["specialHandTags", "specialhandTags", "explicitSpecialHandTags", "特殊手札"])
	if not owner_family.is_empty() and not special_hand_tags.has(owner_family): special_hand_tags.append(owner_family)
	var domain: Variant = source.get("domain", source.get("domainProfile", source.get("domainScript", null)))
	var resources: Array = source.get("resources", []) as Array
	var loadout: Array[String] = _strings(source.get("loadout", source.get("tools", [])))
	var summons: Array = source.get("summons", []) as Array
	var flags: Dictionary = (source.get("flags", {}) as Dictionary).duplicate(true)
	flags["hasInnateTechnique"] = not techniques.is_empty() or not technique_families.is_empty()
	flags["hasDomainAccess"] = domain != null and not (domain is String and (str(domain).strip_edges().is_empty() or str(domain).strip_edges() == "无"))
	var profile: Dictionary = {
		"id": id, "characterId": id, "name": name, "displayName": name,
		"schema": source.get("schema", entry.get("schema", "")), "generationVersion": source.get("generationVersion", entry.get("generationVersion", "")), "origin": source.get("origin", entry.get("origin", "")),
		"stats": stats, "baseStats": stats.duplicate(true), "techniques": techniques.duplicate(true), "techniqueFamilies": technique_families,
		"traits": traits, "innateTraits": traits.duplicate(), "cardTags": card_tags, "specialHandTags": special_hand_tags, "specialhandTags": special_hand_tags.duplicate(), "explicitSpecialHandTags": special_hand_tags.duplicate(), "flags": flags,
		"domain": domain.duplicate(true) if domain is Dictionary else domain, "domainScript": domain.duplicate(true) if domain is Dictionary else null,
		"resources": resources.duplicate(true), "loadout": loadout, "summons": summons.duplicate(true),
		# These are not presentation-only fields: the source resource and hit-rate
		# formulas consume them. Keeping them prevents custom-card panels from being
		# silently weaker than the source project.
		"raw": (source.get("raw", {}) as Dictionary).duplicate(true), "axes": (source.get("axes", {}) as Dictionary).duplicate(true),
		"visibleGrade": source.get("visibleGrade", source.get("officialGrade", source.get("grade", ""))),
		"officialGrade": source.get("officialGrade", ""), "grade": source.get("grade", ""),
		"powerTier": source.get("powerTier", source.get("tier", source.get("pool", ""))),
		"combatPowerUnit": (source.get("combatPowerUnit", source.get("unitRatings", {}).get("combat", {})) as Dictionary).duplicate(true),
		"techniquePower": source.get("techniquePower", "B"), "techniqueRef": (source.get("techniqueRef", {}) as Dictionary).duplicate(true), "domainRef": (source.get("domainRef", {}) as Dictionary).duplicate(true), "sourceAnswers": (source.get("sourceAnswers", {}) as Dictionary).duplicate(true), "techniqueMatchError": source.get("techniqueMatchError", ""),
		"initial_counters": (source.get("initialCounters", source.get("initial_counters", {})) as Dictionary).duplicate(true), "initial_counter_labels": (source.get("initialCounterLabels", source.get("initial_counter_labels", {})) as Dictionary).duplicate(true),
		"customHandCards": cards, "canonicalV3": source.duplicate(true),
		"snapshot_valid": errors.is_empty(), "snapshot_errors": errors,
		"snapshot_metadata": {"character_revision": entry.get("characterRevision", source.get("characterRevision", 0)), "snapshot_hash": entry.get("snapshotHash", "")}
	}
	# CharacterProfileBuilder adds this derived index for built-in profiles. Online
	# snapshots bypass that builder, so construct the same index here; otherwise
	# tag-gated technique cards are filtered out only in network battles.
	profile["tag_set"] = _tag_set(profile)
	return profile

static func _tag_set(profile: Dictionary) -> Dictionary:
	var result: Dictionary = {}
	for key: String in ["traits", "cardTags", "archetypes", "techniqueFamilies", "variants", "forceAllowTags"]:
		for raw_tag: Variant in profile.get(key, []) as Array:
			result[str(raw_tag)] = true
	return result

static func _unwrap(entry: Dictionary) -> Dictionary:
	for key: String in ["card", "character", "json", "canonicalV3", "characterV3", "canonicalSnapshot"]:
		if entry.get(key, null) is Dictionary:
			var nested: Dictionary = (entry.get(key, {}) as Dictionary).duplicate(true)
			# canonicalSnapshot is itself a wrapper in some login-card revisions.
			if nested.get("character", null) is Dictionary:
				nested = (nested.get("character", {}) as Dictionary).duplicate(true)
			# 卡表容器常把特殊手札留在外层；合并它们而不覆盖 canonical 数据。
			for inherited: String in ["specialHands", "specialHandCards", "specialHandTags", "specialhandTags", "特殊手札", "customHandCards", "cards", "cardTags", "tags", "raw", "axes", "visibleGrade", "officialGrade", "grade", "powerTier", "tier", "pool", "combatPowerUnit", "unitRatings", "techniquePower"]:
				if not nested.has(inherited) and entry.has(inherited): nested[inherited] = entry[inherited]
			return nested
	return entry

static func _project_card(raw: Variant, character_id: String, owner_family: String, index: int) -> Dictionary:
	if not raw is Dictionary: return {"valid":false, "error":"invalid_card_%d" % index}
	var source: Dictionary = raw as Dictionary
	var card_id: String = str(source.get("id", "")).strip_edges()
	var name: String = str(source.get("name", source.get("label", ""))).strip_edges()
	var source_type: String = str(source.get("cardType", source.get("type", "attack"))).strip_edges().to_lower()
	var card_type: String = str(CARD_TYPE_ALIASES.get(source_type, source_type))
	if card_id.is_empty() or name.is_empty() or not VALID_CARD_TYPES.has(card_type): return {"valid":false, "error":"invalid_card_%d" % index}
	var cost_source: Dictionary = source.get("cost", {}) as Dictionary
	var ce_raw: Variant = cost_source.get("ce", source.get("ceCost", 0))
	var ce: float = float((ce_raw as Dictionary).get("value", 0)) if ce_raw is Dictionary else float(ce_raw)
	var power: Dictionary = source.get("power", {}) as Dictionary
	var damage_raw: Variant = source.get("damage", 0)
	var damage_info: Dictionary = damage_raw as Dictionary if damage_raw is Dictionary else {}
	var damage: float = float(power.get("attack", damage_raw if not damage_raw is Dictionary else 0))
	var block: float = float(power.get("defense", source.get("block", 0)))
	# 源登录卡既有 effects: [...]，也有单个 DSL 工具 effects: {...} 的写法。
	# 统一投影为数组，避免导入阶段的强制转换让整张角色卡被丢弃。
	var raw_effects: Variant = source.get("effects", [])
	var effect_tools: Array = raw_effects as Array if raw_effects is Array else [raw_effects] if raw_effects is Dictionary else []
	return {"valid":true, "card": {
		"id": card_id, "actionId": card_id, "name": name, "label": name, "type": card_type, "cardType": card_type,
		"cost": {"ap": int(cost_source.get("ap", source.get("apCost", 1))), "ce": ce, "hp": 0, "flatCe": ce, "minCe": ce},
		"apCost": int(cost_source.get("ap", source.get("apCost", 1))), "ceCost": ce,
		# CoreActionResolver 从 effect.special.atomicEffects 读取 DSL；同时保留 effects 供 UI/导出。
		"effect": {"damage": damage, "block": block, "damageType": str(damage_info.get("type", "technique")), "effects": effect_tools.duplicate(true), "special": {"kind":"custom_character_v3", "atomicEffects":effect_tools.duplicate(true)}},
		"damage": damage, "block": block, "tags": _strings(source.get("tags", [])) + ["特色手札", owner_family],
		"guaranteedPerTurn": bool(source.get("guaranteedPerTurn", false)), "handSource": str(source.get("handSource", "custom_character_v3")),
		"contexts": ["normal", "domain", "trial_allowed"], "sourceTechniqueFamily": owner_family,
		"exclusive": {"characters":[character_id], "archetypes":[], "variants":[]}, "customCharacterId": character_id,
		"effectTools": effect_tools.duplicate(true), "summary": str((source.get("text", {}) as Dictionary).get("summary", source.get("summary", "")))
	}}

static func _strings(value: Variant) -> Array[String]:
	var result: Array[String] = []
	for raw: Variant in value as Array if value is Array else []:
		var text: String = str(raw).strip_edges()
		if not text.is_empty() and not result.has(text): result.append(text)
	return result

static func _combined_arrays(source: Dictionary, keys: Array[String]) -> Array:
	var result: Array = []
	for key: String in keys:
		var value: Variant = source.get(key, [])
		if value is Array: result.append_array(value as Array)
	return result

static func _combined_strings(source: Dictionary, keys: Array[String]) -> Array[String]:
	var result: Array[String] = []
	for key: String in keys:
		for value: String in _strings(source.get(key, [])):
			if not result.has(value): result.append(value)
	return result
