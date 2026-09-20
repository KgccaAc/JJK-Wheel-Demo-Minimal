extends Node

## 跨场景账户状态。只保存经认证后可公开展示的资料，不保存第三方令牌或密钥。
const DEFAULT_STORAGE_PATH: String = "user://account.cfg"
const DEFAULT_CARD_FACE_PATH: String = "res://d4544459fc744b707b15442cf873d1af_720.png"
const DEFAULT_CHARACTER_ID: String = "gojo_satoru_shinjuku"
const NORMAL_CARD_GROUP_NAME: String = "·普通卡·"
const SENSITIVE_KEYS: Array[String] = ["access_token", "refresh_token", "app_secret", "client_secret"]
const BILIBILI_PROVIDER_SCRIPT: Script = preload("res://account/BilibiliIdentityProvider.gd")
const LOGIN_CARD_PNG_CODEC: Script = preload("res://account/LoginCardPngCodec.gd")
const LOGIN_CARD_CHARACTER_CACHE: Script = preload("res://account/LoginCardCharacterCache.gd")
const LOGIN_CARD_SYNC_GATEWAY: Script = preload("res://account/HttpLoginCardSyncGateway.gd")

var _storage_path: String = DEFAULT_STORAGE_PATH
var _cards: Array[Dictionary] = []
var _active_card_id: String = ""
var _guest_session: bool = false
var _provider: RefCounted = BILIBILI_PROVIDER_SCRIPT.new() as RefCounted

func _ready() -> void:
	_load_state()

func use_test_storage(path: String) -> void:
	_storage_path = path
	_load_state()

func clear_for_test() -> void:
	_cards.clear()
	_active_card_id = ""
	_guest_session = false
	if FileAccess.file_exists(_storage_path):
		DirAccess.remove_absolute(ProjectSettings.globalize_path(_storage_path))

func cards() -> Array[Dictionary]:
	return _cards.duplicate(true) as Array[Dictionary]

func active_card() -> Dictionary:
	for card: Dictionary in _cards:
		if str(card.get("id", "")) == _active_card_id:
			return card.duplicate(true) as Dictionary
	return {}

func has_active_card() -> bool:
	return not active_card().is_empty()

func select_card(card_id: String) -> bool:
	for card: Dictionary in _cards:
		if str(card.get("id", "")) != card_id:
			continue
		if not bool(LOGIN_CARD_CHARACTER_CACHE.call("replace_active_card", card_id, card.get("stored_characters", []) as Array)):
			return false
		_active_card_id = card_id
		_guest_session = false
		return _save_state()
	return false

func owned_character_ids() -> Array[String]:
	var owned: Array[String] = []
	for raw_id: Variant in active_card().get("owned_character_ids", []) as Array:
		var character_id: String = str(raw_id)
		if not character_id.is_empty() and not owned.has(character_id):
			owned.append(character_id)
	return owned

## 游客只是一种会话状态，不写入或删除任何登录卡。
func set_guest_session() -> bool:
	if not bool(LOGIN_CARD_CHARACTER_CACHE.call("clear_active_card")): return false
	_active_card_id = ""
	_guest_session = true
	return _save_state()

func is_guest_session() -> bool:
	return _guest_session

func clear_session() -> bool:
	if not bool(LOGIN_CARD_CHARACTER_CACHE.call("clear_active_card")): return false
	_active_card_id = ""
	_guest_session = false
	return _save_state()

## 从玩家明确选择的本地图片复制到 user://，避免把任意本机绝对路径写进账户档案。
func import_card_face_from_local_file(source_path: String) -> Dictionary:
	if source_path.is_empty() or not FileAccess.file_exists(source_path):
		return {"ok": false, "error": "source_file_missing"}
	var extension: String = source_path.get_extension().to_lower()
	if not extension in ["png", "jpg", "jpeg", "webp"]:
		return {"ok": false, "error": "unsupported_image_type"}
	var target_dir: String = "user://login-card-faces"
	if DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(target_dir)) != OK:
		return {"ok": false, "error": "target_directory_failed"}
	var target_path: String = "%s/%s.%s" % [target_dir, _next_card_id("face"), extension]
	var source: FileAccess = FileAccess.open(source_path, FileAccess.READ)
	var target: FileAccess = FileAccess.open(target_path, FileAccess.WRITE)
	if source == null or target == null:
		return {"ok": false, "error": "file_open_failed"}
	target.store_buffer(source.get_buffer(source.get_length()))
	return {"ok": true, "path": target_path}

## 导入源项目的隐写 PNG：PNG 本身留作卡面，tEXt 中的公开 JSON 成为本地登录卡。
func import_login_card_png(source_path: String) -> Dictionary:
	var extracted: Dictionary = LOGIN_CARD_PNG_CODEC.call("extract", source_path) as Dictionary
	if not bool(extracted.get("ok", false)): return extracted
	var copied: Dictionary = import_card_face_from_local_file(source_path)
	if not bool(copied.get("ok", false)): return copied
	var payload: Dictionary = extracted.get("payload", {}) as Dictionary
	var characters: Array[Dictionary] = []
	var owned_ids: Array[String] = []
	# 两张表在源登录卡中可以并存：characters 提供角色目录，
	# characterCardTable 补充完整战斗快照/特殊手牌。不能因为前者非空就忽略后者。
	var source_entries: Array = []
	var character_positions: Dictionary = {}
	for raw: Variant in payload.get("characters", []) as Array: source_entries.append(raw)
	for raw: Variant in payload.get("characterCardTable", []) as Array: source_entries.append(raw)
	for raw_entry: Variant in source_entries:
		if not raw_entry is Dictionary: continue
		var entry: Dictionary = raw_entry as Dictionary
		var character: Dictionary = _strip_snapshot_secrets(entry.duplicate(true)) as Dictionary
		var source_character: Dictionary = entry.get("card", entry.get("character", entry)) as Dictionary
		var character_id: String = str(source_character.get("characterId", entry.get("characterId", source_character.get("id", entry.get("id", ""))))).strip_edges()
		if character_id.is_empty(): continue
		character["characterId"] = character_id
		# entry 包装仍保存完整 card 快照；这两个索引字段供选择器和本地缓存稳定定位。
		character["id"] = character_id
		character["name"] = str(source_character.get("displayName", source_character.get("name", entry.get("displayName", "未命名角色"))))
		# 同一 ID 在目录和卡表中重复时，后出现的卡表快照覆盖目录条目；
		# 保证特殊手牌/原始资源字段来自更完整的记录，又不会在选择器里重复。
		if character_positions.has(character_id): characters[int(character_positions[character_id])] = character
		else:
			character_positions[character_id] = characters.size()
			characters.append(character)
		if not owned_ids.has(character_id): owned_ids.append(character_id)
	var stable_id: String = str(payload.get("ownerId", payload.get("ipDerivedId", ""))).strip_edges()
	if stable_id.is_empty(): stable_id = _next_card_id("png")
	var card: Dictionary = _sanitize_card({"id":stable_id, "nickname":str(payload.get("ownerNickname", payload.get("nickname", "未命名"))), "group_name":str((payload.get("competition", {}) as Dictionary).get("group", "·普通卡·")), "card_face_path":str(copied.get("path", "")), "owned_character_ids":owned_ids, "stored_characters":characters, "identity_provider":"png_login_card", "identity_status":"imported"})
	if card.is_empty(): return {"ok":false, "error":"payload_rejected"}
	if not bool(LOGIN_CARD_CHARACTER_CACHE.call("replace_active_card", stable_id, characters)):
		return {"ok":false, "error":"character_cache_write_failed"}
	for index: int in _cards.size():
		if str(_cards[index].get("id", "")) == stable_id:
			_cards[index] = card
			_active_card_id = stable_id
			_guest_session = false
			return {"ok":_save_state(), "card":card.duplicate(true)}
	_cards.append(card)
	_active_card_id = stable_id
	_guest_session = false
	return {"ok":_save_state(), "card":card.duplicate(true)}

## Web uploads arrive as browser-selected bytes. They are staged only in user://
## so the existing PNG/steganography path remains identical to desktop import.
func import_login_card_png_bytes(bytes: PackedByteArray, source_name: String = "login-card.png") -> Dictionary:
	if bytes.is_empty():
		return {"ok":false, "error":"source_file_missing"}
	var inspected: Dictionary = LOGIN_CARD_PNG_CODEC.call("extract_bytes", bytes) as Dictionary
	if not bool(inspected.get("ok", false)):
		return inspected
	var suffix: String = source_name.get_extension().to_lower()
	if suffix != "png": suffix = "png"
	var staging_dir: String = "user://browser-login-card-imports"
	if DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(staging_dir)) != OK:
		return {"ok":false, "error":"target_directory_failed"}
	var staged_path: String = "%s/%s.%s" % [staging_dir, _next_card_id("web-upload"), suffix]
	var staged: FileAccess = FileAccess.open(staged_path, FileAccess.WRITE)
	if staged == null:
		return {"ok":false, "error":"file_open_failed"}
	staged.store_buffer(bytes)
	staged.flush()
	staged.close()
	return import_login_card_png(staged_path)

func set_active_card_face_path(card_face_path: String) -> bool:
	if _active_card_id.is_empty() or card_face_path.is_empty() or not FileAccess.file_exists(card_face_path):
		return false
	for index: int in _cards.size():
		if str(_cards[index].get("id", "")) == _active_card_id:
			_cards[index]["card_face_path"] = card_face_path
			return _save_state()
	return false

## 卡内完整角色定义是可选扩展；同 ID 会覆盖内置展示字段，未知 ID 会追加。
func card_characters() -> Array[Dictionary]:
	var characters: Array[Dictionary] = []
	for raw: Variant in active_card().get("stored_characters", []) as Array:
		if raw is Dictionary and not str((raw as Dictionary).get("id", "")).is_empty():
			characters.append((raw as Dictionary).duplicate(true))
	return characters

## Pull the authoritative card snapshot without replacing local data on errors.
func sync_active_card_from_server(base_url: String = "") -> Dictionary:
	var card: Dictionary = active_card()
	var card_id: String = str(card.get("id", "")).strip_edges()
	if card_id.is_empty(): return {"ok":false, "error":"active_card_missing"}
	var endpoint: String = base_url.strip_edges()
	if endpoint.is_empty(): endpoint = OS.get_environment("LOGIN_CARD_SYNC_URL").strip_edges()
	if endpoint.is_empty(): endpoint = "https://119.91.224.223/preview-api" if OS.has_feature("web") else "http://127.0.0.1:8788"
	var gateway: RefCounted = LOGIN_CARD_SYNC_GATEWAY.new(endpoint) as RefCounted
	var response: Dictionary = gateway.call("fetch_card", card_id) as Dictionary
	if not bool(response.get("ok", false)): return response
	var server_card: Dictionary = response.get("card", {}) as Dictionary
	var normalized: Array[Dictionary] = []
	for raw: Variant in server_card.get("characters", []) as Array:
		if raw is Dictionary:
			var entry: Dictionary = (raw as Dictionary).duplicate(true)
			var canonical: Dictionary = entry.get("canonicalV3", {}) as Dictionary
			if canonical.is_empty(): return {"ok":false, "error":"server_snapshot_missing", "character_id":str(entry.get("characterId", ""))}
			entry["id"] = str(entry.get("characterId", entry.get("id", "")))
			normalized.append(entry)
	var merged: Dictionary = card.duplicate(true)
	merged["nickname"] = str(server_card.get("nickname", merged.get("nickname", "")))
	merged["stored_characters"] = normalized
	var owned: Array[String] = []
	for entry: Dictionary in normalized:
		var id: String = str(entry.get("characterId", entry.get("id", "")))
		if not id.is_empty(): owned.append(id)
	merged["owned_character_ids"] = owned
	merged["server_revision"] = int(server_card.get("revision", 0))
	if not bool(LOGIN_CARD_CHARACTER_CACHE.call("replace_active_card", card_id, normalized)): return {"ok":false, "error":"character_cache_write_failed"}
	for index: int in _cards.size():
		if str(_cards[index].get("id", "")) == card_id:
			_cards[index] = merged
			return {"ok":_save_state(), "card":merged.duplicate(true), "source":"server"}
	return {"ok":false, "error":"active_card_missing"}

## 只删除当前登录卡自行保存的角色快照；内置角色库不受影响。
func remove_active_card_characters(character_ids: Array[String]) -> Dictionary:
	if _active_card_id.is_empty(): return {"ok":false, "error":"active_card_missing"}
	var wanted: Dictionary = {}
	for raw_id: String in character_ids:
		var id: String = raw_id.strip_edges()
		if not id.is_empty(): wanted[id] = true
	if wanted.is_empty(): return {"ok":false, "error":"character_ids_missing"}
	for index: int in _cards.size():
		if str(_cards[index].get("id", "")) != _active_card_id: continue
		var kept: Array = []
		var removed: int = 0
		for raw: Variant in _cards[index].get("stored_characters", []) as Array:
			var entry: Dictionary = raw as Dictionary if raw is Dictionary else {}
			var character_id: String = str(entry.get("id", entry.get("characterId", ""))).strip_edges()
			if wanted.has(character_id): removed += 1
			else: kept.append(raw)
		_cards[index]["stored_characters"] = kept
		var owned: Array = []
		for raw_id: Variant in _cards[index].get("owned_character_ids", []) as Array:
			if not wanted.has(str(raw_id)): owned.append(raw_id)
		_cards[index]["owned_character_ids"] = owned
		if not bool(LOGIN_CARD_CHARACTER_CACHE.call("replace_active_card", _active_card_id, kept)):
			return {"ok":false, "error":"character_cache_write_failed"}
		return {"ok":_save_state(), "removed":removed}
	return {"ok":false, "error":"active_card_missing"}

## 转盘等离线产出通过此入口进入当前登录卡的持久角色表；即使远端 API
## 尚未接入，重启后也不会只剩一次性的运行时缓存。
func append_local_character_snapshot(raw_snapshot: Dictionary) -> Dictionary:
	if raw_snapshot.is_empty(): return {"ok":false, "error":"snapshot_missing"}
	if _active_card_id.is_empty(): create_local_normal_card()
	for index: int in _cards.size():
		if str(_cards[index].get("id", "")) != _active_card_id: continue
		var stored: Array = (_cards[index].get("stored_characters", []) as Array).duplicate(true)
		var id: String = str(raw_snapshot.get("characterId", raw_snapshot.get("id", ""))).strip_edges()
		if id.is_empty(): return {"ok":false, "error":"snapshot_id_missing"}
		var replaced: bool = false
		for stored_index: int in stored.size():
			if stored[stored_index] is Dictionary and str((stored[stored_index] as Dictionary).get("characterId", (stored[stored_index] as Dictionary).get("id", ""))) == id:
				stored[stored_index] = raw_snapshot.duplicate(true)
				replaced = true
				break
		if not replaced: stored.append(raw_snapshot.duplicate(true))
		_cards[index]["stored_characters"] = stored
		var owned: Array = _cards[index].get("owned_character_ids", []) as Array
		if not owned.has(id): owned.append(id)
		_cards[index]["owned_character_ids"] = owned
		if not bool(LOGIN_CARD_CHARACTER_CACHE.call("replace_active_card", _active_card_id, stored)):
			return {"ok":false, "error":"character_cache_write_failed"}
		return {"ok":_save_state(), "character_id":id}
	return {"ok":false, "error":"active_card_missing"}

func create_local_normal_card() -> Dictionary:
	var card: Dictionary = {
		"id": _next_card_id("local"),
		"nickname": "本地咒术师",
		"group_name": NORMAL_CARD_GROUP_NAME,
		"card_face_path": DEFAULT_CARD_FACE_PATH,
		"owned_character_ids": [DEFAULT_CHARACTER_ID],
		"stored_characters": [],
		"identity_provider": "local",
		"identity_status": "local_ready"
	}
	_cards.append(card)
	_active_card_id = str(card.get("id", ""))
	_save_state()
	return card.duplicate(true) as Dictionary

func begin_bilibili_registration() -> Dictionary:
	var response: Dictionary = _provider.call("begin_registration") as Dictionary
	if str(response.get("code", "")) != "online_service_unavailable":
		return response
	var pending_card: Dictionary = {
		"id": _next_card_id("bilibili-pending"),
		"nickname": "待 Bilibili 认证",
		"group_name": NORMAL_CARD_GROUP_NAME,
		"card_face_path": DEFAULT_CARD_FACE_PATH,
		"owned_character_ids": [DEFAULT_CHARACTER_ID],
		"stored_characters": [],
		"identity_provider": "bilibili",
		"identity_status": "pending_online"
	}
	_cards.append(pending_card)
	_save_state()
	response["pending_card"] = pending_card.duplicate(true)
	return response

func _next_card_id(prefix: String) -> String:
	var index: int = _cards.size() + 1
	var candidate: String = "%s-%d-%d" % [prefix, Time.get_unix_time_from_system(), index]
	while _has_card_id(candidate):
		index += 1
		candidate = "%s-%d-%d" % [prefix, Time.get_unix_time_from_system(), index]
	return candidate

func _has_card_id(card_id: String) -> bool:
	for card: Dictionary in _cards:
		if str(card.get("id", "")) == card_id:
			return true
	return false

func _load_state() -> void:
	_cards.clear()
	_active_card_id = ""
	_guest_session = false
	var config: ConfigFile = ConfigFile.new()
	if config.load(_storage_path) != OK:
		return
	# 兼容旧档案：早期版本曾把单张卡写成 Dictionary。账户文件是输入边界，
	# 不能在登录阶段强制转换并让整个登录页报错。
	var cards_value: Variant = config.get_value("account", "cards", [])
	var raw_cards: Array = cards_value as Array if cards_value is Array else []
	for raw_card: Variant in raw_cards:
		if raw_card is Dictionary:
			var card: Dictionary = _sanitize_card(raw_card as Dictionary)
			if not card.is_empty():
				_cards.append(card)
	var candidate_active_id: String = str(config.get_value("account", "active_card_id", ""))
	_guest_session = bool(config.get_value("account", "guest_session", false))
	for card: Dictionary in _cards:
		if str(card.get("id", "")) == candidate_active_id:
			_active_card_id = candidate_active_id
			_guest_session = false
			LOGIN_CARD_CHARACTER_CACHE.call("replace_active_card", candidate_active_id, card.get("stored_characters", []) as Array)
			return
	LOGIN_CARD_CHARACTER_CACHE.call("clear_active_card")

func _save_state() -> bool:
	var config: ConfigFile = ConfigFile.new()
	config.set_value("account", "active_card_id", _active_card_id)
	config.set_value("account", "guest_session", _guest_session)
	config.set_value("account", "cards", _cards)
	return config.save(_storage_path) == OK

func _sanitize_card(raw_card: Dictionary) -> Dictionary:
	for key: String in SENSITIVE_KEYS:
		if raw_card.has(key):
			return {}
	var id: String = str(raw_card.get("id", "")).strip_edges()
	if id.is_empty():
		return {}
	var owned: Array[String] = []
	for raw_id: Variant in raw_card.get("owned_character_ids", []) as Array:
		var character_id: String = str(raw_id).strip_edges()
		if not character_id.is_empty() and not owned.has(character_id):
			owned.append(character_id)
	var stored_characters: Array[Dictionary] = []
	for raw_character: Variant in raw_card.get("stored_characters", []) as Array:
		if not raw_character is Dictionary:
			continue
		var character: Dictionary = (raw_character as Dictionary).duplicate(true)
		if str(character.get("id", "")).strip_edges().is_empty():
			continue
		stored_characters.append(character)
	return {
		"id": id,
		"nickname": str(raw_card.get("nickname", "待认证咒术师")).strip_edges(),
		"group_name": str(raw_card.get("group_name", NORMAL_CARD_GROUP_NAME)).strip_edges(),
		"card_face_path": str(raw_card.get("card_face_path", DEFAULT_CARD_FACE_PATH)).strip_edges(),
		"owned_character_ids": owned,
		"stored_characters": stored_characters,
		"identity_provider": str(raw_card.get("identity_provider", "local")).strip_edges(),
		"identity_status": str(raw_card.get("identity_status", "local_ready")).strip_edges()
	}

## PNG 登录卡的角色快照可完整保留战斗资料，但不能把服务器凭据写入本地账户或缓存。
func _strip_snapshot_secrets(value: Variant) -> Variant:
	if value is Dictionary:
		var result: Dictionary = {}
		for raw_key: Variant in (value as Dictionary).keys():
			var key: String = str(raw_key)
			var normalized: String = key.to_lower().replace("-", "_")
			if SENSITIVE_KEYS.has(normalized) or normalized == "accesstoken": continue
			result[key] = _strip_snapshot_secrets((value as Dictionary)[raw_key])
		return result
	if value is Array:
		var result_array: Array = []
		for item: Variant in value as Array: result_array.append(_strip_snapshot_secrets(item))
		return result_array
	return value

