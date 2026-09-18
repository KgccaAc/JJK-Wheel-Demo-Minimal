extends SceneTree

func _initialize() -> void:
	var story: Node = root.get_node_or_null("StoryState")
	if story == null:
		print("CHAPTER1_SELECTION_PROPAGATION_ACCEPTANCE FAIL story_state_missing")
		quit(1)
		return
	story.call("begin_from_identity", {"displayName":"选择传播验收角色"})
	story.call("begin_node", "chapter1_selection")
	var selection := (load("res://scenes/story/selection.tscn") as PackedScene).instantiate() as Control
	root.add_child(selection)
	await process_frame
	selection.call("_accumulate_outcome", {
		"text":"测试事件",
		"storyFlags":{"selection_propagated":true},
		"inventoryDelta":{"selection_token":1}
	})
	var flags: Dictionary = selection.get("accumulated_story_flags") if selection.get("accumulated_story_flags") is Dictionary else {}
	var inventory: Dictionary = selection.get("accumulated_inventory") if selection.get("accumulated_inventory") is Dictionary else {}
	var local_ok := bool(flags.get("selection_propagated", false)) and int(inventory.get("selection_token", 0)) == 1
	selection.call("_accumulate_outcome", {
		"text":"测试事件2",
		"storyFlags":{"selection_propagated_again":true},
		"inventoryDelta":{"selection_token":2}
	})
	flags = selection.get("accumulated_story_flags") if selection.get("accumulated_story_flags") is Dictionary else {}
	inventory = selection.get("accumulated_inventory") if selection.get("accumulated_inventory") is Dictionary else {}
	var merged_ok := bool(flags.get("selection_propagated_again", false)) and int(inventory.get("selection_token", 0)) == 3
	var passed := local_ok and merged_ok
	print("CHAPTER1_SELECTION_PROPAGATION_ACCEPTANCE %s local=%s merged=%s" % ["PASS" if passed else "FAIL", local_ok, merged_ok])
	quit(0 if passed else 1)
