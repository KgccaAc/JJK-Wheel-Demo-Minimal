extends SceneTree

func _initialize() -> void:
	var path := "res://reports/balance/technique-audit-measurement-2026-09-19.json"
	if not FileAccess.file_exists(path):
		print("TECHNIQUE_AUDIT_MEASUREMENT FAIL missing_output")
		quit(1)
		return
	var parsed = JSON.parse_string(FileAccess.get_file_as_string(path))
	var failures: Array[String] = []
	if not parsed is Dictionary:
		failures.append("invalid_json")
	else:
		var report: Dictionary = parsed as Dictionary
		var rows: Array = report.get("rows", []) as Array
		if rows.is_empty(): failures.append("no_rows")
		for row: Variant in rows:
			if not row is Dictionary: failures.append("non_dictionary_row"); continue
			var item: Dictionary = row as Dictionary
			for key: String in ["seed", "familyKey", "cardId", "ceBand", "roundsObserved", "resolvedCost", "requirementsChecked", "hit", "summonBeforeState", "summonAfterState", "traceSummary", "failureReason"]:
				if not item.has(key): failures.append("missing_%s" % key)
		if int(report.get("coverage", {}).get("measuredCardCount", 0)) <= 0: failures.append("no_measured_cards")
		if not report.has("missingSamples"): failures.append("missing_samples_section")
	var status := "TECHNIQUE_AUDIT_MEASUREMENT %s rows=%d failures=%d" % ["PASS" if failures.is_empty() else "FAIL", (parsed.get("rows", []) as Array).size() if parsed is Dictionary else 0, failures.size()]
	print(status)
	quit(0 if failures.is_empty() else 1)
