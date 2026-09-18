class_name SourceCompatibleRng
extends RefCounted

const UINT32_MASK: int = 0xffffffff
const UINT32_FLOAT: float = 4294967296.0

func fnv1a_32(value: String) -> int:
	var hash: int = 2166136261
	for index: int in value.length():
		hash = (hash ^ value.unicode_at(index)) & UINT32_MASK
		hash = (hash * 16777619) & UINT32_MASK
	return hash & UINT32_MASK

func online_roll(online_battle_seed: String, room_id: String, round_number: int, label: String, count: int) -> float:
	var seed: String = "online-deterministic-rng-v2|%s|%s|%d|%s|%d" % [online_battle_seed, room_id, max(1, round_number), label, max(1, count)]
	return float(fnv1a_32(seed)) / UINT32_FLOAT

