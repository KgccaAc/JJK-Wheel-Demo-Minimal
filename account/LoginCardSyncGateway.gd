class_name LoginCardSyncGateway
extends RefCounted

## 登录卡服务器协议边界。这里不保存 accessToken，也不假装离线请求已经成功。
## 接入 HTTPClient 后只需在 execute 内实现 endpoints，调用方始终接收相同封包。
const API_VERSION: String = "jjk.login-card.v2"
const ENDPOINTS: Dictionary = {
	"ensure_account": "/api/login-cards",
	"confirm_login": "/api/login-cards/{cardId}/login",
	"sync_snapshot": "/api/login-cards/{cardId}/sync",
	"upsert_character": "/api/login-cards/{cardId}/characters/{characterId}",
	"competition_draw": "/api/competition-cards/{cardId}/draw",
	"competition_draw_abandon": "/api/competition-cards/{cardId}/draw-abandon"
}

static func make_character_request(card_id: String, character: Dictionary) -> Dictionary:
	return {
		"api_version": API_VERSION, "operation": "upsert_character", "card_id": card_id,
		"character_id": str(character.get("id", "")),
		"expected_character_revision": (character.get("snapshot_metadata", {}) as Dictionary).get("character_revision", 0),
		"expected_snapshot_hash": (character.get("snapshot_metadata", {}) as Dictionary).get("snapshot_hash", ""),
		"snapshot": (character.get("canonicalV3", {}) as Dictionary).duplicate(true)
	}

static func unavailable(operation: String, detail: String = "online_service_unavailable") -> Dictionary:
	return {"ok":false, "api_version":API_VERSION, "operation":operation, "code":detail, "retryable":true, "authoritative":false}

