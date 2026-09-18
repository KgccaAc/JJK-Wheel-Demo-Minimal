class_name LoginCardPngCodec
extends RefCounted

## 与源项目 login-card.js 兼容：读取 PNG tEXt/zTXt 的 jjk-login-card JSON。
const TEXT_KEYWORD := "jjk-login-card"
const SCHEMA := "jjk-login-card"

static func extract(path: String) -> Dictionary:
	var file: FileAccess = FileAccess.open(path, FileAccess.READ)
	if file == null: return {"ok":false, "error":"source_file_missing"}
	var bytes: PackedByteArray = file.get_buffer(file.get_length())
	return extract_bytes(bytes)

static func extract_bytes(bytes: PackedByteArray) -> Dictionary:
	if bytes.size() < 12 or not _has_png_signature(bytes): return {"ok":false, "error":"not_png"}
	var offset: int = 8
	while offset + 12 <= bytes.size():
		var length: int = _uint32(bytes, offset)
		var data_start: int = offset + 8
		var data_end: int = data_start + length
		if length < 0 or data_end + 4 > bytes.size(): return {"ok":false, "error":"png_incomplete"}
		var kind: String = bytes.slice(offset + 4, offset + 8).get_string_from_ascii()
		if kind == "tEXt":
			var data: PackedByteArray = bytes.slice(data_start, data_end)
			var zero: int = data.find(0)
			if zero > 0 and data.slice(0, zero).get_string_from_utf8() == TEXT_KEYWORD:
				return _parse_payload(data.slice(zero + 1).get_string_from_utf8())
		elif kind == "zTXt":
			var compressed_data: PackedByteArray = bytes.slice(data_start, data_end)
			var separator: int = compressed_data.find(0)
			if separator > 0 and compressed_data.slice(0, separator).get_string_from_utf8() == TEXT_KEYWORD:
				# PNG zTXt = keyword + NUL + compression-method(0/zlib) + deflate bytes.
				if separator + 2 > compressed_data.size() or int(compressed_data[separator + 1]) != 0:
					return {"ok":false, "error":"login_payload_compression_unsupported"}
				var inflated: PackedByteArray = compressed_data.slice(separator + 2).decompress(2 * 1024 * 1024, FileAccess.COMPRESSION_DEFLATE)
				if inflated.is_empty(): return {"ok":false, "error":"login_payload_decompression_failed"}
				return _parse_payload(inflated.get_string_from_utf8())
		offset = data_end + 4
		if kind == "IEND": break
	return {"ok":false, "error":"login_payload_missing"}

static func _parse_payload(text: String) -> Dictionary:
	var raw: String = text.strip_edges()
	if raw.begins_with("base64:"): raw = Marshalls.base64_to_utf8(raw.trim_prefix("base64:"))
	var decoded: Variant = JSON.parse_string(raw)
	if not decoded is Dictionary: return {"ok":false, "error":"payload_invalid"}
	var payload: Dictionary = decoded as Dictionary
	if str(payload.get("schema", "")) != SCHEMA: return {"ok":false, "error":"unsupported_login_card_schema"}
	return {"ok":true, "payload":payload.duplicate(true)}

static func _uint32(bytes: PackedByteArray, offset: int) -> int:
	return (int(bytes[offset]) << 24) | (int(bytes[offset + 1]) << 16) | (int(bytes[offset + 2]) << 8) | int(bytes[offset + 3])

static func _has_png_signature(bytes: PackedByteArray) -> bool:
	var signature := [137, 80, 78, 71, 13, 10, 26, 10]
	for index: int in signature.size():
		if int(bytes[index]) != int(signature[index]): return false
	return true

