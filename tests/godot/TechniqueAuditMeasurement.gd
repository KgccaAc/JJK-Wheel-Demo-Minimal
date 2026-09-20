extends SceneTree

const SESSION_SCRIPT: Script = preload("res://battle/core/BattleFlowSession.gd")
const ELIGIBILITY_SCRIPT: Script = preload("res://battle/data/BattleEligibility.gd")
const RESOURCES_SCRIPT: Script = preload("res://battle/data/CharacterResources.gd")
const SEEDS: Array[int] = [2026091901, 2026091902, 2026091903]
const OBSERVATION_ROUNDS := 3
const INVENTORY_PATH := "res://reports/balance/technique-audit-inventory-2026-09-19.json"
const OUTPUT_PATH := "res://reports/balance/technique-audit-measurement-2026-09-19.json"
const OPPONENT_ID := "nanami_kento_shibuya"

var _rows: Array[Dictionary] = []
var _missing: Array[Dictionary] = []
var _inventory: Dictionary = {}
var _character_cache: Dictionary = {}
var _max_cards := 0
var _attempted_card_count := 0

func _initialize() -> void:
	for arg: String in OS.get_cmdline_args():
		if arg.begins_with("--limit="): _max_cards = maxi(0, int(arg.trim_prefix("--limit=")))
	var parsed = JSON.parse_string(FileAccess.get_file_as_string(INVENTORY_PATH))
	if not parsed is Dictionary:
		print("TECHNIQUE_AUDIT_MEASUREMENT FAIL inventory_json")
		quit(1)
		return
	_inventory = parsed as Dictionary
	var processed := 0
	for card_value: Variant in _inventory.get("cards", []) as Array:
		if not card_value is Dictionary: continue
		var card: Dictionary = card_value as Dictionary
		var family_keys: Array = card.get("familyKeys", []) as Array
		if _max_cards > 0 and processed >= _max_cards: break
		processed += 1
		_attempted_card_count += 1
		if family_keys.is_empty():
			_append_missing_card_rows(card, "unmapped_card_no_family")
			print("TECHNIQUE_CARD_DONE %s rows=%d" % [str(card.get("id", "")), _rows.size()])
			continue
		var character_id := _character_for_card(card, family_keys)
		if character_id.is_empty():
			_append_missing_card_rows(card, "no_eligible_character_for_family")
			print("TECHNIQUE_CARD_DONE %s rows=%d" % [str(card.get("id", "")), _rows.size()])
			continue
		for seed_value: int in SEEDS:
			for band: String in ["low", "normal", "high"]:
				_measure_card(card, character_id, seed_value, band)
		print("TECHNIQUE_CARD_DONE %s rows=%d" % [str(card.get("id", "")), _rows.size()])
	var report := {
		"schema":"jjk-technique-audit-measurement-v1",
		"generatedAt":Time.get_datetime_string_from_system(true),
		"ruleset":"battle-rules-v3",
		"seedSet":SEEDS,
		"rows":_rows,
		"missingSamples":_missing,
		"coverage":{
			"inventoryCardCount":(_inventory.get("cards", []) as Array).size(),
			"techniqueCardCount":_inventory.get("cards", []).filter(func(item: Variant) -> bool: return item is Dictionary and not (item as Dictionary).get("familyKeys", []).is_empty()).size(),
			"attemptedCardCount":_attempted_card_count,
			"measuredCardCount":_measured_card_count(),
			"missingCardCount":_missing.size()
		}
	}
	var directory := ProjectSettings.globalize_path(OUTPUT_PATH.get_base_dir())
	DirAccess.make_dir_recursive_absolute(directory)
	var file := FileAccess.open(OUTPUT_PATH, FileAccess.WRITE)
	if file == null:
		print("TECHNIQUE_AUDIT_MEASUREMENT FAIL output_open")
		quit(1)
		return
	file.store_string(JSON.stringify(report, "  "))
	print("TECHNIQUE_AUDIT_MEASUREMENT PASS rows=%d cards=%d missing=%d" % [_rows.size(), _measured_card_count(), _missing.size()])
	quit(0)

func _append_missing_card_rows(card: Dictionary, reason: String) -> void:
	var card_id := str(card.get("id", ""))
	var family_keys: Array = card.get("familyKeys", []) as Array
	var family_key := str(family_keys[0]) if not family_keys.is_empty() else ""
	_missing.append({"cardId":card_id, "reason":reason})
	for seed_value: int in SEEDS:
		for band: String in ["low", "normal", "high"]:
			_rows.append({
				"seed":seed_value, "familyKey":family_key, "cardId":card_id, "characterId":"",
				"ceBand":band, "roundsObserved":0, "resolvedCost":{}, "requirementsChecked":false, "hit":null,
				"damage":0.0, "healing":0.0, "block":0.0, "shield":0.0, "statusDelta":0, "summonDelta":0, "domain":{},
				"summonBeforeState":{}, "summonAfterState":{}, "traceSummary":{}, "roundSummaries":[],
				"measurementWindow":{"requestedRounds":OBSERVATION_ROUNDS, "completedRounds":0, "earlyFinish":false}, "failureReason":reason
			})

func _measure_card(card: Dictionary, character_id: String, seed_value: int, band: String) -> void:
	var row: Dictionary = {
		"seed":seed_value, "familyKey":str((card.get("familyKeys", []) as Array)[0]), "cardId":str(card.get("id", "")), "characterId":character_id,
		"ceBand":band, "roundsObserved":0, "resolvedCost":{}, "requirementsChecked":false, "hit":null,
		"damage":0.0, "healing":0.0, "block":0.0, "shield":0.0, "statusDelta":0, "summonDelta":0, "domain":{},
		"summonBeforeState":{}, "summonAfterState":{}, "traceSummary":{}, "roundSummaries":[],
		"measurementWindow":{"requestedRounds":OBSERVATION_ROUNDS, "completedRounds":0, "earlyFinish":false}, "failureReason":""
	}
	var session := _start_session(card, character_id, seed_value)
	if session == null:
		row.failureReason = "session_start_failed"
		_rows.append(row)
		return
	var snapshot: Dictionary = session.get_state_snapshot()
	var max_ce := maxf(1.0, float(_actor(snapshot, 0).get("max_ce", 0.0)))
	var ratio := 0.25 if band == "low" else (0.60 if band == "normal" else 1.0)
	session.state.actors[0]["ce"] = max_ce * ratio
	var first_before: Dictionary = {}
	var final_after: Dictionary = {}
	var aggregate_trace := {"tools":[], "summonTargetHits":0, "summonAppliedDamage":0.0, "summonSpawnEvents":0}
	for round_index: int in OBSERVATION_ROUNDS:
		if session.state.finished:
			row.measurementWindow.earlyFinish = true
			break
		if round_index > 0:
			var prepared := _prepare_next_round(session)
			if not bool(prepared.get("ok", false)):
				row.failureReason = "round_%d_%s" % [round_index + 1, str(prepared.get("error", "prepare_failed"))]
				break
		var before: Dictionary = session.get_state_snapshot()
		if round_index == 0: first_before = before.duplicate(true)
		var input: Dictionary = _choose_measurement_input(session, str(card.get("id", "")), round_index == 0)
		var validation: Dictionary = session.validate_play(input)
		row.requirementsChecked = true
		if round_index == 0: row.resolvedCost = validation.get("resolved_cost", validation.get("cost", {}))
		if not bool(validation.get("ok", false)):
			row.failureReason = str(validation.get("error", "validation_failed")) if round_index == 0 else "round_%d_%s" % [round_index + 1, str(validation.get("error", "validation_failed"))]
			break
		var submit: Dictionary = session.submit_play(0, input.card_instance_ids as Array, input.domain_instance_ids as Array, int(session.state.revision))
		if not bool(submit.get("ok", false)):
			row.failureReason = str(submit.get("error", "submit_failed"))
			break
		var cpu: Dictionary = session.choose_cpu_play()
		var cpu_submit: Dictionary = session.submit_play(1, cpu.get("card_instance_ids", []) as Array, cpu.get("domain_instance_ids", []) as Array, int(session.state.revision))
		if not bool(cpu_submit.get("ok", false)):
			row.failureReason = str(cpu_submit.get("error", "cpu_submit_failed"))
			break
		var resolved: Dictionary = session.resolve_round(int(session.state.revision))
		if not bool(resolved.get("ok", false)):
			row.failureReason = str(resolved.get("error", "resolve_failed"))
			break
		var after: Dictionary = session.get_state_snapshot()
		var round_summary := _round_summary(round_index + 1, before, after, resolved.get("round_package", {}))
		row.roundSummaries.append(round_summary)
		row.damage += float(round_summary.get("damage", 0.0))
		row.healing += float(round_summary.get("healing", 0.0))
		row.block += float(round_summary.get("block", 0.0))
		row.shield += float(round_summary.get("shield", 0.0))
		row.statusDelta += int(round_summary.get("statusDelta", 0))
		row.summonDelta += int((round_summary.get("traceSummary", {}) as Dictionary).get("summonSpawnEvents", 0))
		_merge_trace_summary(aggregate_trace, round_summary.get("traceSummary", {}) as Dictionary)
		row.roundsObserved = row.roundSummaries.size()
		row.measurementWindow.completedRounds = row.roundsObserved
		final_after = after.duplicate(true)
		row.hit = true
		if session.state.finished:
			row.measurementWindow.earlyFinish = true
			break
	if row.roundsObserved > 0:
		row.summonBeforeState = _summon_state_summary(_actor(first_before, 0))
		row.summonAfterState = _summon_state_summary(_actor(final_after, 0))
		row.traceSummary = aggregate_trace
		row.domain = _actor(final_after, 0).get("domain_state", {})
	if row.failureReason.is_empty() and row.roundsObserved < OBSERVATION_ROUNDS:
		row.failureReason = "observation_window_incomplete"
	_rows.append(row)

func _prepare_next_round(session: RefCounted) -> Dictionary:
	if session.get_phase() != &"DEAL": return {"ok":false, "error":"phase_%s" % str(session.get_phase())}
	var dealt: Dictionary = session.deal_round(int(session.state.revision))
	if not bool(dealt.get("ok", false)): return dealt
	var snapshot: Dictionary = session.get_state_snapshot()
	var player_discard := _discard_two(snapshot.get("normal_hand", []) as Array, "")
	var cpu_discard := _discard_two(snapshot.get("cpu_hand", []) as Array, "")
	if player_discard.size() < 2 or cpu_discard.size() < 2: return {"ok":false, "error":"discard_cards_missing"}
	var discarded: Dictionary = session.discard_cards(0, player_discard, int(session.state.revision))
	if not bool(discarded.get("ok", false)): return discarded
	discarded = session.discard_cards(1, cpu_discard, int(session.state.revision))
	if not bool(discarded.get("ok", false)): return discarded
	for side: int in 2:
		var initiative: Dictionary = session.skip_initiative(side, int(session.state.revision))
		if not bool(initiative.get("ok", false)): return initiative
	return {"ok":true}

func _choose_measurement_input(session: RefCounted, target_id: String, force_target: bool) -> Dictionary:
	var snapshot: Dictionary = session.get_state_snapshot()
	if force_target:
		var hand := _find_id(snapshot.get("normal_hand", []) as Array, target_id)
		var domain_card := _find_domain_id(snapshot.get("domain_hand", []) as Array, target_id)
		if not hand.is_empty(): return {"actor_index":0, "card_instance_ids":[str(hand.get("instance_id", ""))], "domain_instance_ids":[]}
		if not domain_card.is_empty(): return {"actor_index":0, "card_instance_ids":[], "domain_instance_ids":[str(domain_card.get("instance_id", ""))]}
		return {"actor_index":0, "card_instance_ids":[], "domain_instance_ids":[]}
	var best := {"actor_index":0, "card_instance_ids":[], "domain_instance_ids":[]}
	var best_score := -INF
	for raw: Variant in snapshot.get("normal_hand", []) as Array:
		if not raw is Dictionary: continue
		var card: Dictionary = raw as Dictionary
		if str(card.get("id", "")) == target_id: continue
		var candidate := {"actor_index":0, "card_instance_ids":[str(card.get("instance_id", ""))], "domain_instance_ids":[]}
		var validation: Dictionary = session.validate_play(candidate)
		if bool(validation.get("ok", false)):
			var score := float((card.get("effect", {}) as Dictionary).get("damage", 0.0)) + float((card.get("effect", {}) as Dictionary).get("block", 0.0)) * 0.5 + float((card.get("effect", {}) as Dictionary).get("healing", 0.0)) * 0.6
			if score > best_score: best = candidate; best_score = score
	if best_score > -INF: return best
	return best

func _round_summary(round_number: int, before: Dictionary, after: Dictionary, package: Dictionary) -> Dictionary:
	return {
		"round":round_number,
		"damage":maxf(0.0, float(_actor(before, 1).get("hp", 0.0)) - float(_actor(after, 1).get("hp", 0.0))),
		"healing":maxf(0.0, float(_actor(after, 0).get("hp", 0.0)) - float(_actor(before, 0).get("hp", 0.0))),
		"block":maxf(0.0, float(_actor(after, 0).get("guard", 0.0)) - float(_actor(before, 0).get("guard", 0.0))),
		"shield":maxf(0.0, float(_actor(after, 0).get("shield", 0.0)) - float(_actor(before, 0).get("shield", 0.0))),
		"statusDelta":_dict_delta(_actor(before, 0).get("statuses", {}), _actor(after, 0).get("statuses", {})) + _dict_delta(_actor(before, 1).get("statuses", {}), _actor(after, 1).get("statuses", {})),
		"summonBeforeState":_summon_state_summary(_actor(before, 0)),
		"summonAfterState":_summon_state_summary(_actor(after, 0)),
		"traceSummary":_trace_summary(package),
		"domain":_actor(after, 0).get("domain_state", {})
	}

func _merge_trace_summary(target: Dictionary, source: Dictionary) -> void:
	for tool: Variant in source.get("tools", []) as Array:
		if not target.tools.has(tool): target.tools.append(tool)
	target.summonTargetHits += int(source.get("summonTargetHits", 0))
	target.summonAppliedDamage += float(source.get("summonAppliedDamage", 0.0))
	target.summonSpawnEvents += int(source.get("summonSpawnEvents", 0))

func _start_session(card: Dictionary, character_id: String, seed_value: int) -> RefCounted:
	var eligibility: RefCounted = ELIGIBILITY_SCRIPT.new()
	var player_profile: Dictionary = eligibility.build_profile(character_id)
	var opponent_profile: Dictionary = eligibility.build_profile(OPPONENT_ID)
	if player_profile.is_empty() or opponent_profile.is_empty(): return null
	var player_resources: Dictionary = RESOURCES_SCRIPT.new().apply(player_profile)
	var opponent_resources: Dictionary = RESOURCES_SCRIPT.new().apply(opponent_profile)
	var player_normal: Array[Dictionary] = _typed(eligibility.eligible_cards(player_profile, "normal"))
	var opponent_normal: Array[Dictionary] = _typed(eligibility.eligible_cards(opponent_profile, "normal"))
	var player_domain: Array[Dictionary] = _typed(eligibility.eligible_cards(player_profile, "domain"))
	var opponent_domain: Array[Dictionary] = _typed(eligibility.eligible_cards(opponent_profile, "domain"))
	var target_id := str(card.get("id", ""))
	var target_is_domain := str(card.get("type", "")).to_lower() in ["domain", "domain_card"] or not (card.get("domain", {}) as Dictionary).get("id", null) == null
	var target := _eligible_by_id(eligibility.eligible_cards(player_profile, "domain" if target_is_domain else "normal"), target_id)
	if target.is_empty(): return null
	target["guaranteedPerTurn"] = true
	if target_is_domain: player_domain.append(target)
	else: player_normal.append(target)
	var session: RefCounted = SESSION_SCRIPT.new()
	var profiles: Array[Dictionary] = [player_resources, opponent_resources]
	var empty_pool: Array[Dictionary] = []
	var started: Dictionary = session.start_battle_with_pools(profiles, player_normal, opponent_normal, empty_pool, empty_pool, player_domain, opponent_domain, seed_value)
	if not bool(started.get("ok", false)): return null
	if not bool(session.choose_strategy(0, &"default", int(session.state.revision)).get("ok", false)): return null
	if not bool(session.choose_strategy(1, &"default", int(session.state.revision)).get("ok", false)): return null
	if not bool(session.confirm_strategies(int(session.state.revision)).get("ok", false)): return null
	if not bool(session.deal_round(int(session.state.revision)).get("ok", false)): return null
	var snapshot: Dictionary = session.get_state_snapshot()
	var player_discard := _discard_two(snapshot.get("normal_hand", []) as Array, target_id)
	var cpu_discard := _discard_two(snapshot.get("cpu_hand", []) as Array, "")
	if player_discard.size() < 2 or cpu_discard.size() < 2: return null
	if not bool(session.discard_cards(0, player_discard, int(session.state.revision)).get("ok", false)): return null
	if not bool(session.discard_cards(1, cpu_discard, int(session.state.revision)).get("ok", false)): return null
	for side: int in 2:
		if not bool(session.skip_initiative(side, int(session.state.revision)).get("ok", false)): return null
	return session

func _character_for_card(card: Dictionary, family_keys: Array) -> String:
	for character: Variant in _inventory.get("characters", []) as Array:
		if not character is Dictionary: continue
		var row := character as Dictionary
		for key: Variant in family_keys:
			if (row.get("familyKeys", []) as Array).has(key) and not _eligible_card_for_character(str(row.get("id", "")), str(card.get("id", ""))).is_empty(): return str(row.get("id", ""))
	return ""

func _eligible_card_for_character(character_id: String, card_id: String) -> Dictionary:
	var cache_key := character_id + "::" + card_id
	if _character_cache.has(cache_key): return _character_cache[cache_key] as Dictionary
	var eligibility: RefCounted = ELIGIBILITY_SCRIPT.new()
	var profile: Dictionary = eligibility.build_profile(character_id)
	if profile.is_empty(): _character_cache[cache_key] = {}; return {}
	for context: String in ["normal", "domain"]:
		for card: Dictionary in eligibility.eligible_cards(profile, context):
			if str(card.get("id", "")) == card_id:
				_character_cache[cache_key] = card
				return card
	_character_cache[cache_key] = {}
	return {}

func _eligible_by_id(cards: Array[Dictionary], wanted_id: String) -> Dictionary:
	for card: Dictionary in cards:
		if str(card.get("id", "")) == wanted_id: return card.duplicate(true)
	return {}

func _find_id(cards: Array, wanted_id: String) -> Dictionary:
	for raw: Variant in cards:
		if raw is Dictionary and str((raw as Dictionary).get("id", "")) == wanted_id: return raw as Dictionary
	return {}

func _find_domain_id(cards: Array, wanted_id: String) -> Dictionary:
	return _find_id(cards, wanted_id)

func _discard_two(cards: Array, protected_id: String) -> Array[String]:
	var result: Array[String] = []
	for raw: Variant in cards:
		if not raw is Dictionary: continue
		var card := raw as Dictionary
		if str(card.get("id", "")) == protected_id: continue
		result.append(str(card.get("instance_id", "")))
		if result.size() == 2: break
	return result

func _typed(cards: Array[Dictionary]) -> Array[Dictionary]:
	var result: Array[Dictionary] = []
	for card: Dictionary in cards: result.append(card.duplicate(true))
	return result

func _actor(snapshot: Dictionary, index: int) -> Dictionary:
	var actors: Array = snapshot.get("actors", []) as Array
	return actors[index] as Dictionary if index < actors.size() and actors[index] is Dictionary else {}

func _summon_state_summary(actor: Dictionary) -> Dictionary:
	var units: Array[Dictionary] = []
	var total_hp := 0.0
	for raw: Variant in actor.get("summons", []) as Array:
		if not raw is Dictionary: continue
		var summon: Dictionary = raw as Dictionary
		var hp := float(summon.get("hp", 0.0))
		total_hp += hp
		units.append({
			"id":str(summon.get("id", "")),
			"hp":hp,
			"maxHp":float(summon.get("max_hp", summon.get("maxHp", 0.0))),
			"damage":float(summon.get("damage", summon.get("attack", 0.0))),
			"defense":float(summon.get("defense", summon.get("block", 0.0))),
			"damageReductionRatio":float(summon.get("damageReductionRatio", 0.0)),
			"guardRules":summon.get("guardRules", {})
		})
	return {"count":units.size(), "totalHp":total_hp, "units":units}

func _trace_summary(round_package: Dictionary) -> Dictionary:
	var tools: Array[String] = []
	var summon_target_hits := 0
	var summon_applied_damage := 0.0
	var summon_spawn_events := 0
	for raw: Variant in round_package.get("modifier_trace", []) as Array:
		if not raw is Dictionary: continue
		var item: Dictionary = raw as Dictionary
		var tool := str(item.get("tool", item.get("stage", "")))
		if not tool.is_empty() and not tools.has(tool): tools.append(tool)
		if str(item.get("target_kind", "")) == "summon":
			summon_target_hits += 1
			summon_applied_damage += maxf(0.0, float(item.get("applied_hp_damage", 0.0)))
		if tool == "summon_unit": summon_spawn_events += 1
	return {"tools":tools, "summonTargetHits":summon_target_hits, "summonAppliedDamage":summon_applied_damage, "summonSpawnEvents":summon_spawn_events}

func _dict_delta(before_value: Variant, after_value: Variant) -> int:
	var before := before_value as Dictionary if before_value is Dictionary else {}
	var after := after_value as Dictionary if after_value is Dictionary else {}
	var changed := 0
	for key: Variant in after.keys():
		if not before.has(key) or str(before.get(key)) != str(after.get(key)): changed += 1
	return changed

func _array_delta(before_value: Variant, after_value: Variant) -> int:
	var before := before_value as Array if before_value is Array else []
	var after := after_value as Array if after_value is Array else []
	return maxi(0, after.size() - before.size())

func _measured_card_count() -> int:
	var ids := {}
	for row: Dictionary in _rows:
		if str(row.get("failureReason", "")) == "": ids[str(row.get("cardId", ""))] = true
	return ids.size()
