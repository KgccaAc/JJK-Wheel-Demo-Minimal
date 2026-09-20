class_name CardAvailabilityResult
extends RefCounted

var playable: bool = true
var visible: bool = true
var reason: String = ""
## 规则拒绝原因用于日志和提交错误；UI 统一用此字段显示限制蒙版。
var ui_reason: String = ""
var ce_cost: float = 0.0
## Same pre-damage values used by the resolver; card UI can show dynamic output
## without reimplementing scaling or DSL locally.
var resolved_values: Dictionary = {}
var selection_mode: String = ""
var conflict_group: String = ""
var consumes_after_use: bool = false

