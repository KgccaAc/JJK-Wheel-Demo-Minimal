class_name WheelTechniqueRegistry
extends RefCounted

const SOURCE_PATH: String = "res://data/wheel/source/strength-v0.2-candidate.json"
const FALLBACK_FAMILIES: Dictionary = {
	"疱疮神":"smallpox_deity_countdown", "天使":"jacobs_ladder", "激震掌":"panda_core_shift",
	"自定义":"custom", "自定义术式":"custom", "穿越者当然是外挂（进入彩蛋池）":"custom",
	"黑绳体术":"black_rope", "新阴流简易领域／拔刀术":"simple_domain_sword",
	"焦眉之赳":"ogi_flame_blade", "反转术式医师":"rct_support", "简易领域":"simple_domain"
}

## Stable references used by generated wheel characters. The wheel stores a
## builtin technique key; cards and domain rules remain owned by battle data.
const TECHNIQUES: Dictionary = {
	"赤血操术": {"key":"blood_manipulation", "aliases":["赤血操术", "赤血操术 —— 加茂", "blood_manipulation"], "domain_id":"", "power":"B"},
	"无下限": {"key":"limitless", "aliases":["无下限", "无下限术式", "limitless", "infinity"], "domain_id":"gojo_unlimited_void", "power":"A"},
	"十种影法术": {"key":"ten_shadows", "aliases":["十种影法术", "十种影", "十影", "ten_shadows"], "domain_id":"megumi_chimera_shadow_garden", "power":"A"}
	,"咒灵操术": {"key":"curse_spirit_manipulation", "aliases":["咒灵操术", "curse_manipulation", "curse_spirit_manipulation"], "domain_id":"", "power":"B"}
	,"咒言": {"key":"cursed_speech", "aliases":["咒言", "cursed_speech"], "domain_id":"", "power":"B"}
	,"投射咒法": {"key":"projection_sorcery", "aliases":["投射咒法", "projection_sorcery"], "domain_id":"", "power":"A"}
	,"黑鸟操术": {"key":"black_bird_manipulation", "aliases":["黑鸟操术", "黑鸟操术（乌鸦）", "black_bird_manipulation"], "domain_id":"", "power":"B"}
	,"星之怒": {"key":"star_rage", "aliases":["星之怒", "星之怒（九十九）", "star_rage"], "domain_id":"", "power":"A"}
	,"冰凝咒法": {"key":"ice_formation", "aliases":["冰凝咒法", "冰凝咒法（里梅）", "ice_formation"], "domain_id":"", "power":"A"}
	,"构筑术式": {"key":"construction", "aliases":["构筑术式", "construction"], "domain_id":"", "power":"B"}
	,"傀儡操术": {"key":"puppet_manipulation", "aliases":["傀儡操术", "傀儡操术（机械丸）", "puppet_manipulation"], "domain_id":"", "power":"B"}
	,"术式消灭": {"key":"jacobs_ladder", "aliases":["术式消灭", "术式消灭（天使）", "jacobs_ladder"], "domain_id":"", "power":"A"}
}

static func resolve(name: String) -> Dictionary:
	var normalized := name.strip_edges()
	var source_match: Dictionary = _resolve_source_profile(normalized)
	if not source_match.is_empty():
		return source_match
	for canonical: String in TECHNIQUES:
		var item: Dictionary = TECHNIQUES[canonical] as Dictionary
		for alias: Variant in item.get("aliases", []) as Array:
			if normalized == str(alias).strip_edges():
				return {"ok":true, "registered":true, "name":canonical, "sourceProfile":canonical, "key":str(item.get("key", "")), "domainId":str(item.get("domain_id", "")), "techniquePower":str(item.get("power", "B"))}
	var fallback_family: String = str(FALLBACK_FAMILIES.get(normalized, ""))
	if fallback_family.is_empty():
		fallback_family = _source_family(normalized)
	if not fallback_family.is_empty():
		return {"ok":true, "registered":true, "name":normalized, "sourceProfile":normalized, "key":fallback_family, "domainId":"", "techniquePower":"B"}
	return {"ok":false, "error":"unknown_builtin_technique:%s" % normalized, "name":normalized, "key":"", "domainId":"", "techniquePower":"B"}

static func list_registered() -> Array[Dictionary]:
	var result: Array[Dictionary] = []
	var profiles: Dictionary = _source_profiles()
	for profile_name: Variant in profiles.keys():
		var profile: Dictionary = profiles.get(profile_name, {}) as Dictionary
		result.append(_source_entry(str(profile_name), profile))
	return result

static func _resolve_source_profile(normalized: String) -> Dictionary:
	var profiles: Dictionary = _source_profiles()
	for profile_name: Variant in profiles.keys():
		var source_name := str(profile_name)
		var profile: Dictionary = profiles.get(profile_name, {}) as Dictionary
		var aliases: Array = profile.get("alias", []) as Array
		var tags: Array = profile.get("specialHandTags", []) as Array
		var display_name := str(profile.get("displayName", source_name)).strip_edges()
		var source_entry: Dictionary = _source_entry(source_name, profile)
		var matches := normalized == source_name.strip_edges() or normalized == display_name or normalized == str(source_entry.get("key", "")).strip_edges()
		if not matches:
			for raw: Variant in aliases:
				if normalized == str(raw).strip_edges(): matches = true; break
		if not matches:
			for raw: Variant in tags:
				if normalized == str(raw).strip_edges(): matches = true; break
		if not matches:
			for raw: Variant in source_entry.get("aliases", []) as Array:
				if normalized == str(raw).strip_edges(): matches = true; break
		if matches: return _source_entry(source_name, profile)
	return {}

static func _source_entry(source_name: String, profile: Dictionary) -> Dictionary:
	var tags: Array = profile.get("specialHandTags", []) as Array
	var stable_key := ""
	for raw: Variant in tags:
		var tag := str(raw).strip_edges()
		if not tag.is_empty(): stable_key = _normalize_source_family(tag); break
	if stable_key.is_empty(): stable_key = str(FALLBACK_FAMILIES.get(source_name, ""))
	if stable_key.is_empty(): stable_key = str(FALLBACK_FAMILIES.get(str(profile.get("displayName", "")).strip_edges(), ""))
	var display_name := str(profile.get("displayName", source_name)).strip_edges()
	var manual: Dictionary = _manual_entry(source_name, display_name, stable_key)
	var power := str(manual.get("power", "B"))
	if manual.is_empty():
		var visible_grade := str(profile.get("visibleGrade", ""))
		if visible_grade in ["S", "SS", "SSS", "EX", "EX-"]: power = "A"
	var aliases: Array[String] = [source_name, display_name]
	for raw: Variant in profile.get("alias", []) as Array:
		var alias := str(raw).strip_edges()
		if not alias.is_empty() and not aliases.has(alias): aliases.append(alias)
	for raw: Variant in tags:
		var tag := str(raw).strip_edges()
		if not tag.is_empty() and not aliases.has(tag): aliases.append(tag)
	for raw: Variant in manual.get("aliases", []) as Array:
		var alias := str(raw).strip_edges()
		if not alias.is_empty() and not aliases.has(alias): aliases.append(alias)
	return {"ok":true, "registered":true, "name":display_name, "sourceProfile":source_name, "key":stable_key, "aliases":aliases, "domainId":str(manual.get("domain_id", "")), "techniquePower":power, "specialHandTags":tags.duplicate(), "displayName":display_name, "sourceData":profile.duplicate(true)}

static func _manual_entry(source_name: String, display_name: String, stable_key: String) -> Dictionary:
	for canonical: String in TECHNIQUES:
		var item: Dictionary = TECHNIQUES[canonical] as Dictionary
		var aliases: Array = item.get("aliases", []) as Array
		if canonical == source_name or canonical == display_name or str(item.get("key", "")) == stable_key:
			return item
		for raw: Variant in aliases:
			if str(raw).strip_edges() in [source_name, display_name]: return item
	return {}

static func _source_profiles() -> Dictionary:
	var file: FileAccess = FileAccess.open(SOURCE_PATH, FileAccess.READ)
	if file == null: return {}
	var parsed: Variant = JSON.parse_string(file.get_as_text())
	if not parsed is Dictionary: return {}
	return (parsed as Dictionary).get("techniqueProfiles", {}) as Dictionary

static func _source_family(name: String) -> String:
	var file: FileAccess = FileAccess.open(SOURCE_PATH, FileAccess.READ)
	if file == null: return ""
	var parsed: Variant = JSON.parse_string(file.get_as_text())
	if not parsed is Dictionary: return ""
	var profiles: Dictionary = (parsed as Dictionary).get("techniqueProfiles", {}) as Dictionary
	for profile_key: Variant in profiles:
		var raw_profile: Variant = profiles.get(profile_key, {})
		if not raw_profile is Dictionary: continue
		var profile: Dictionary = raw_profile as Dictionary
		var display_name: String = str(profile.get("displayName", "")).strip_edges()
		if name != str(profile_key).strip_edges() and name != display_name: continue
		var tags: Array = profile.get("specialHandTags", []) as Array
		for raw_tag: Variant in tags:
			var tag: String = str(raw_tag).strip_edges()
			if not tag.is_empty(): return _normalize_source_family(tag)
	return ""

static func _normalize_source_family(family: String) -> String:
	if family == "ganesh_obstacle_removal": return "ganesha_obstacle_removal"
	if family == "curse_manipulation": return "curse_spirit_manipulation"
	if family == "recontract_icon": return "contract_recreation"
	return family



