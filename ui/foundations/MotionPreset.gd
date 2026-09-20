class_name MotionPreset
extends Resource

@export var page_enter: float = 0.48
@export var page_leave: float = 0.24
@export var button_press: float = 0.12
@export var card_select: float = 0.16
@export var panel_open: float = 0.28
@export var panel_close: float = 0.20
@export var damage_hit: float = 0.34
@export var domain_activate: float = 0.72
@export var result_reveal: float = 0.44
@export var reduced_motion: bool = false

func duration(value: float) -> float:
	return 0.0 if reduced_motion else maxf(0.0, value)



