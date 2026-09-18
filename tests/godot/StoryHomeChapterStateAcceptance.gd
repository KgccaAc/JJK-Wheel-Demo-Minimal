extends SceneTree

func _initialize() -> void:
	call_deferred("_run")

func _run() -> void:
	var story := root.get_node_or_null("StoryState")
	if story == null:
		print("STORY_HOME_CHAPTER_STATE_ACCEPTANCE FAIL story_missing")
		quit(1)
		return
	story.call("begin_from_identity", {"characterId":"chapter-label-test","displayName":"章节状态验收角色"})
	var unstarted := await _chapter_text()
	story.call("resolve_local", "chapter1_intro", "序章", "已完成序章。", {}, {}, "chapter1_selection", "acceptance")
	story.call("commit_pending")
	var progressing := await _chapter_text()
	story.call("resolve_local", "chapter1_battle", "河岸的低级咒灵", "战斗完成。", {}, {}, "chapter1_end", "acceptance")
	story.call("commit_pending")
	var completed := await _chapter_text()
	var passed := unstarted == "未开始" and not progressing.is_empty() and progressing != "未开始" and progressing != "第一章·仙台的异乡人" and completed == "第一章·仙台的异乡人"
	print("STORY_HOME_CHAPTER_STATE_ACCEPTANCE %s unstarted=%s progressing=%s completed=%s" % ["PASS" if passed else "FAIL", unstarted, progressing, completed])
	quit(0 if passed else 1)

func _chapter_text() -> String:
	var page := (load("res://scenes/story/StroyHome.tscn") as PackedScene).instantiate() as Control
	root.add_child(page)
	await process_frame
	var label := page.get_node_or_null("Chapter/Cheaper") as Label
	var value := label.text if label != null else ""
	page.queue_free()
	await process_frame
	return value
