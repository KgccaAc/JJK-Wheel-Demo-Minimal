extends SceneTree

const BattleFlowSessionScript = preload("res://battle/core/BattleFlowSession.gd")

func _initialize() -> void:
    var failures: Array[String] = []
    var session: RefCounted = BattleFlowSessionScript.new()
    var started: Dictionary = session.start_fixed_offline("gojo_satoru_shinjuku", "sukuna_heian_or_shinjuku", 20260919, true)
    if not bool(started.get("ok", false)):
        failures.append("start:%s" % str(started.get("error", "unknown")))
    else:
        var snapshot: Dictionary = session.get_state_snapshot()
        var hand: Array = snapshot.get("normal_hand", []) as Array
        if hand.size() < 2:
            failures.append("hand_too_small:%d" % hand.size())
        else:
            var ap_cards: Array[Dictionary] = []
            for raw: Variant in hand:
                if raw is Dictionary:
                    var card: Dictionary = raw as Dictionary
                    var cost: Dictionary = card.get("cost", {}) as Dictionary
                    if cost.has("ap") or card.has("ap") or card.has("apCost"):
                        ap_cards.append(card)
            if not ap_cards.is_empty():
                failures.append("materialized_legacy_ap:%d" % ap_cards.size())
            var over: Dictionary = session.validate_play({"actor_index": 0, "card_instance_ids": [], "domain_instance_ids": []})
            if not bool(over.get("ok", false)) and str(over.get("error", "")) == "no_cards_selected":
                pass
    var status: String = "HAND_BALANCE_AP_REMOVAL_ACCEPTANCE %s failures=%s" % ["PASS" if failures.is_empty() else "FAIL", ";".join(failures)]
    print(status)
    quit(0 if failures.is_empty() else 1)
