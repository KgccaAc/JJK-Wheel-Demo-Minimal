class_name OnlineBattleStateHasher
extends RefCounted

## Two clients intentionally render themselves as actor 0.  A receipt hash
## therefore normalizes actor order by immutable character identity before
## hashing; UI left/right placement must not masquerade as a rules desync.
static func canonical_hash(snapshot: Dictionary) -> String:
	var copy: Dictionary = snapshot.duplicate(true)
	copy.erase("state_hash")
	copy.erase("revision")
	var actors: Array = copy.get("actors", []) as Array
	actors.sort_custom(func(a: Variant, b: Variant) -> bool:
		return _actor_key(a as Dictionary) < _actor_key(b as Dictionary)
	)
	copy["actors"] = actors
	# These are local/cpu presentation aliases; actor zones remain canonical.
	copy.erase("normal_hand")
	copy.erase("cpu_hand")
	copy.erase("last_cpu_actions")
	var context := HashingContext.new()
	context.start(HashingContext.HASH_SHA256)
	context.update(JSON.stringify(_canonical_value(copy)).to_utf8_buffer())
	return context.finish().hex_encode()

## V3 input-room compatibility receipt.  Clients render opposite sides locally,
## so a raw state hash is not comparable until the server owns a canonical role
## order.  This hashes the revealed, server-authoritative input package instead.
static func revealed_input_hash(turn: int, stage: String, inputs: Dictionary) -> String:
	var context := HashingContext.new()
	context.start(HashingContext.HASH_SHA256)
	context.update(JSON.stringify(_canonical_value({"turn":turn, "stage":stage, "inputs":inputs})).to_utf8_buffer())
	return context.finish().hex_encode()

static func _actor_key(actor: Dictionary) -> String:
	var profile: Dictionary = actor.get("profile", {}) as Dictionary
	return str(profile.get("id", actor.get("id", actor.get("name", ""))))

static func _canonical_value(value: Variant) -> Variant:
	if value is Dictionary:
		var dictionary: Dictionary = value as Dictionary
		var keys: Array = dictionary.keys()
		keys.sort()
		var ordered: Dictionary = {}
		for key: Variant in keys: ordered[key] = _canonical_value(dictionary[key])
		return ordered
	if value is Array:
		var output: Array = []
		for entry: Variant in value: output.append(_canonical_value(entry))
		return output
	return value

