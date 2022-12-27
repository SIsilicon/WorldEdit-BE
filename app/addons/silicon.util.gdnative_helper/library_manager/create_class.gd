tool
extends ConfirmationDialog

onready var main: Control = get_parent()
onready var cls_inherit: String = $Container/Inherit/LineEdit.text
onready var cls_path: String = $Container/Path/FileEdit.path
onready var cls_name: String = $Container/Name/LineEdit.text


func _ready() -> void:
	get_ok().text = "Create"


func _on_about_to_show() -> void:
	update_configuration()


func _on_FileEdit_path_changed(path: String) -> void:
	cls_path = path
	update_configuration()


func _on_confirmed() -> void:
	var file_path: String = cls_path.replacen("gdns", "")
	file_path += "gdns"
	var lib_item: TreeItem = main.current_library_item
	var lib_name: String = lib_item.get_meta("name")
	
	main.solution.create_class(lib_name, cls_name, cls_path, cls_inherit)
	main.save_solution()
	main.editor_file_system.scan()
	main.reload_list()
	hide()


func _on_LineEdit_name_changed(new_text: String) -> void:
	cls_name = new_text
	update_configuration()


func _on_LineEdit_inherit_changed(new_text: String) -> void:
	cls_inherit = new_text
	update_configuration()


func update_configuration() -> void:
	var message := ""
	var class_name_taken: bool = main.solution.class_exists(cls_name)
	
	var file := File.new()
	
	if not cls_path.get_file().is_valid_filename():
		message += "[color=#FF0000]- Class path is invalid![/color]\n"
	elif not cls_path.get_extension() == "gdns":
		message += "[color=#FF0000]- The extension is not of a NativeScript(gdns)![/color]\n"
	elif file.file_exists(cls_path):
		message += "[color=#FF0000]- A script at this path already exists![/color]\n"
	else:
		message += "[color=#44FF44]- Class path is valid.[/color]\n"
	
	if not ClassDB.class_exists(cls_inherit):
		message += "[color=#FF0000]- Inherited builtin class does not exist![/color]\n"
	
	if not cls_name.is_valid_identifier():
		message += "[color=#FF0000]- Invalid class name![/color]\n"
	elif ClassDB.class_exists(cls_name):
		message += "[color=#FF0000]- Class name is the same as a builtin class![/color]\n"
	elif class_name_taken:
		message += "[color=#FF0000]- Class name is already used in this project![/color]\n"
	else:
		message += "[color=#44FF44]- Class name is valid.[/color]\n"
	
	var valid = message.count("[color=#FF0000]") == 0
	$Container/Config.bbcode_text = message
	get_ok().disabled = not valid
