extends SceneTree

func _init() -> void:
	var page := Control.new()
	page.name = "NoticeHost"
	root.add_child(page)
	await process_frame
	ClientUi.notice(page, "联机验收", "提示样式应继承项目纹理。")
	await process_frame
	var dialog := page.get_node_or_null("ClientNotice") as AcceptDialog
	var ok_button: Button = dialog.get_ok_button() if dialog != null else null
	var panel_override := dialog != null and dialog.has_theme_stylebox_override("panel")
	var button_override := ok_button != null and ok_button.has_theme_stylebox_override("normal")
	var passed := dialog != null and panel_override and button_override
	print("CLIENT_NOTICE_TEXTURE_ACCEPTANCE %s dialog=%s class=%s panel_override=%s button=%s button_override=%s" % ["PASS" if passed else "FAIL", dialog != null, dialog.get_class() if dialog != null else "", panel_override, ok_button != null, button_override])
	quit(0 if passed else 1)
