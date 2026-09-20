extends SceneTree

## Real-play category benchmark. Each observation starts a fresh BattleFlowSession,
## so one category cannot inherit resources or statuses from another category.
const SESSION_SCRIPT: Script = preload("res://battle/core/BattleFlowSession.gd")
const INTENT_SCRIPT: Script = preload("res://battle/v3/ActionIntentV3.gd")
const RESOLVER_SCRIPT: Script = preload("res://battle/v3/ActionResolverV3.gd")
const ELIGIBILITY_SCRIPT: Script = preload("res://battle/data/BattleEligibility.gd")
const RESOURCES_SCRIPT: Script = preload("res://battle/data/CharacterResources.gd")
const CANDIDATE_BUILDER_SCRIPT: Script = preload("res://battle/data/CardCandidateBuilder.gd")
const DEFAULT_PLAYER_ID := "yuji_itadori_shibuya"
const DEFAULT_OPPONENT_ID := "nanami_kento_shibuya"
const SEEDS: Array[int] = [2026092001, 2026092002, 2026092003, 2026092004, 2026092005, 2026092006, 2026092007, 2026092008, 2026092009, 2026092010, 2026092011, 2026092012, 2026092013, 2026092014, 2026092015, 2026092016, 2026092017, 2026092018, 2026092019, 2026092020]
const CATEGORIES: Array[String] = ["basic_attack", "high_risk_attack", "defense_shield", "resource_generation", "status", "technique_prepare", "technique_payoff", "summon", "domain", "counter_control"]
const OUTPUT_PATH := "res://reports/balance/card-category-benchmark-2026-09-19.json"

var _rows: Dictionary = {}
var _missing: Dictionary = {}
var _player_id := DEFAULT_PLAYER_ID
var _opponent_id := DEFAULT_OPPONENT_ID
var _output_path := OUTPUT_PATH

func _initialize() -> void:
	for arg: String in OS.get_cmdline_user_args():
		if arg.begins_with("--player="): _player_id = arg.trim_prefix("--player=")
		elif arg.begins_with("--opponent="): _opponent_id = arg.trim_prefix("--opponent=")
		elif arg.begins_with("--output="): _output_path = arg.trim_prefix("--output=")
	for category: String in CATEGORIES:
		_rows[category] = []
		_missing[category] = 0
	for seed_value: int in SEEDS:
		for category: String in CATEGORIES:
			_measure_category(seed_value, category)
	var report := {
		"schema": "jjk-card-category-benchmark-v1",
		"generated_at": Time.get_datetime_string_from_system(true),
		"player": _player_id,
		"opponent": _opponent_id,
		"seed_count": SEEDS.size(),
		"categories": _summarize(),
		"missing_hand_observations": _missing,
		"interpretation": {
			"worth_picking": "compare two_turn_total_damage and defensive_value_per_ce against same-session category baselines; do not use static damage alone",
			"technique_vs_basic": "compare technique_payoff and basic_attack at the same real CE state and two-turn window",
			"domain_tempo": "domain records activation success, immediate damage, two-turn damage, CE spent, and load; a domain is not judged by immediate damage alone"
		}
	}
	var dir := ProjectSettings.globalize_path(_output_path.get_base_dir())
	DirAccess.make_dir_recursive_absolute(dir)
	var file := FileAccess.open(_output_path, FileAccess.WRITE)
	if file == null:
		print("CARD_CATEGORY_BENCHMARK FAIL output_open")
		quit(1)
		return
	file.store_string(JSON.stringify(report, "  "))
	print("CARD_CATEGORY_BENCHMARK PASS seeds=%d categories=%d" % [SEEDS.size(), CATEGORIES.size()])
	quit(0)

func _new_ready_session(seed_value: int, target_category: String) -> RefCounted:
	var eligibility: RefCounted = ELIGIBILITY_SCRIPT.new()
	var builder: RefCounted = CANDIDATE_BUILDER_SCRIPT.new()
	var profiles: Array[Dictionary] = []
	var normal_pools: Array[Array] = [[], []]
	var technique_pools: Array[Array] = [[], []]
	var domain_pools: Array[Array] = [[], []]
	for side: int in 2:
		var profile: Dictionary = eligibility.build_profile(_player_id if side == 0 else _opponent_id)
		if profile.is_empty(): return null
		profiles.append(RESOURCES_SCRIPT.new().apply(profile))
		var cards: Array[Dictionary] = eligibility.eligible_cards(profile, "normal")
		for card: Dictionary in cards:
			if _is_technique(card): technique_pools[side].append(card)
			else: normal_pools[side].append(card)
		for card: Dictionary in eligibility.eligible_cards(profile, "domain"):
			if builder.is_domain_expansion(card): domain_pools[side].append(card)
	var target_profile: Dictionary = profiles[0]
	var target_card: Dictionary = _find_eligible_category_card(eligibility, target_profile, target_category, target_category == "domain")
	if target_card.is_empty(): return null
	target_card["guaranteedPerTurn"] = true
	if target_category == "domain": domain_pools[0].append(target_card)
	elif _is_technique(target_card): technique_pools[0].append(target_card)
	else: normal_pools[0].append(target_card)
	var session: RefCounted = SESSION_SCRIPT.new()
	var started: Dictionary = session.start_battle_with_pools(profiles, _typed_cards(normal_pools[0]), _typed_cards(normal_pools[1]), _typed_cards(technique_pools[0]), _typed_cards(technique_pools[1]), _typed_cards(domain_pools[0]), _typed_cards(domain_pools[1]), seed_value)
	if not bool(started.get("ok", false)): return null
	session.state.ruleset_version = &"battle-rules-v3"
	if not bool(session.choose_strategy(0, &"default", int(session.state.revision)).get("ok", false)): return null
	if not bool(session.choose_strategy(1, &"default", int(session.state.revision)).get("ok", false)): return null
	if not bool(session.confirm_strategies(int(session.state.revision)).get("ok", false)): return null
	if not bool(session.deal_round(int(session.state.revision)).get("ok", false)): return null
	var first: Dictionary = session.get_state_snapshot()
	var player_ids := _first_ids(first.get("normal_hand", []) as Array, 2)
	var cpu_ids := _first_ids(first.get("cpu_hand", []) as Array, 2)
	if player_ids.size() != 2 or cpu_ids.size() != 2: return null
	if not bool(session.discard_cards(0, player_ids, int(session.state.revision)).get("ok", false)): return null
	if not bool(session.discard_cards(1, cpu_ids, int(session.state.revision)).get("ok", false)): return null
	for side: int in 2:
		if not bool(session.skip_initiative(side, int(session.state.revision)).get("ok", false)): return null
	return session

func _is_technique(card: Dictionary) -> bool:
	var type := str(card.get("type", "")).to_lower()
	var tags: Array = card.get("tags", []) as Array
	return type in ["technique", "spell", "术式"] or tags.has("technique") or tags.has("术式") or not str(card.get("sourceTechniqueFamily", "")).is_empty()

func _typed_cards(value: Array) -> Array[Dictionary]:
	var result: Array[Dictionary] = []
	for raw: Variant in value:
		if raw is Dictionary: result.append((raw as Dictionary).duplicate(true))
	return result

func _find_eligible_category_card(eligibility: RefCounted, profile: Dictionary, category: String, domain_only: bool) -> Dictionary:
	for card: Dictionary in eligibility.eligible_cards(profile, "domain" if domain_only else "normal"):
		if _classify(card) == category: return card.duplicate(true)
	return {}

func _measure_category(seed_value: int, category: String) -> void:
	var session: RefCounted = _new_ready_session(seed_value, category)
	if session == null:
		_missing[category] = int(_missing[category]) + 1
		return
	var snapshot: Dictionary = session.get_state_snapshot()
	var card: Dictionary = _find_category_card(snapshot.get("normal_hand", []) as Array, category)
	var domain_card: Dictionary = _find_category_card(snapshot.get("domain_hand", []) as Array, category)
	var selected_domain := category == "domain"
	if selected_domain and domain_card.is_empty():
		_missing[category] = int(_missing[category]) + 1
		return
	if not selected_domain and card.is_empty():
		_missing[category] = int(_missing[category]) + 1
		return
	var before: Dictionary = session.get_state_snapshot()
	var before_actor := _actor(before, 0)
	var before_target := _actor(before, 1)
	var card_ids: Array = [] if selected_domain else [str(card.get("instance_id", ""))]
	var domain_ids: Array = [str(domain_card.get("instance_id", ""))] if selected_domain else []
	var player_submit: Dictionary = session.submit_play(0, card_ids, domain_ids, int(session.state.revision))
	if not bool(player_submit.get("ok", false)):
		_missing[category] = int(_missing[category]) + 1
		return
	var cpu: Dictionary = session.choose_cpu_play()
	var cpu_submit: Dictionary = session.submit_play(1, cpu.get("card_instance_ids", []) as Array, cpu.get("domain_instance_ids", []) as Array, int(session.state.revision))
	if not bool(cpu_submit.get("ok", false)):
		_missing[category] = int(_missing[category]) + 1
		return
	var resolved: Dictionary = session.resolve_round(int(session.state.revision))
	if not bool(resolved.get("ok", false)):
		_missing[category] = int(_missing[category]) + 1
		return
	var after: Dictionary = session.get_state_snapshot()
	var after_actor := _actor(after, 0)
	var after_target := _actor(after, 1)
	var row := {
		"seed": seed_value,
		"card_id": str((domain_card if selected_domain else card).get("id", "")),
		"card_name": str((domain_card if selected_domain else card).get("name", "")),
		"ce_cost": maxf(0.0, float(before_actor.get("ce", 0.0)) - float(after_actor.get("ce", 0.0))),
		"effective_hp_damage": maxf(0.0, float(before_target.get("hp", 0.0)) - float(after_target.get("hp", 0.0))),
		"guard_gain": maxf(0.0, float(after_actor.get("guard", 0.0)) - float(before_actor.get("guard", 0.0))),
		"healing_gain": maxf(0.0, float(after_actor.get("hp", 0.0)) - float(before_actor.get("hp", 0.0))),
		"status_delta": maxi(0, int((after_actor.get("statuses", {}) as Dictionary).size()) - int((before_actor.get("statuses", {}) as Dictionary).size())),
		"domain_active": bool((after_actor.get("domain_state", {}) as Dictionary).get("active", false)),
		"domain_load": float((after_actor.get("domain_state", {}) as Dictionary).get("load", 0.0)),
		"round_1_ok": true,
		"round_2_effective_hp_damage": 0.0,
		"two_turn_total_damage": 0.0
	}
	row.two_turn_total_damage = row.effective_hp_damage
	# Continue through one more real deal/discard/initiative cycle. The best valid
	# single card is used only to expose future value from preparation/status/domain.
	if not bool(after.get("finished", false)):
		var second := _advance_to_play(session)
		if bool(second.get("ok", false)):
			var second_snapshot: Dictionary = session.get_state_snapshot()
			var best := _best_single(session, second_snapshot.get("normal_hand", []) as Array)
			if not best.is_empty():
				var s: Dictionary = session.submit_play(0, [str(best.get("instance_id", ""))], [], int(session.state.revision))
				if bool(s.get("ok", false)):
					var c: Dictionary = session.choose_cpu_play()
					var cs: Dictionary = session.submit_play(1, c.get("card_instance_ids", []) as Array, c.get("domain_instance_ids", []) as Array, int(session.state.revision))
					if bool(cs.get("ok", false)):
						var rr: Dictionary = session.resolve_round(int(session.state.revision))
						if bool(rr.get("ok", false)):
							var second_after: Dictionary = session.get_state_snapshot()
							row.round_2_effective_hp_damage = maxf(0.0, _hp(second_snapshot, 1) - _hp(second_after, 1))
							row.two_turn_total_damage = row.effective_hp_damage + row.round_2_effective_hp_damage
		(_rows[category] as Array).append(row)

func _advance_to_play(session: RefCounted) -> Dictionary:
	if session.get_phase() != &"DEAL": return {"ok":false, "error":"not_deal"}
	var dealt: Dictionary = session.deal_round(int(session.state.revision))
	if not bool(dealt.get("ok", false)): return dealt
	var snapshot: Dictionary = session.get_state_snapshot()
	var player_ids := _first_ids(snapshot.get("normal_hand", []) as Array, 2)
	var cpu_ids := _first_ids(snapshot.get("cpu_hand", []) as Array, 2)
	if player_ids.size() != 2 or cpu_ids.size() != 2: return {"ok":false, "error":"second_hand_short"}
	if not bool(session.discard_cards(0, player_ids, int(session.state.revision)).get("ok", false)): return {"ok":false, "error":"second_discard_player"}
	if not bool(session.discard_cards(1, cpu_ids, int(session.state.revision)).get("ok", false)): return {"ok":false, "error":"second_discard_cpu"}
	for side: int in 2:
		if not bool(session.skip_initiative(side, int(session.state.revision)).get("ok", false)): return {"ok":false, "error":"second_initiative"}
	return {"ok":true}

func _best_single(session: RefCounted, hand: Array) -> Dictionary:
	var best := {}
	var best_damage := -1.0
	var snapshot: Dictionary = session.get_state_snapshot()
	for raw: Variant in hand:
		if not raw is Dictionary: continue
		var card := raw as Dictionary
		var id := str(card.get("instance_id", ""))
		var input := {"actor_index":0, "card_instance_ids":[id], "domain_instance_ids":[]}
		var check: Dictionary = session.validate_play(input)
		if not bool(check.get("ok", false)): continue
		var preview: Dictionary = RESOLVER_SCRIPT.new().preview_action(session.state, INTENT_SCRIPT.from_dictionary(input))
		if not bool(preview.get("ok", false)): continue
		var damage := maxf(0.0, _hp(snapshot, 1) - _hp(preview.get("after_state", {}) as Dictionary, 1))
		if damage > best_damage:
			best_damage = damage
			best = card
	return best

func _summarize() -> Dictionary:
	var result := {}
	for category: String in CATEGORIES:
		var rows: Array = _rows[category] as Array
		var avg := func(field: String) -> float:
			if rows.is_empty(): return 0.0
			var total := 0.0
			for row: Dictionary in rows: total += float(row.get(field, 0.0))
			return total / float(rows.size())
		result[category] = {"observations":rows.size(), "avg_ce_cost":avg.call("ce_cost"), "avg_effective_hp_damage":avg.call("effective_hp_damage"), "avg_guard_gain":avg.call("guard_gain"), "avg_healing_gain":avg.call("healing_gain"), "avg_status_delta":avg.call("status_delta"), "avg_round_2_damage":avg.call("round_2_effective_hp_damage"), "avg_two_turn_damage":avg.call("two_turn_total_damage"), "avg_domain_load":avg.call("domain_load"), "avg_damage_per_ce":avg.call("effective_hp_damage") / maxf(1.0, avg.call("ce_cost")), "worth_picking_evidence":"compare against basic_attack and same-resource state; no isolated pass/fail threshold is asserted"}
	return result

func _find_category_card(cards: Array, category: String) -> Dictionary:
	for raw: Variant in cards:
		if raw is Dictionary and _classify(raw as Dictionary) == category: return raw as Dictionary
	return {}

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
	if float(effect.get("block", 0.0)) > 0.0 or float(effect.get("shield", 0.0)) > 0.0 or type in ["defense", "guard", "healing"]: return "defense_shield"
	if tags.contains("resource") or atomic_text.contains("adjust_counter") or atomic_text.contains("regenerate") or type == "resource": return "resource_generation"
	if atomic_text.contains("apply_status") or atomic_text.contains("register_counter_modifier") or not (effect.get("effects", []) as Array).is_empty() or tags.contains("status"): return "status"
	if tags.contains("prepare") or atomic_text.contains("prepare") or atomic_text.contains("authorize") or type in ["technique_prepare", "setup"]: return "technique_prepare"
	if type in ["technique", "special"] or tags.contains("technique") or not str(card.get("sourceTechniqueFamily", "")).is_empty(): return "technique_payoff"
	if float(effect.get("damage", card.get("damage", 0.0))) > 0.0: return "basic_attack"
	if float(effect.get("healing", 0.0)) > 0.0: return "defense_shield"
	return "status"

func _first_ids(cards: Array, count: int) -> Array[String]:
	var ids: Array[String] = []
	for raw: Variant in cards:
		if raw is Dictionary: ids.append(str((raw as Dictionary).get("instance_id", "")))
		if ids.size() >= count: break
	return ids

func _actor(snapshot: Dictionary, index: int) -> Dictionary:
	var actors: Array = snapshot.get("actors", []) as Array
	return actors[index] as Dictionary if index < actors.size() and actors[index] is Dictionary else {}

func _hp(snapshot: Dictionary, index: int) -> float:
	return float(_actor(snapshot, index).get("hp", 0.0))
