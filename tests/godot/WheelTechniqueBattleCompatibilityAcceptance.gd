extends SceneTree

const REGISTRY_SCRIPT: Script = preload("res://scenes/wheel/WheelTechniqueRegistry.gd")
const PROJECTOR_SCRIPT: Script = preload("res://account/LoginCardCharacterProjector.gd")
const CANDIDATE_SCRIPT: Script = preload("res://battle/data/CardCandidateBuilder.gd")
const DATA_SCRIPT: Script = preload("res://battle/data/BattleDataRepository.gd")
const SOURCE_PATH: String = "res://data/wheel/source/strength-v0.2-candidate.json"

func _initialize() -> void:
	call_deferred("_run")

func _run() -> void:
	var file: FileAccess = FileAccess.open(SOURCE_PATH, FileAccess.READ)
	var parsed: Variant = JSON.parse_string(file.get_as_text()) if file != null else null
	var profiles: Dictionary = (parsed as Dictionary).get("techniqueProfiles", {}) as Dictionary if parsed is Dictionary else {}
	var failures: Array[String] = []
	var unbacked: Array[String] = []
	var gated: Array[String] = []
	var repository: RefCounted = DATA_SCRIPT.new()
	var candidates: RefCounted = CANDIDATE_SCRIPT.new()
	var authored_families: Dictionary = {}
	for raw_card: Variant in repository.cards():
		if not raw_card is Dictionary: continue
		for raw_tag: Variant in (raw_card as Dictionary).get("matchTags", []) as Array:
			authored_families[str(raw_tag)] = true
	for property: Variant in profiles:
		var source_name: String = str(property)
		var source: Dictionary = profiles.get(source_name, {}) as Dictionary
		var display_name: String = str(source.get("displayName", source_name))
		var resolved: Dictionary = REGISTRY_SCRIPT.resolve(source_name)
		if not bool(resolved.get("ok", false)): resolved = REGISTRY_SCRIPT.resolve(display_name)
		if not bool(resolved.get("ok", false)):
			failures.append("%s:unresolved" % source_name)
			continue
		var family: String = str(resolved.get("key", ""))
		var snapshot: Dictionary = {
			"schema":"generated-character-v2", "characterId":"wheel_compat_%s" % family,
			"displayName":"轮盘兼容验收·%s" % display_name,
			"stats":{"cursedEnergy":"B", "control":"B", "efficiency":"B", "body":"B", "martial":"B", "talent":"B"},
			"techniques":[{"id":family, "name":display_name}], "techniqueFamilies":[family],
			"cardTags":[family], "specialHandTags":[family], "techniquePower":"B"
		}
		var profile: Dictionary = PROJECTOR_SCRIPT.project(snapshot)
		if not bool(profile.get("snapshot_valid", false)):
			failures.append("%s:project:%s" % [source_name, str(profile.get("snapshot_errors", []))])
			continue
		var eligible: Array[Dictionary] = candidates.eligible(profile, "normal")
		if authored_families.has(family):
			var matched: int = 0
			for card: Dictionary in eligible:
				if (card.get("matchTags", []) as Array).has(family): matched += 1
			if matched == 0:
				var report: Dictionary = candidates.filter_report(profile, "normal")
				var reasons: Array[String] = []
				var hard_mismatch: bool = false
				for raw_card: Variant in repository.cards():
					if raw_card is Dictionary and ((raw_card as Dictionary).get("matchTags", []) as Array).has(family):
						var reason: String = str((report.get("filtered_reasons", {}) as Dictionary).get(str((raw_card as Dictionary).get("id", "")), "not-listed"))
						reasons.append("%s=%s" % [str((raw_card as Dictionary).get("id", "")), reason])
						if reason in ["technique_family_mismatch", "match_tag_mismatch", "unowned_special_hand"]: hard_mismatch = true
				if hard_mismatch: failures.append("%s:no_cards_for_%s[%s]" % [source_name, family, ",".join(reasons)])
				else: gated.append("%s=%s" % [source_name, ",".join(reasons)])
		else:
			unbacked.append("%s=%s" % [source_name, family])
	var passed: bool = failures.is_empty()
	print("WHEEL_TECHNIQUE_BATTLE_COMPATIBILITY %s profiles=%d unbacked=%s gated=%s failures=%s" % ["PASS" if passed else "FAIL", profiles.size(), ",".join(unbacked), ";".join(gated), ";".join(failures)])
	quit(0 if passed else 1)
