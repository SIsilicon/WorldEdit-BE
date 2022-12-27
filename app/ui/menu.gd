extends VBoxContainer

signal back_pressed

var active := false
var menu: Control

export var ui: PackedScene
export var menu_name: String


func _enter_tree() -> void:
	hide()


func _gui_input(event: InputEvent) -> void:
	if active and event.is_action("ui_cancel"):
		accept_event()
		emit_signal("back_pressed")


func enter() -> void:
	if active:
		return
	
	if $Panel.get_child_count():
		$Panel.get_child(0).queue_free()
	menu = ui.instance()
	$Panel.add_child(menu)
	$Top/Label.text = menu_name
	
	$Tween.interpolate_property(self, "rect_position:x", rect_size.x, 0, 0.5, Tween.TRANS_QUAD, Tween.EASE_OUT)
	$Tween.start()
	show()
	active = true


func exit() -> void:
	if not active:
		return
	
	$Tween.interpolate_property(self, "rect_position:x", 0, rect_size.x, 0.5, Tween.TRANS_QUAD, Tween.EASE_OUT)
	$Tween.interpolate_callback(self, 0.5, "hide")
	$Tween.start()
	release_focus()
	active = false


func _on_Back_pressed() -> void:
	emit_signal("back_pressed")
