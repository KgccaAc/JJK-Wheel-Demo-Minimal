extends RefCounted
class_name DifficultyPolicy
static func resolve_failure(difficulty: String, _node: StoryNode) -> String:
    return "run_dead" if difficulty == "ironman" else ("rollback_to_chapter" if difficulty == "standard" else "continue_with_injury")
