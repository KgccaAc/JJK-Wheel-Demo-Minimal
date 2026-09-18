extends SceneTree

func _initialize() -> void:
	call_deferred("_run")

func _run() -> void:
	var audio := root.get_node_or_null("AudioManager")
	if audio == null:
		print("AUDIO_LOOP_ACCEPTANCE FAIL audio_missing")
		quit(1)
		return
	var player := audio.get("_music_player") as AudioStreamPlayer
	var old_stream := player.stream
	var old_path := str(audio.get("_current_music_path"))
	var old_enabled := bool(audio.call("music_enabled"))
	var old_playing := player.playing
	audio.call("_save_audio_setting", "music_enabled", true)
	player.stream = AudioStreamGenerator.new()
	audio.set("_current_music_path", "acceptance://loop")
	player.stop()
	var connected := player.finished.is_connected(Callable(audio, "_on_music_finished"))
	audio.call("_on_music_finished")
	await process_frame
	var restarted := player.playing
	player.stop()
	player.stream = old_stream
	audio.set("_current_music_path", old_path)
	audio.call("_save_audio_setting", "music_enabled", old_enabled)
	if old_playing and old_stream != null: player.play()
	var passed := connected and restarted
	print("AUDIO_LOOP_ACCEPTANCE %s connected=%s restarted=%s" % ["PASS" if passed else "FAIL", connected, restarted])
	quit(0 if passed else 1)
