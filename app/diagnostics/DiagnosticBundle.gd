class_name DiagnosticBundle
extends RefCounted

static func collect(context: Dictionary = {}) -> Dictionary:
	var stamp := "%s-%s" % [Time.get_unix_time_from_system(), randi()]
	var root := "user://logs/bundles/%s" % stamp
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(root))
	var paths: Array[String] = []
	for source: String in ["user://logs/current.jsonl", "user://logs/errors.jsonl"]:
		if not FileAccess.file_exists(source): continue
		var target := "%s/%s" % [root, source.get_file()]
		var input := FileAccess.open(source, FileAccess.READ)
		var output := FileAccess.open(target, FileAccess.WRITE)
		if input != null and output != null:
			output.store_buffer(input.get_buffer(input.get_length()))
			paths.append(target)
		if input != null: input.close()
		if output != null: output.close()
	var manifest := {"schema":"jjk-diagnostic-bundle-v1", "created_at":Time.get_datetime_string_from_system(true), "context":context, "files":paths}
	var manifest_path := "%s/manifest.json" % root
	var manifest_file := FileAccess.open(manifest_path, FileAccess.WRITE)
	if manifest_file != null:
		manifest_file.store_string(JSON.stringify(manifest, "\t"))
		manifest_file.close()
	paths.append(manifest_path)
	return {"schema":"jjk-diagnostic-bundle-v1", "created_at":manifest.created_at, "context":context, "log_paths":paths, "bundle_path":root, "manifest_path":manifest_path}
