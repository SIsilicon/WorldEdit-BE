extends Node


var _popup: Popup


func _ready() -> void:
	$Panel.hide()


func set_popup(new_popup: Popup) -> void:
	if is_instance_valid(_popup) and new_popup != _popup:
		_on_popup_hide()
	
	_popup = new_popup
	add_child(_popup)
	_popup.connect("hide", self, "_on_popup_hide")
	$Panel.show()


func set_ui_blocked(blocked: bool) -> void:
	$Block.visible = blocked


func should_grab_focus(event: InputEvent) -> bool:
	return event.is_action("ui_up") or event.is_action("ui_down") or event.is_action("ui_left") or event.is_action("ui_right") or event.is_action("ui_focus_next") or event.is_action("ui_focus_prev")


func _on_popup_hide() -> void:
	if _popup.get_parent() == self:
		remove_child(_popup)
		_popup.disconnect("hide", self, "_on_popup_hide")
	$Panel.hide()
