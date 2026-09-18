class_name RoundSummaryPanel
extends PanelContainer

const RoundHistoryFormatterScript: Script = preload("res://battle/presentation/RoundHistoryFormatter.gd")

## 摘要只渲染已提交结果；回合推进由战斗流程统一处理。

@onready var title_label: Label = %Title
@onready var body_label: RichTextLabel = %Body

func show_round_package(package: Dictionary) -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	var summary: Dictionary = RoundHistoryFormatterScript.call("format", package) as Dictionary
	title_label.text = str(summary.get("title", "涓婁竴鍥炲悎绾"))
	body_label.text = str(summary.get("body", "鏃犲彲灞曠ず鐨勫洖鍚堢邯瑕?))



