class_name StoryBattleAdapter
extends RefCounted

const PROFILE_TO_OPPONENT := {
	"river_low_grade_curse":"kechizu_origin_candidate",
	"river_deep_curse":"kechizu_origin_candidate",
	"sukuna":"sukuna_heian_or_shinjuku",
	"dagon_jogo":"dagon_shibuya_domain",
	"choso":"choso_shibuya_culling",
	"hanami_jogo":"jogo_shibuya",
	"mahito":"mahito_shibuya",
	"kenjaku_choso":"kenjaku_geto_body",
	"smallpox":"smallpox_deity_shibuya",
	"haruta":"haruta_shigemo_shibuya_candidate"
}

static func opponent_id_for_definition(definition: Dictionary) -> String:
	var profile := str(definition.get("battleProfile", ""))
	return str(PROFILE_TO_OPPONENT.get(profile, "kechizu_origin_candidate"))

## 将故事状态中的攻略型伙伴投影为战斗可用的临时支援牌。
## 规则仍由 BattleFlowSession/V3 结算；这里仅负责上下文注入。
static func build_snapshot(story: Node) -> Dictionary:
	var snapshot: Dictionary = (story.get("character") as Dictionary).duplicate(true)
	var cards: Array = snapshot.get("customHandCards", snapshot.get("cards", [])).duplicate(true) as Array
	if story.has_method("npc_state") and bool((story.call("npc_state", "junior_sorcerer") as Dictionary).get("companion", false)):
		if not _has_card(cards, "companion_junior_protective_intervention"):
			cards.append({"id":"companion_junior_protective_intervention", "name":"援护·护住盲区", "type":"support", "block":40, "cost":{"ce":0}, "tags":["companion_support"], "guaranteedPerTurn":true, "handSource":"story_companion", "text":{"summary":"伙伴替你挡下本回合的一次冲击。"}})
	var inventory: Dictionary = story.get("inventory") as Dictionary if story != null else {}
	if int(inventory.get("river_protective_talisman", 0)) > 0 and not _has_card(cards, "river_protective_talisman"):
		cards.append({"id":"river_protective_talisman", "name":"咒具·潮息护符", "type":"support", "block":22, "cost":{"ce":0}, "tags":["story_item", "cursed_tool"], "handSource":"story_inventory", "text":{"summary":"护符吸收一次河岸残秽冲击。"}})
	snapshot["customHandCards"] = cards
	return snapshot

static func _has_card(cards: Array, card_id: String) -> bool:
	for raw: Variant in cards:
		if raw is Dictionary and str((raw as Dictionary).get("id", "")) == card_id:
			return true
	return false
