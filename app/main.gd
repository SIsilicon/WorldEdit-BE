extends Control


func _gui_input(event: InputEvent) -> void:
	if UI.should_grab_focus(event) and not get_focus_owner():
		accept_event()
		$MainUI/Menus/VBox/WorldsButton.grab_focus()


func hide_main_menu() -> void:
	$Tween.interpolate_property($MainUI, "modulate:a", 1.0, 0.0, 0.3)
	$Tween.interpolate_callback($MainUI, 0.3, "hide")
	$Tween.start()


func show_main_menu() -> void:
	$MainUI.show()
	$Tween.interpolate_property($MainUI, "modulate:a", 0.0, 1.0, 0.3)
	$MainUI/Menus/VBox/WorldsButton.grab_focus()
	$Tween.start()


func _on_WorldsButton_pressed() -> void:
	hide_main_menu()
	$WorldsMenu.enter()


func _on_SettingsButton_pressed() -> void:
	hide_main_menu()
	$SettingsMenu.enter()
	$SettingsMenu.menu.connect("setting_changed", self, "_on_setting_changed")


func _on_setting_changed(setting: String, value) -> void:
	if setting == Appdata.AUTO_PROCESS_WORLDS:
		$AutoProcessor.set_world_check_locked(not value)


func _on_WorldsMenu_back_pressed() -> void:
	$WorldsMenu.exit()
	show_main_menu()


func _on_SettingsMenu_back_pressed() -> void:
	$SettingsMenu.exit()
	show_main_menu()


func _on_Twitter_pressed() -> void:
	OS.shell_open("https://twitter.com/ISiliconS")


func _on_Youtube_pressed() -> void:
	OS.shell_open("https://youtube.com/@sisilicon14")
