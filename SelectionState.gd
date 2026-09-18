extends Node

## 跨场景保存角色选择结果；不持有任何场景节点或战斗状态。
const DEFAULT_PLAYER_ID: String = "gojo_satoru_shinjuku"
const DEFAULT_OPPONENT_ID: String = "sukuna_heian_or_shinjuku"

var _player_id: String = DEFAULT_PLAYER_ID
var _opponent_id: String = DEFAULT_OPPONENT_ID

func set_characters(player_id: String, opponent_id: String) -> void:
	if not player_id.is_empty():
		_player_id = player_id
	if not opponent_id.is_empty():
		_opponent_id = opponent_id

func set_player_id(character_id: String) -> void:
	if not character_id.is_empty():
		_player_id = character_id

func set_opponent_id(character_id: String) -> void:
	if not character_id.is_empty():
		_opponent_id = character_id

func get_player_id() -> String:
	return _player_id

func get_opponent_id() -> String:
	return _opponent_id

func snapshot() -> Dictionary:
	return {"player_id": _player_id, "opponent_id": _opponent_id}

