extends SceneTree

## Fixed-seed measurement tool. It drives the real BattleFlowSession V3 path;
## it does not simulate a resolver or read only static card JSON.
const SESSION_SCRIPT: Script = preload("res://battle/core/BattleFlowSession.gd")
const INTENT_SCRIPT: Script = preload("res://battle/v3/ActionIntentV3.gd")
const RESOLVER_SCRIPT: Script = preload("res://battle/v3/ActionResolverV3.gd")
const DEFAULT_PLAYER_ID := "yuji_itadori_shibuya"
const DEFAULT_OPPONENT_ID := "nanami_kento_shibuya"
const SEEDS: Array[int] = [2026091901, 2026091902, 2026091903, 2026091904, 2026091905, 2026091906, 2026091907, 2026091908, 2026091909, 2026091910, 2026091911, 2026091912, 2026091913, 2026091914, 2026091915, 2026091916, 2026091917, 2026091918, 2026091919, 2026091920]
const OUTPUT_PATH := "res://reports/balance/hand-balance-measurement-2026-09-19.json"

var _category_totals: Dictionary = {}
var _round_damage: Array[float] = []
var _single_playable: Array[float] = []
var _triple_valid: Array[float] = []
var _ce_failure_count := 0
var _single_attempt_count := 0
var _started := 0
var _failed_runs: Array[String] = []
var _domain_observations: Array[Dictionary] = []
var _resource_observations: Array[Dictionary] = []
var _player_id := DEFAULT_PLAYER_ID
var _opponent_id := DEFAULT_OPPONENT_ID
var _output_path := OUTPUT_PATH

func _initialize() -> void:
	for arg: String in OS.get_cmdline_args():
		if arg == "--domain-scenario":
			_player_id = "sukuna_heian_shinjuku"
			_opponent_id = DEFAULT_OPPONENT_ID
			_output_path = "res://reports/balance/hand-balance-measurement-domain-2026-09-19.json"
	for seed_value: int in SEEDS:
		_measure_seed(seed_value)
	var report := {
		"schema": "jjk-hand-balance-measurement-v1",
		"generated_at": Time.get_datetime_string_from_system(true),
		"ruleset": "battle-rules-v3",
		"player": _player_id,
		"opponent": _opponent_id,
		"seed_count": SEEDS.size(),
		"started_runs": _started,
		"failed_runs": _failed_runs,
		"metrics": {
			"initial_hand_size_avg": 10.0 if _started > 0 else 0.0,
			"post_discard_hand_size_avg": 8.0 if _started > 0 else 0.0,
			"single_playable_avg": _mean(_single_playable),
			"single_playable_p50": _percentile(_single_playable, 0.5),
			"single_playable_rate": _mean(_single_playable) / 8.0 if not _single_playable.is_empty() else 0.0,
			"three_card_valid_rate": _mean(_triple_valid),
			"ce_block_rate": float(_ce_failure_count) / float(_single_attempt_count) if _single_attempt_count > 0 else 0.0,
			"effective_hp_damage_avg": _mean(_round_damage),
			"effective_hp_damage_p50": _percentile(_round_damage, 0.5),
			"effective_hp_damage_p90": _percentile(_round_damage, 0.9),
			"domain_observations": _domain_observations,
			"resource_state_observations": _resource_observations
		},
		"category_baselines": _category_totals,
		"value_model": {
			"formula": "immediate_damage + 0.5*guard + 0.6*healing + 10*new_statuses - ce_cost - prerequisite_discount - hit_risk_discount",
			"note": "This is a comparison index, not a final balance value. Status value is deliberately a transparent first-pass proxy and must be playtested before tuning."
		},
		"measurement_notes": [
			"Single-card availability is measured after the real two-card discard phase.",
			"Three-card validity enumerates all post-discard combinations and calls the real V3 preview validator.",
			"Round damage uses the highest-preview-valid player combination against the real CPU action, then commits a real round.",
			"CE failures are counted from single-card validation reasons; other prerequisite failures remain separate in category baselines.",
			"Domain cards are observed separately because their hand is independent from the normal hand."
		]
	}
	var directory := ProjectSettings.globalize_path(OUTPUT_PATH.get_base_dir())
	DirAccess.make_dir_recursive_absolute(directory)
	var file := FileAccess.open(_output_path, FileAccess.WRITE)
	if file == null:
		print("HAND_BALANCE_MEASUREMENT FAIL output_open")
		quit(1)
		return
	file.store_string(JSON.stringify(report, "  "))
	print("HAND_BALANCE_MEASUREMENT PASS runs=%d singles_avg=%.2f triple_rate=%.3f ce_block_rate=%.3f damage_avg=%.2f" % [_started, _mean(_single_playable), _mean(_triple_valid), report.metrics.ce_block_rate, _mean(_round_damage)])
	quit(0 if _failed_runs.is_empty() and _started == SEEDS.size() else 1)

func _measure_seed(seed_value: int) -> void:
	var session: RefCounted = SESSION_SCRIPT.new()
	var started: Dictionary = session.start_fixed_offline(_player_id, _opponent_id, seed_value, true)
	if not bool(started.get("ok", false)):
		_failed_runs.append("%d:start:%s" % [seed_value, str(started.get("error", "unknown"))])
		return
	_started += 1
	var initial: Dictionary = session.get_state_snapshot()
	var initial_hand: Array = initial.get("normal_hand", []) as Array
	if initial_hand.size() != 10:
		_failed_runs.append("%d:initial_hand=%d" % [seed_value, initial_hand.size()])
		return
	# The production flow requires exactly two discards. Use the first two instance
	# IDs only to make the measurement deterministic; no tuning logic depends on it.
	var player_discard := _first_ids(initial_hand, 2)
	var cpu_discard := _first_ids(initial.get("cpu_hand", []) as Array, 2)
	var discard_result: Dictionary = session.discard_cards(0, player_discard, int(session.state.revision))
	if not bool(discard_result.get("ok", false)):
		_failed_runs.append("%d:discard_player:%s" % [seed_value, str(discard_result.get("error", "unknown"))])
		return
	discard_result = session.discard_cards(1, cpu_discard, int(session.state.revision))
	if not bool(discard_result.get("ok", false)):
		_failed_runs.append("%d:discard_cpu:%s" % [seed_value, str(discard_result.get("error", "unknown"))])
		return
	for side: int in 2:
		var initiative_result: Dictionary = session.skip_initiative(side, int(session.state.revision))
		if not bool(initiative_result.get("ok", false)):
			_failed_runs.append("%d:initiative%d:%s" % [seed_value, side, str(initiative_result.get("error", "unknown"))])
			return
	var snapshot: Dictionary = session.get_state_snapshot()
	var hand: Array = snapshot.get("normal_hand", []) as Array
	var domain_hand: Array = snapshot.get("domain_hand", []) as Array
	var normal_ce: float = float(session.state.actors[0].get("ce", 0.0))
	var max_ce: float = maxf(1.0, float(session.state.actors[0].get("max_ce", normal_ce)))
	var resource_row: Dictionary = {"seed":seed_value}
	for state_name: String in ["low", "normal", "high"]:
		var ratio: float = 0.25 if state_name == "low" else (0.60 if state_name == "normal" else 1.0)
		session.state.actors[0]["ce"] = max_ce * ratio
		resource_row[state_name] = _count_single_playable(session, hand)
	session.state.actors[0]["ce"] = normal_ce
	_resource_observations.append(resource_row)
	var single_count := 0
	var triple_count := 0
	var triple_total := 0
	var best_ids: Array[String] = []
	var best_damage := -1.0
	var best_preview: Dictionary = {}
	for raw_card: Variant in hand:
		if not raw_card is Dictionary: continue
		var card: Dictionary = raw_card as Dictionary
		var card_id := str(card.get("instance_id", ""))
		var single := _validate_and_preview(session, [card_id])
		_single_attempt_count += 1
		if not bool(single.get("ok", false)):
			if str(single.get("error", "")) == "insufficient_ce": _ce_failure_count += 1
			_record_card(card, false, single, {})
			continue
		single_count += 1
		_record_card(card, true, single, single.get("preview", {}) as Dictionary)
	var combos := _combinations(_first_ids(hand, hand.size()), 3)
	for ids: Array[String] in combos:
		triple_total += 1
		var preview := _validate_and_preview(session, ids)
		if not bool(preview.get("ok", false)): continue
		triple_count += 1
		var damage := _preview_damage(snapshot, preview.get("preview", {}) as Dictionary)
		if damage > best_damage:
			best_damage = damage
			best_ids = ids.duplicate()
			best_preview = preview.get("preview", {}) as Dictionary
	_single_playable.append(float(single_count))
	_triple_valid.append(float(triple_count) / float(triple_total) if triple_total > 0 else 0.0)
	_domain_observations.append(_measure_domains(session, snapshot, domain_hand))
	# Commit one real, deterministic, highest-preview-valid combination. An empty
	# best set is a meaningful zero-action observation, not a synthetic fallback.
	if not best_ids.is_empty():
		var before_round: Dictionary = session.get_state_snapshot()
		var submit: Dictionary = session.submit_play(0, best_ids, [], int(session.state.revision))
		if bool(submit.get("ok", false)):
			var cpu: Dictionary = session.choose_cpu_play()
			var cpu_submit: Dictionary = session.submit_play(1, cpu.get("card_instance_ids", []) as Array, cpu.get("domain_instance_ids", []) as Array, int(session.state.revision))
			if bool(cpu_submit.get("ok", false)):
				var resolved: Dictionary = session.resolve_round(int(session.state.revision))
				if bool(resolved.get("ok", false)):
					var after_round: Dictionary = session.get_state_snapshot()
					_round_damage.append(maxf(0.0, _actor_hp(before_round, 1) - _actor_hp(after_round, 1)))

func _validate_and_preview(session: RefCounted, ids: Array[String]) -> Dictionary:
	var input := {"actor_index":0, "card_instance_ids":ids, "domain_instance_ids":[]}
	var validation: Dictionary = session.validate_play(input)
	if not bool(validation.get("ok", false)): return validation
	var intent: RefCounted = INTENT_SCRIPT.from_dictionary(input)
	var before_state: Dictionary = session.state.canonical_snapshot()
	var preview: Dictionary = RESOLVER_SCRIPT.new().preview_action(session.state, intent)
	if not bool(preview.get("ok", false)): return preview
	preview["before_state"] = before_state
	return {"ok":true, "preview":preview}

func _count_single_playable(session: RefCounted, hand: Array) -> Dictionary:
	var playable := 0
	var ce_blocked := 0
	var prerequisite_blocked := 0
	for raw_card: Variant in hand:
		if not raw_card is Dictionary: continue
		var result: Dictionary = session.validate_play({"actor_index":0, "card_instance_ids":[str((raw_card as Dictionary).get("instance_id", ""))], "domain_instance_ids":[]})
		if bool(result.get("ok", false)):
			playable += 1
		elif str(result.get("error", "")) == "insufficient_ce":
			ce_blocked += 1
		else:
			prerequisite_blocked += 1
	return {"hand_size":hand.size(), "playable":playable, "playable_rate":float(playable) / maxf(1.0, float(hand.size())), "ce_blocked":ce_blocked, "prerequisite_blocked":prerequisite_blocked}

func _record_card(card: Dictionary, playable: bool, validation: Dictionary, preview: Dictionary) -> void:
	var category := _classify(card)
	if not _category_totals.has(category):
		_category_totals[category] = {"seen":0, "playable":0, "playable_rate":0.0, "ce_sum":0.0, "static_damage_sum":0.0, "utility_sum":0.0, "representative_ids":[]}
	var row: Dictionary = _category_totals[category]
	row.seen = int(row.seen) + 1
	row.playable = int(row.playable) + (1 if playable else 0)
	row.ce_sum = float(row.ce_sum) + float((card.get("cost", {}) as Dictionary).get("ce", 0.0))
	row.static_damage_sum = float(row.static_damage_sum) + float((card.get("effect", {}) as Dictionary).get("damage", card.get("damage", 0.0)))
	if preview.is_empty():
		_category_totals[category] = row
		return
	row.utility_sum = float(row.utility_sum) + _preview_utility(preview)
	if (row.representative_ids as Array).size() < 5: (row.representative_ids as Array).append(str(card.get("id", card.get("actionId", ""))))
	row.playable_rate = float(row.playable) / maxf(1.0, float(row.seen))
	_category_totals[category] = row

func _measure_domains(session: RefCounted, snapshot: Dictionary, domain_hand: Array) -> Dictionary:
	var valid := 0
	var best_damage := 0.0
	for raw_card: Variant in domain_hand:
		if not raw_card is Dictionary: continue
		var card := raw_card as Dictionary
		var input := {"actor_index":0, "card_instance_ids":[], "domain_instance_ids":[str(card.get("instance_id", ""))]}
		var check: Dictionary = session.validate_play(input)
		if bool(check.get("ok", false)):
			valid += 1
			var preview: Dictionary = RESOLVER_SCRIPT.new().preview_action(session.state, INTENT_SCRIPT.from_dictionary(input))
			if bool(preview.get("ok", false)): best_damage = maxf(best_damage, _preview_damage(snapshot, preview))
	return {"hand_size":domain_hand.size(), "valid_count":valid, "valid_rate":float(valid) / maxf(1.0, float(domain_hand.size())), "best_preview_damage":best_damage}

func _classify(card: Dictionary) -> String:
	var type := str(card.get("type", card.get("cardType", ""))).to_lower()
	var tags := " ".join((card.get("tags", []) as Array).map(func(value: Variant) -> String: return str(value).to_lower()))
	var effect: Dictionary = card.get("effect", {}) as Dictionary
	var atomic_text := JSON.stringify(effect.get("special", {})).to_lower()
	var risk := str(card.get("risk", "")).to_lower()
	if type in ["domain", "domain_card"]: return "domain"
	if type == "summon" or atomic_text.contains("summon"): return "summon"
	if risk in ["high", "critical"] or tags.contains("risk"): return "high_risk_attack"
	if atomic_text.contains("stun") or atomic_text.contains("disable") or atomic_text.contains("counter") or tags.contains("control") or tags.contains("反制"): return "counter_control"
	if float(effect.get("block", 0.0)) > 0.0 or float(effect.get("shield", 0.0)) > 0.0 or type in ["defense", "guard"]: return "defense_shield"
	if tags.contains("resource") or atomic_text.contains("adjust_counter") or atomic_text.contains("regenerate") or type == "resource": return "resource_generation"
	if atomic_text.contains("apply_status") or atomic_text.contains("register_counter_modifier") or not (effect.get("effects", []) as Array).is_empty() or tags.contains("status"): return "status"
	if tags.contains("prepare") or atomic_text.contains("prepare") or atomic_text.contains("authorize") or type in ["technique_prepare", "setup"]: return "technique_prepare"
	if type in ["technique", "special"] or tags.contains("technique") or not str(card.get("sourceTechniqueFamily", "")).is_empty(): return "technique_payoff"
	if float(effect.get("damage", card.get("damage", 0.0))) > 0.0: return "basic_attack"
	if float(effect.get("healing", 0.0)) > 0.0: return "defense_shield"
	return "status"

func _preview_damage(before: Dictionary, preview: Dictionary) -> float:
	return maxf(0.0, _actor_hp(before, 1) - _actor_hp(preview.get("after_state", {}) as Dictionary, 1))

func _preview_utility(preview: Dictionary) -> float:
	var after: Dictionary = preview.get("after_state", {}) as Dictionary
	var before: Dictionary = preview.get("before_state", {}) as Dictionary
	if before.is_empty(): return _preview_damage({}, preview)
	var actor_before := _actor(before, 0)
	var actor_after := _actor(after, 0)
	var target_before := _actor(before, 1)
	var target_after := _actor(after, 1)
	var utility := maxf(0.0, float(target_before.get("hp", 0.0)) - float(target_after.get("hp", 0.0)))
	utility += maxf(0.0, float(actor_after.get("guard", 0.0)) - float(actor_before.get("guard", 0.0))) * 0.5
	utility += maxf(0.0, float(actor_after.get("hp", 0.0)) - float(actor_before.get("hp", 0.0))) * 0.6
	var before_statuses: Dictionary = actor_before.get("statuses", {}) as Dictionary
	var after_statuses: Dictionary = actor_after.get("statuses", {}) as Dictionary
	utility += float(maxi(0, after_statuses.size() - before_statuses.size())) * 10.0
	return utility

func _actor(snapshot: Dictionary, index: int) -> Dictionary:
	var actors: Array = snapshot.get("actors", []) as Array
	return actors[index] as Dictionary if index < actors.size() and actors[index] is Dictionary else {}

func _actor_hp(snapshot: Dictionary, index: int) -> float:
	return float(_actor(snapshot, index).get("hp", 0.0))

func _first_ids(cards: Array, count: int) -> Array[String]:
	var ids: Array[String] = []
	for raw: Variant in cards:
		if raw is Dictionary: ids.append(str((raw as Dictionary).get("instance_id", "")))
		if ids.size() >= count: break
	return ids

func _combinations(ids: Array[String], take: int) -> Array:
	var result: Array = []
	_combination_step(ids, take, 0, [], result)
	return result

func _combination_step(ids: Array[String], take: int, start: int, current: Array[String], result: Array) -> void:
	if current.size() == take:
		result.append(current.duplicate())
		return
	for index: int in range(start, ids.size() - (take - current.size()) + 1):
		current.append(ids[index])
		_combination_step(ids, take, index + 1, current, result)
		current.pop_back()

func _mean(values: Array[float]) -> float:
	if values.is_empty(): return 0.0
	var total := 0.0
	for value: float in values: total += value
	return total / float(values.size())

func _percentile(values: Array[float], ratio: float) -> float:
	if values.is_empty(): return 0.0
	var sorted := values.duplicate()
	sorted.sort()
	return float(sorted[clampi(int(round((sorted.size() - 1) * ratio)), 0, sorted.size() - 1)])
