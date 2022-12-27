extends Popup


func set_message(text: String, show_progress := false) -> void:
	$VBoxContainer/Label.text = text
	$VBoxContainer/Loading.visible = show_progress
	hide()
	UI.set_popup(self)
	
	$VBoxContainer.margin_bottom = 0
	rect_size.y = $VBoxContainer.rect_size.y
	rect_size.x = $VBoxContainer.rect_size.x
	popup_centered()
