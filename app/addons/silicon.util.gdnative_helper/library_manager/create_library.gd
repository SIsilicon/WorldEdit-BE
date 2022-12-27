tool
extends ConfirmationDialog

onready var main: Control = get_parent()
onready var library_path: String = $Container/Path/FileEdit.path
onready var language: String = $Container/Language/OptionButton.get_item_text($Container/Language/OptionButton.get_selected_id())

func _ready() -> void:
	get_ok().text = "Create"


func _on_about_to_show() -> void:
	update_configuration()


func _on_Language_item_selected(index: int) -> void:
	language = $Container/Language/OptionButton.get_item_text(index)
	update_configuration()


func _on_FileEdit_path_changed(path: String) -> void:
	library_path = path
	update_configuration()


func _on_confirmed() -> void:
	var file_path: String = library_path.replacen("gdnlib", "")
	file_path += "gdnlib"
	var lib_name: String = library_path.get_file().replace(".gdnlib", "")
	
	main.solution.create_library(file_path, language)
	main.save_solution()
	main.editor_file_system.scan()
	main.reload_list()
	hide()


func update_configuration() -> void:
	var message := ""
	var valid := true
	
	if library_path.get_file().is_valid_filename():
		message += "[color=#44FF44]- Library path/name is valid.[/color]\n"
	else:
		message += "[color=#FF0000]- Library path/name is invalid![/color]\n"
		valid = false
	
	if not library_path.get_extension() == "gdnlib":
		message += "[color=#FF0000]- The extension is not of a GDNativeLibrary(gdnlib)![/color]\n"
		valid = false
	
	if main.languages[language].build_path.empty():
		message += "[color=#FF0000]- Selected language has no build script!"
		valid = false
	
	$Container/Config.bbcode_text = message
	get_ok().disabled = not valid
