class_name WheelTechniqueRegistry
extends RefCounted

## Stable references used by generated wheel characters. The wheel stores a
## builtin technique key; cards and domain rules remain owned by battle data.
const TECHNIQUES: Dictionary = {
	"赤血操术": {"key":"blood_manipulation", "aliases":["赤血操术", "赤血操术 —— 加茂", "blood_manipulation"], "domain_id":"", "power":"B"},
	"无下限": {"key":"limitless", "aliases":["无下限", "无下限术式", "limitless", "infinity"], "domain_id":"gojo_unlimited_void", "power":"A"},
	"十种影法术": {"key":"ten_shadows", "aliases":["十种影法术", "十种影", "十影", "ten_shadows"], "domain_id":"megumi_chimera_shadow_garden", "power":"A"}
	,"咒灵操术": {"key":"curse_manipulation", "aliases":["咒灵操术", "curse_manipulation"], "domain_id":"", "power":"B"}
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
	for canonical: String in TECHNIQUES:
		var item: Dictionary = TECHNIQUES[canonical] as Dictionary
		for alias: Variant in item.get("aliases", []) as Array:
			if normalized == str(alias).strip_edges():
				return {"ok":true, "name":canonical, "key":str(item.get("key", "")), "domainId":str(item.get("domain_id", "")), "techniquePower":str(item.get("power", "B"))}
	return {"ok":false, "error":"unknown_builtin_technique:%s" % normalized, "name":normalized, "key":"", "domainId":"", "techniquePower":"B"}



