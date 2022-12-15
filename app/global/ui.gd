extends Node


var popup: Popup


func _ready() -> void:
	$Panel.hide()


func set_popup(popup: Popup) -> void:
	if self.popup && self.popup != popup:
		_on_popup_hide()
	
	self.popup = popup
	add_child(popup)
	popup.connect("hide", self, "_on_popup_hide")
	$Panel.show()


func set_ui_blocked(blocked: bool) -> void:
	$Block.visible = blocked


func should_grab_focus(event: InputEvent) -> bool:
	return event.is_action("ui_up") or event.is_action("ui_down") or event.is_action("ui_left") or event.is_action("ui_right") or event.is_action("ui_focus_next") or event.is_action("ui_focus_prev")


func _on_popup_hide() -> void:
	if popup.get_parent() == self:
		remove_child(popup)
		popup.disconnect("hide", self, "_on_popup_hide")
	$Panel.hide()
