extends Node

## Web builds do not have Windows' CJK fallback fonts. Install a bundled font
## before the first scene is built so every unstyled Label and Button can draw
## Chinese text consistently on desktop and in browsers.
const CJK_FALLBACK_FONT: FontFile = preload("res://art/fonts/NotoSerifCJKsc-Bold.otf")


func _enter_tree() -> void:
	ThemeDB.fallback_font = CJK_FALLBACK_FONT



