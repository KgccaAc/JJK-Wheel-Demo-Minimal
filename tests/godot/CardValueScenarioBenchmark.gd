extends SceneTree

## Paired value probes. These scenarios intentionally measure player-facing
## outcomes through BattleFlowSession instead of reading card fields directly.
const SESSION_SCRIPT: Script = preload("res://battle/core/BattleFlowSession.gd")
const ELIGIBILITY_SCRIPT: Script = preload("res://battle/data/BattleEligibility.gd")
const RESOURCES_SCRIPT: Script = preload("res://battle/data/CharacterResources.gd")
const CANDIDATE_BUILDER_SCRIPT: Script = preload("res://battle/data/CardCandidateBuilder.gd")
const SEEDS: Array[int] = [2026092101, 2026092102, 2026092103, 2026092104, 2026092105]
const OUTPUT_PATH := "res://reports/balance/card-value-scenarios-2026-09-19.json"
const PLAYER_ID := "shoko_ieiri_support_candidate"
const OPPONENT_ID := "nanami_kento_shibuya"
const DEFENSE_ID := "card_shoko_battlefield_first_aid"
const HEALING_ID := "card_shoko_stable_treatment"
const OPPONENT_ATTACK_ID := "card_basic_cursed_energy_strike"
const STATUS_ID := "card_spatial_blue_resource"
const TECHNIQUE_ID := "card_spatial_red_reversal"

var _failures: Array[String] = []
var _missing: Dictionary = {"defense_pair": 0, "healing_pair": 0, "status_pair": 0, "technique_pair": 0, "domain_window": 0}
var _rows: Dictionary = {"defense_pair": [], "healing_pair": [], "status_pair": [], "technique_pair": [], "domain_window": []}

func _initialize() -> void:
	for seed_value: int in SEEDS:
		print("SCENARIO_SEED %d defense" % seed_value)
		_measure_defense(seed_value)
		print("SCENARIO_SEED %d healing" % seed_value)
		_measure_healing(seed_value)
		_measure_status(seed_value)
		_measure_technique(seed_value)
		_measure_domain(seed_value)
	var report := {
		"schema": "jjk-card-value-scenarios-v1",
		"generated_at": Time.get_datetime_string_from_system(true),
		"player": PLAYER_ID,
		"opponent": OPPONENT_ID,
		"seed_count": SEEDS.size(),
		"rows": _rows,
		"summary": _summary(),
		"missing_observations": _missing,
		"failures": _failures
	}
	var output_dir := ProjectSettings.globalize_path(OUTPUT_PATH.get_base_dir())
	DirAccess.make_dir_recursive_absolute(output_dir)
	var file := FileAccess.open(OUTPUT_PATH, FileAccess.WRITE)
	if file == null:
		print("CARD_VALUE_SCENARIO_BENCHMARK FAIL output_open")
		quit(1)
		return
	file.store_string(JSON.stringify(report, "  "))
	print("CARD_VALUE_SCENARIO_BENCHMARK %s seeds=%d failures=%d" % ["PASS" if _failures.is_empty() else "FAIL", SEEDS.size(), _failures.size()])
	quit(0 if _failures.is_empty() else 1)

func _measure_defense(seed_value: int) -> void:
	var guarded := _start_ready(seed_value, [DEFENSE_ID])
	var baseline := _start_ready(seed_value, [])
	if guarded == null or baseline == null:
		_failures.append("defense_setup:%d" % seed_value)
		return
	var guarded_card := _find_id(guarded.get_state_snapshot().get("normal_hand", []) as Array, DEFENSE_ID)
	var attack_guarded := _pick_attack(guarded.get_state_snapshot().get("cpu_hand", []) as Array)
	var attack_baseline := _pick_attack(baseline.get_state_snapshot().get("cpu_hand", []) as Array)
	if guarded_card.is_empty() or attack_guarded.is_empty() or attack_baseline.is_empty():
		_missing["defense_pair"] = int(_missing["defense_pair"]) + 1
		return
	var before_guarded := _actor(guarded.get_state_snapshot(), 0)
	var before_baseline := _actor(baseline.get_state_snapshot(), 0)
	var guarded_submit := _resolve_pair(guarded, [str(guarded_card.get("instance_id", ""))], [], [str(attack_guarded.get("instance_id", ""))], [])
	var baseline_submit := _resolve_pair(baseline, [], [], [str(attack_baseline.get("instance_id", ""))], [])
	if not guarded_submit.ok or not baseline_submit.ok:
		_failures.append("defense_resolve:%d:%s:%s" % [seed_value, str(guarded_submit.get("error", "")), str(baseline_submit.get("error", ""))])
		return
	var after_guarded := _actor(guarded.get_state_snapshot(), 0)
	var after_baseline := _actor(baseline.get_state_snapshot(), 0)
	var guarded_damage := maxf(0.0, float(before_guarded.get("hp", 0.0)) - float(after_guarded.get("hp", 0.0)))
	var baseline_damage := maxf(0.0, float(before_baseline.get("hp", 0.0)) - float(after_baseline.get("hp", 0.0)))
	(_rows["defense_pair"] as Array).append({
		"seed": seed_value,
		"card_id": DEFENSE_ID,
		"attack_id": str(attack_guarded.get("id", "")),
		"baseline_hp_damage": baseline_damage,
		"guarded_hp_damage": guarded_damage,
		"avoided_hp_damage": maxf(0.0, baseline_damage - guarded_damage),
		"guard_gain": maxf(0.0, float(after_guarded.get("guard", 0.0)) - float(before_guarded.get("guard", 0.0))),
		"ce_cost": maxf(0.0, float(before_guarded.get("ce", 0.0)) - float(after_guarded.get("ce", 0.0)))
	})

func _measure_healing(seed_value: int) -> void:
	var treated := _start_ready(seed_value, [HEALING_ID])
	var control := _start_ready(seed_value, [])
	if treated == null or control == null:
		_failures.append("healing_setup:%d" % seed_value)
		return
	var treatment_card := _find_id(treated.get_state_snapshot().get("normal_hand", []) as Array, HEALING_ID)
	var attack_treated := _pick_attack(treated.get_state_snapshot().get("cpu_hand", []) as Array)
	var attack_control := _pick_attack(control.get_state_snapshot().get("cpu_hand", []) as Array)
	if treatment_card.is_empty() or attack_treated.is_empty() or attack_control.is_empty():
		_missing["healing_pair"] = int(_missing["healing_pair"]) + 1
		return
	var first_treated := _resolve_pair(treated, [], [], [str(attack_treated.get("instance_id", ""))], [])
	var first_control := _resolve_pair(control, [], [], [str(attack_control.get("instance_id", ""))], [])
	if not first_treated.ok or not first_control.ok:
		_failures.append("healing_first_round:%d:%s:%s" % [seed_value, str(first_treated.get("error", "")), str(first_control.get("error", ""))])
		return
	var treated_after_hit := _actor(treated.get_state_snapshot(), 0)
	var control_after_hit := _actor(control.get_state_snapshot(), 0)
	var next_treated := _advance_ready(treated, [HEALING_ID])
	var next_control := _advance_ready(control, [])
	if not next_treated.ok or not next_control.ok:
		_failures.append("healing_second_setup:%d:%s:%s" % [seed_value, str(next_treated.get("error", "")), str(next_control.get("error", ""))])
		return
	treatment_card = _find_id(treated.get_state_snapshot().get("normal_hand", []) as Array, HEALING_ID)
	if treatment_card.is_empty():
		_missing["healing_pair"] = int(_missing["healing_pair"]) + 1
		return
	var before_heal := _actor(treated.get_state_snapshot(), 0)
	var before_control_second := _actor(control.get_state_snapshot(), 0)
	var heal_result := _resolve_pair(treated, [str(treatment_card.get("instance_id", ""))], [], [], [])
	if not heal_result.ok:
		_failures.append("healing_resolve:%d:%s" % [seed_value, str(heal_result.get("error", ""))])
		return
	var after_heal := _actor(treated.get_state_snapshot(), 0)
	var control_result := _resolve_pair(control, [], [], [], [])
	if not control_result.ok:
		_failures.append("healing_control_second_round:%d:%s" % [seed_value, str(control_result.get("error", ""))])
		return
	var after_control_second := _actor(control.get_state_snapshot(), 0)
	var actual_heal := maxf(0.0, float(after_heal.get("hp", 0.0)) - float(before_heal.get("hp", 0.0)))
	(_rows["healing_pair"] as Array).append({
		"seed": seed_value,
		"card_id": HEALING_ID,
		"hp_after_hit": float(treated_after_hit.get("hp", 0.0)),
		"control_hp_after_hit": float(control_after_hit.get("hp", 0.0)),
		"actual_healing": actual_heal,
		"automatic_recovery_control": maxf(0.0, float(after_control_second.get("hp", 0.0)) - float(before_control_second.get("hp", 0.0))),
		"net_recovery_vs_control": float(after_heal.get("hp", 0.0)) - float(after_control_second.get("hp", 0.0)),
		"treated_hp_after_second": float(after_heal.get("hp", 0.0)),
		"control_hp_after_second": float(after_control_second.get("hp", 0.0)),
		"max_hp": float(before_heal.get("max_hp", 0.0)),
		"ce_cost": maxf(0.0, float(before_heal.get("ce", 0.0)) - float(after_heal.get("ce", 0.0))),
		"stability_after": float(after_heal.get("stability", 0.0))
	})

func _measure_status(seed_value: int) -> void:
	var prepared := _start_ready(seed_value, [STATUS_ID], "gojo_satoru_shinjuku", OPPONENT_ID)
	var baseline := _start_ready(seed_value, [], "gojo_satoru_shinjuku", OPPONENT_ID)
	if prepared == null or baseline == null:
		_missing["status_pair"] = int(_missing["status_pair"]) + 1
		return
	var status_card := _find_id(prepared.get_state_snapshot().get("normal_hand", []) as Array, STATUS_ID)
	var prepared_attack := _pick_attack(prepared.get_state_snapshot().get("cpu_hand", []) as Array)
	var baseline_attack := _pick_attack(baseline.get_state_snapshot().get("cpu_hand", []) as Array)
	if status_card.is_empty() or prepared_attack.is_empty() or baseline_attack.is_empty():
		_missing["status_pair"] = int(_missing["status_pair"]) + 1
		return
	var before_prepared := _actor(prepared.get_state_snapshot(), 0)
	var before_baseline := _actor(baseline.get_state_snapshot(), 0)
	var prepared_result := _resolve_pair(prepared, [str(status_card.get("instance_id", ""))], [], [str(prepared_attack.get("instance_id", ""))], [])
	var baseline_result := _resolve_pair(baseline, [], [], [str(baseline_attack.get("instance_id", ""))], [])
	if not prepared_result.ok or not baseline_result.ok:
		_missing["status_pair"] = int(_missing["status_pair"]) + 1
		return
	var after_prepared := _actor(prepared.get_state_snapshot(), 0)
	var after_baseline := _actor(baseline.get_state_snapshot(), 0)
	var prepared_damage := maxf(0.0, float(before_prepared.get("hp", 0.0)) - float(after_prepared.get("hp", 0.0)))
	var baseline_damage := maxf(0.0, float(before_baseline.get("hp", 0.0)) - float(after_baseline.get("hp", 0.0)))
	(_rows["status_pair"] as Array).append({"seed":seed_value, "card_id":STATUS_ID, "baseline_opponent_hp_damage":baseline_damage, "status_opponent_hp_damage":prepared_damage, "avoided_hp_damage":maxf(0.0, baseline_damage - prepared_damage), "ce_cost":maxf(0.0, float(_actor(prepared.get_state_snapshot(), 0).get("max_ce", 0.0)) - float(_actor(prepared.get_state_snapshot(), 0).get("ce", 0.0)))})

func _measure_technique(seed_value: int) -> void:
	var technique := _start_ready(seed_value, [TECHNIQUE_ID], "gojo_satoru_shinjuku", OPPONENT_ID)
	var baseline := _start_ready(seed_value, [], "gojo_satoru_shinjuku", OPPONENT_ID)
	if technique == null or baseline == null:
		_missing["technique_pair"] = int(_missing["technique_pair"]) + 1
		return
	var technique_card := _find_id(technique.get_state_snapshot().get("normal_hand", []) as Array, TECHNIQUE_ID)
	var basic_card := _pick_attack(baseline.get_state_snapshot().get("normal_hand", []) as Array)
	if technique_card.is_empty() or basic_card.is_empty():
		_missing["technique_pair"] = int(_missing["technique_pair"]) + 1
		return
	var technique_before := _actor(technique.get_state_snapshot(), 1)
	var basic_before := _actor(baseline.get_state_snapshot(), 1)
	var tr := _resolve_pair(technique, [str(technique_card.get("instance_id", ""))], [], [], [])
	var br := _resolve_pair(baseline, [str(basic_card.get("instance_id", ""))], [], [], [])
	if not tr.ok or not br.ok:
		_missing["technique_pair"] = int(_missing["technique_pair"]) + 1
		return
	var technique_after := _actor(technique.get_state_snapshot(), 1)
	var basic_after := _actor(baseline.get_state_snapshot(), 1)
	var technique_damage := maxf(0.0, float(technique_before.get("hp", 0.0)) - float(technique_after.get("hp", 0.0)))
	var basic_damage := maxf(0.0, float(basic_before.get("hp", 0.0)) - float(basic_after.get("hp", 0.0)))
	var technique_ce := maxf(0.0, float(_actor(technique.get_state_snapshot(), 0).get("max_ce", 0.0)) - float(_actor(technique.get_state_snapshot(), 0).get("ce", 0.0)))
	var basic_ce := maxf(0.0, float(_actor(baseline.get_state_snapshot(), 0).get("max_ce", 0.0)) - float(_actor(baseline.get_state_snapshot(), 0).get("ce", 0.0)))
	(_rows["technique_pair"] as Array).append({"seed":seed_value, "technique_id":TECHNIQUE_ID, "basic_id":str(basic_card.get("id", "")), "technique_damage":technique_damage, "basic_damage":basic_damage, "technique_ce":technique_ce, "basic_ce":basic_ce, "technique_damage_per_ce":technique_damage / maxf(1.0, technique_ce), "basic_damage_per_ce":basic_damage / maxf(1.0, basic_ce)})

func _measure_domain(seed_value: int) -> void:
	var session := _start_ready(seed_value, [], "sukuna_heian_shinjuku", OPPONENT_ID)
	if session == null:
		_missing["domain_window"] = int(_missing["domain_window"]) + 1
		return
	var initial: Dictionary = session.get_state_snapshot()
	var domain_hand: Array = initial.get("domain_hand", []) as Array
	if domain_hand.is_empty():
		_missing["domain_window"] = int(_missing["domain_window"]) + 1
		return
	var domain_card: Dictionary = domain_hand[0] as Dictionary
	var before_target := _actor(initial, 1)
	var domain_result := _resolve_pair(session, [], [str(domain_card.get("instance_id", ""))], [], [])
	if not domain_result.ok:
		_missing["domain_window"] = int(_missing["domain_window"]) + 1
		return
	var after_domain: Dictionary = session.get_state_snapshot()
	var immediate_damage := maxf(0.0, float(before_target.get("hp", 0.0)) - float(_actor(after_domain, 1).get("hp", 0.0)))
	var second_setup := _advance_ready(session, [])
	if not second_setup.ok:
		_missing["domain_window"] = int(_missing["domain_window"]) + 1
		return
	var second_snapshot: Dictionary = session.get_state_snapshot()
	var second_attack := _best_playable_attack(session, second_snapshot.get("normal_hand", []) as Array)
	if second_attack.is_empty():
		_missing["domain_window"] = int(_missing["domain_window"]) + 1
		return
	var second_before := _actor(second_snapshot, 1)
	var second_result := _resolve_pair(session, [str(second_attack.get("instance_id", ""))], [], [], [])
	if not second_result.ok:
		_missing["domain_window"] = int(_missing["domain_window"]) + 1
		return
	var second_after := _actor(session.get_state_snapshot(), 1)
	var second_damage := maxf(0.0, float(second_before.get("hp", 0.0)) - float(second_after.get("hp", 0.0)))
	var final_actor := _actor(session.get_state_snapshot(), 0)
	(_rows["domain_window"] as Array).append({"seed":seed_value, "domain_id":str(domain_card.get("id", "")), "immediate_damage":immediate_damage, "second_turn_damage":second_damage, "two_turn_damage":immediate_damage + second_damage, "ce_cost":maxf(0.0, float(_actor(initial, 0).get("max_ce", 0.0)) - float(final_actor.get("ce", 0.0))), "domain_active_after_first":bool(( _actor(after_domain, 0).get("domain_state", {}) as Dictionary).get("active", false)), "domain_load":float((_actor(after_domain, 0).get("domain_state", {}) as Dictionary).get("load", 0.0))})

func _start_ready(seed_value: int, guaranteed_player_ids: Array[String], player_id: String = PLAYER_ID, opponent_id: String = OPPONENT_ID) -> RefCounted:
	print("SCENARIO_START_READY seed=%d cards=%s" % [seed_value, ",".join(guaranteed_player_ids)])
	var eligibility: RefCounted = ELIGIBILITY_SCRIPT.new()
	var builder: RefCounted = CANDIDATE_BUILDER_SCRIPT.new()
	var profiles: Array[Dictionary] = []
	var normals: Array[Array] = [[], []]
	var techniques: Array[Array] = [[], []]
	var domains: Array[Array] = [[], []]
	for side: int in 2:
		var id := player_id if side == 0 else opponent_id
		var profile: Dictionary = eligibility.build_profile(id)
		if profile.is_empty(): return null
		profiles.append(RESOURCES_SCRIPT.new().apply(profile))
		for card: Dictionary in eligibility.eligible_cards(profile, "normal"):
			if _is_technique(card): techniques[side].append(card)
			else: normals[side].append(card)
		for card: Dictionary in eligibility.eligible_cards(profile, "domain"):
			if builder.is_domain_expansion(card): domains[side].append(card)
	var opponent_attack := _eligible_by_id(eligibility.eligible_cards(profiles[1], "normal"), OPPONENT_ATTACK_ID)
	if opponent_attack.is_empty():
		for candidate: Dictionary in eligibility.eligible_cards(profiles[1], "normal"):
			if float((candidate.get("effect", {}) as Dictionary).get("damage", 0.0)) > 0.0:
				opponent_attack = candidate.duplicate(true)
				break
	if opponent_attack.is_empty(): return null
	opponent_attack["guaranteedPerTurn"] = true
	normals[1].append(opponent_attack)
	print("SCENARIO_POOLS seed=%d normal=%d/%d technique=%d/%d domain=%d/%d" % [seed_value, normals[0].size(), normals[1].size(), techniques[0].size(), techniques[1].size(), domains[0].size(), domains[1].size()])
	for wanted_id: String in guaranteed_player_ids:
		var injected := _eligible_by_id(eligibility.eligible_cards(profiles[0], "normal"), wanted_id)
		if injected.is_empty(): return null
		injected["guaranteedPerTurn"] = true
		if _is_technique(injected): techniques[0].append(injected)
		else: normals[0].append(injected)
	var session: RefCounted = SESSION_SCRIPT.new()
	var started: Dictionary = session.start_battle_with_pools(profiles, _typed(normals[0]), _typed(normals[1]), _typed(techniques[0]), _typed(techniques[1]), _typed(domains[0]), _typed(domains[1]), seed_value)
	if not bool(started.get("ok", false)): return null
	session.state.ruleset_version = &"battle-rules-v3"
	if not bool(session.choose_strategy(0, &"default", int(session.state.revision)).get("ok", false)): return null
	if not bool(session.choose_strategy(1, &"default", int(session.state.revision)).get("ok", false)): return null
	if not bool(session.confirm_strategies(int(session.state.revision)).get("ok", false)): return null
	if not bool(session.deal_round(int(session.state.revision)).get("ok", false)): return null
	var snapshot: Dictionary = session.get_state_snapshot()
	var discard_player := _discard_ids(snapshot.get("normal_hand", []) as Array, guaranteed_player_ids)
	var discard_cpu := _discard_ids(snapshot.get("cpu_hand", []) as Array, [OPPONENT_ATTACK_ID])
	if discard_player.size() != 2 or discard_cpu.size() != 2: return null
	if not bool(session.discard_cards(0, discard_player, int(session.state.revision)).get("ok", false)): return null
	if not bool(session.discard_cards(1, discard_cpu, int(session.state.revision)).get("ok", false)): return null
	for side: int in 2:
		if not bool(session.skip_initiative(side, int(session.state.revision)).get("ok", false)): return null
	return session

func _advance_ready(session: RefCounted, protected_ids: Array[String]) -> Dictionary:
	var dealt: Dictionary = session.deal_round(int(session.state.revision))
	if not bool(dealt.get("ok", false)): return dealt
	var snapshot: Dictionary = session.get_state_snapshot()
	var discard_player := _discard_ids(snapshot.get("normal_hand", []) as Array, protected_ids)
	var discard_cpu := _discard_ids(snapshot.get("cpu_hand", []) as Array, [OPPONENT_ATTACK_ID])
	if discard_player.size() != 2 or discard_cpu.size() != 2: return {"ok":false, "error":"discard_round2"}
	if not bool(session.discard_cards(0, discard_player, int(session.state.revision)).get("ok", false)): return {"ok":false, "error":"discard_player_round2"}
	if not bool(session.discard_cards(1, discard_cpu, int(session.state.revision)).get("ok", false)): return {"ok":false, "error":"discard_cpu_round2"}
	for side: int in 2:
		if not bool(session.skip_initiative(side, int(session.state.revision)).get("ok", false)): return {"ok":false, "error":"initiative_round2"}
	return {"ok":true}

func _resolve_pair(session: RefCounted, player_ids: Array, player_domain_ids: Array, opponent_ids: Array, opponent_domain_ids: Array) -> Dictionary:
	var p: Dictionary = session.submit_play(0, player_ids, player_domain_ids, int(session.state.revision))
	if not bool(p.get("ok", false)): return p
	var o: Dictionary = session.submit_play(1, opponent_ids, opponent_domain_ids, int(session.state.revision))
	if not bool(o.get("ok", false)): return o
	return session.resolve_round(int(session.state.revision))

func _discard_ids(cards: Array, protected_ids: Array[String]) -> Array[String]:
	var result: Array[String] = []
	for raw: Variant in cards:
		if not raw is Dictionary: continue
		var card := raw as Dictionary
		if protected_ids.has(str(card.get("id", ""))): continue
		result.append(str(card.get("instance_id", "")))
		if result.size() == 2: break
	return result

func _eligible_by_id(cards: Array[Dictionary], wanted_id: String) -> Dictionary:
	for card: Dictionary in cards:
		if str(card.get("id", "")) == wanted_id: return card.duplicate(true)
	return {}

func _find_id(cards: Array, wanted_id: String) -> Dictionary:
	for raw: Variant in cards:
		if raw is Dictionary and str((raw as Dictionary).get("id", "")) == wanted_id: return raw as Dictionary
	return {}

func _pick_attack(cards: Array) -> Dictionary:
	var best := {}
	var best_damage := INF
	for raw: Variant in cards:
		if not raw is Dictionary: continue
		var card := raw as Dictionary
		var effect: Dictionary = card.get("effect", {}) as Dictionary
		var damage := float(effect.get("damage", 0.0))
		if damage > 0.0 and damage < best_damage:
			best_damage = damage
			best = card
	return best

func _best_playable_attack(session: RefCounted, cards: Array) -> Dictionary:
	var best := {}
	var best_damage := -1.0
	for raw: Variant in cards:
		if not raw is Dictionary: continue
		var card := raw as Dictionary
		var effect: Dictionary = card.get("effect", {}) as Dictionary
		var damage := float(effect.get("damage", 0.0))
		if damage <= 0.0: continue
		var check: Dictionary = session.validate_play({"actor_index":0, "card_instance_ids":[str(card.get("instance_id", ""))], "domain_instance_ids":[]})
		if bool(check.get("ok", false)) and damage > best_damage:
			best_damage = damage
			best = card
	return best

func _is_technique(card: Dictionary) -> bool:
	var type := str(card.get("type", "")).to_lower()
	var tags: Array = card.get("tags", []) as Array
	return type in ["technique", "spell", "术式"] or tags.has("technique") or tags.has("术式") or not str(card.get("sourceTechniqueFamily", "")).is_empty()

func _typed(cards: Array) -> Array[Dictionary]:
	var result: Array[Dictionary] = []
	for raw: Variant in cards:
		if raw is Dictionary: result.append((raw as Dictionary).duplicate(true))
	return result

func _actor(snapshot: Dictionary, index: int) -> Dictionary:
	var actors: Array = snapshot.get("actors", []) as Array
	return actors[index] as Dictionary if index < actors.size() and actors[index] is Dictionary else {}

func _summary() -> Dictionary:
	var result := {}
	for key: String in _rows.keys():
		var rows: Array = _rows[key] as Array
		var avg := func(field: String) -> float:
			if rows.is_empty(): return 0.0
			var total := 0.0
			for row: Dictionary in rows: total += float(row.get(field, 0.0))
			return total / float(rows.size())
		result[key] = {"observations":rows.size()}
		var fields: Array[String] = []
		match key:
			"defense_pair": fields = ["baseline_hp_damage", "guarded_hp_damage", "avoided_hp_damage", "guard_gain", "ce_cost"]
			"healing_pair": fields = ["actual_healing", "automatic_recovery_control", "net_recovery_vs_control", "ce_cost", "hp_after_hit"]
			"status_pair": fields = ["baseline_opponent_hp_damage", "status_opponent_hp_damage", "avoided_hp_damage", "ce_cost"]
			"technique_pair": fields = ["technique_damage", "basic_damage", "technique_ce", "basic_ce", "technique_damage_per_ce", "basic_damage_per_ce"]
			"domain_window": fields = ["immediate_damage", "second_turn_damage", "two_turn_damage", "ce_cost", "domain_load"]
		for field: String in fields:
			(result[key] as Dictionary)["avg_" + field] = avg.call(field)
	return result
