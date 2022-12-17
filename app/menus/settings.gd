extends Control

signal setting_changed(setting, value)

func _ready() -> void:
	$"%AutoProcess".pressed = Appdata.get_appdata(Appdata.AUTO_PROCESS_WORLDS, false)


func _on_AutoProcess_toggled(button_pressed: bool) -> void:
	Appdata.set_appdata(Appdata.AUTO_PROCESS_WORLDS, button_pressed)
	emit_signal("setting_changed", Appdata.AUTO_PROCESS_WORLDS, button_pressed)


func _on_Docs_pressed() -> void:
	OS.shell_open("https://worldedit-be-docs.readthedocs.io/en/stable/usage/worldedit_app/")


func _on_Licenses_pressed() -> void:
	OS.shell_open("https://github.com/SIsilicon/WorldEdit-BE/blob/master/COPYRIGHTS.txt")


func _on_Donation_pressed() -> void:
	OS.shell_open("https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=XXXJ5ETNT5PSN")
