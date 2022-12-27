tool
extends Control

enum {
	OPTION_CREATE_LIB = 0,
	OPTION_CREATE_CLS = 1,
	OPTION_OPEN_SOURCE = 3,
	OPTION_OPEN_HEADER = 4,
	OPTION_BUILD_OPTS = 6,
	OPTION_BUILD = 7,
	OPTION_DELETE = 9
}

signal console_requested

onready var tree: Tree = $VBoxContainer/HSplitContainer/Tree
onready var error_logs: Tree = $VBoxContainer/HSplitContainer/ErrorLogs
onready var popopts: PopupMenu = $VBoxContainer/HSplitContainer/Tree/PopupOpts

var languages := {}

var editor_file_system: EditorFileSystem
var data_dir: String
var tree_root: TreeItem

var current_library_item: TreeItem
var current_class_item: TreeItem

var solution_path := "res://native_solution.tres"
var solution: GDNativeSolution

func _ready() -> void:
	if not editor_file_system or not data_dir:
		return
	
	$VBoxContainer/HBoxContainer/Label.text = "Solution: " + solution_path
	
	popopts.set_item_icon(OPTION_CREATE_LIB, get_icon("GDNativeLibrary", "EditorIcons"))
	popopts.set_item_shortcut(OPTION_CREATE_LIB, key_shortcut(KEY_A, KEY_CONTROL))
	popopts.set_item_icon(OPTION_CREATE_CLS, get_icon("NativeScript", "EditorIcons"))
	popopts.set_item_shortcut(OPTION_CREATE_CLS, key_shortcut(KEY_A, KEY_CONTROL, KEY_SHIFT))
	popopts.set_item_icon(OPTION_BUILD_OPTS, get_icon("GDScript", "EditorIcons"))
	popopts.set_item_shortcut(OPTION_BUILD_OPTS, key_shortcut(KEY_B, KEY_SHIFT, KEY_CONTROL))
	popopts.set_item_icon(OPTION_BUILD, get_icon("Tools", "EditorIcons"))
	popopts.set_item_shortcut(OPTION_BUILD, key_shortcut(KEY_B, KEY_CONTROL))
	popopts.set_item_icon(OPTION_DELETE, get_icon("Remove", "EditorIcons"))
	popopts.set_item_shortcut(OPTION_DELETE, key_shortcut(KEY_DELETE))
	
	$VBoxContainer/HSplitContainer/CreateLib.icon = get_icon("Add", "EditorIcons")
	
	$VBoxContainer/HBoxContainer/Reload.icon = get_icon("Reload", "EditorIcons")
	
#	var err_node: TextEdit = $VBoxContainer/HSplitContainer/ErrorText
#	err_node.add_color_override("font_color_readonly", get_color("error_color", "Editor"))
#	err_node.add_stylebox_override("read_only", get_stylebox("normal", "Editor"))
#	err_node.add_stylebox_override("focus", get_stylebox("normal", "Editor"))
	
	if ResourceLoader.exists(solution_path):
		solution = load(solution_path)
	else:
		solution = GDNativeSolution.new()
	solution.languages = languages
	
	tree_root = tree.create_item()
#	tree.set_column_expand(1, false)
#	tree.set_column_min_width(1, 24)
	_on_Reload_pressed()
	scan_languages()


func _on_CreateLib_pressed() -> void:
	$CreateLibraryDialog.popup_centered()


func _on_DeleteLib_pressed(confirmed := false) -> void:
	if confirmed:
		solution.delete_library(current_library_item.get_meta("name"))
		save_solution()
		editor_file_system.scan()
		_on_Reload_pressed()
	else:
		$DeleteLibraryDialog.dialog_text = "Delete library \"%s\" and its classes? \n Its source files and the classes' will be deleted as well." % current_library_item.get_meta("name")
		$DeleteLibraryDialog.popup_centered()


func _on_Tree_item_selected() -> void:
	var item = tree.get_selected()
	if item.get_parent() == tree_root:
		current_library_item = tree.get_selected()
		current_class_item = null
	else:
		current_class_item = tree.get_selected()
		current_library_item = current_class_item.get_parent()
	update_buttons()


func _on_Tree_item_edited():
	print(tree.get_edited())


func _on_Tree_item_rmb_selected(position: Vector2) -> void:
	popopts.rect_position = position + tree.rect_global_position
	popopts.rect_global_position.y = min(popopts.rect_global_position.y, get_viewport().size.y - popopts.rect_size.y)
	popopts.show()


func _on_Tree_button_pressed(item: TreeItem, column: int, id: int) -> void:
	if id == 0:
		open_code(item, Input.is_key_pressed(KEY_SHIFT))
	elif id == 1:
		emit_signal("console_requested")


func _on_Reload_pressed() -> void:
	reload_list()


func _on_Debug_toggled(pressed: bool) -> void:
	solution.debug_mode = pressed


func _on_CreateClass_pressed() -> void:
	$CreateClassDialog.popup_centered_ratio(0.3)


func _on_DeleteClass_pressed(confirmed := false) -> void:
	if confirmed:
		solution.delete_class(current_class_item.get_meta("name"))
		save_solution()
		editor_file_system.scan()
		_on_Reload_pressed()
	else:
		$DeleteClassDialog.dialog_text = "Delete class \"%s\"? \n Its source files will be deleted as well." % current_class_item.get_meta("name")
		$DeleteClassDialog.popup_centered()


func _on_BuildIconUpdate_timeout() -> void:
	if not tree_root:
		return
	
	var lib_first_item := tree_root.get_next_visible(true)
	var lib_item := lib_first_item
	while lib_first_item:
		if lib_item.get_button_count(0) > 1:
			for i in range(0, 8):
				if lib_item.get_button(0, 1) == get_icon("Progress%d" % (i + 1), "EditorIcons"):
					set_build_status_icon(lib_item, get_icon("Progress%d" % ((i + 1) % 8 + 1), "EditorIcons"))
					break

		lib_item = tree_root.get_next_visible(true)
		if lib_item == lib_first_item:
			break


func _on_Tree_nothing_selected() -> void:
	current_library_item = null
	current_class_item = null


func _on_PopupOpts_focus_exited() -> void:
	popopts.hide()


func _on_Tree_gui_input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed:
		if event.scancode == KEY_DELETE:
			if current_class_item:
				_on_DeleteClass_pressed()
			elif current_library_item:
				_on_DeleteLib_pressed()
		if event.scancode == KEY_A and event.control:
			if current_library_item and event.shift:
				_on_CreateClass_pressed()
			else:
				_on_CreateLib_pressed()
		if event.scancode == KEY_B and event.control:
			if current_library_item:
				if event.shift:
					_on_Config_pressed()
				else:
					_on_Build_pressed()


func _on_PopupOpts_id_pressed(id: int) -> void:
	var is_class := current_class_item != null
	var item = current_class_item if is_class else current_library_item
	
	if id == OPTION_CREATE_LIB:
		_on_CreateLib_pressed()
	
	if not item:
		return
	
	match id:
		OPTION_CREATE_CLS:
			_on_CreateClass_pressed()
		OPTION_OPEN_SOURCE:
			open_code(item, false)
		OPTION_OPEN_HEADER:
			open_code(item, true)
		OPTION_BUILD_OPTS:
			_on_Config_pressed()
		OPTION_BUILD:
			_on_Build_pressed()
		OPTION_DELETE:
			if is_class:
				_on_DeleteClass_pressed()
			else:
				_on_DeleteLib_pressed()


func _on_Build_pressed() -> void:
	$BuildLibraryDialog.build_current_lib()


func _on_Config_pressed() -> void:
	$BuildLibraryDialog.popup_centered()


func _on_Log_pressed() -> void:
	var file := Directory.new()
	if file.file_exists($BuildLibraryDialog.LOG_PATH):
		OS.shell_open(ProjectSettings.globalize_path($BuildLibraryDialog.LOG_PATH))


func reload_list() -> void:
	var root := tree_root
	while root.get_children():
		var child := root.get_children()
		root.remove_child(child)
		child.free()
	
	# Load libraries
	var libraries := solution.libraries
	var script_msg := "Open Source File: %s\nHold shift to open Header File."
	for lib in libraries:
		var library = libraries[lib]
		var lib_item := tree.create_item(tree_root)
		lib_item.add_button(0, get_icon("Script", "EditorIcons"), 0, false, script_msg % library.source_file)
		lib_item.set_icon(0, get_icon("GDNativeLibrary", "EditorIcons"))
		lib_item.set_meta("source", library.source_file)
		lib_item.set_meta("header", library.header_file)
		lib_item.set_meta("name", lib)
		lib_item.set_text(0, lib)
		lib_item.set_editable(0, true)
#		lib_item.set_custom_draw(0, self, "tree_custom_draw")
#		lib_item.set_cell_mode(0, TreeItem.CELL_MODE_CUSTOM)
		lib_item.set_tooltip(0, "%s (%s)" % [lib, library.language])
		
		var classes: Array = library.classes
		for cls in classes:
			var cls_item := tree.create_item(lib_item)
			cls_item.add_button(0, get_icon("Script", "EditorIcons"), 0, false, script_msg % solution.class_abs_source_file(solution.classes[cls]))
			cls_item.set_icon(0, get_icon("NativeScript", "EditorIcons"))
			cls_item.set_meta("source", solution.class_abs_source_file(solution.classes[cls]))
			cls_item.set_meta("header", solution.class_abs_header_file(solution.classes[cls]))
			cls_item.set_meta("name", cls)
			cls_item.set_text(0, cls)
			cls_item.set_editable(0, true)
#			cls_item.set_custom_draw(0, self, "tree_custom_draw")
#			cls_item.set_cell_mode(0, TreeItem.CELL_MODE_CUSTOM)
	
	tree.visible = not libraries.empty()
	
	$BuildLibraryDialog/Container/Debug/CheckButton.pressed = solution.debug_mode
	$VBoxContainer/HSplitContainer/ErrorLogs.visible = not libraries.empty()
	$VBoxContainer/HSplitContainer/CreateLib.visible = libraries.empty()
	
	current_library_item = null
	current_class_item = null
	update_buttons()


func list_files_in_directory(path: String, extension: String) -> Array:
	var files := []
	var dir := Directory.new()
	if dir.open(path) == OK:
		dir.list_dir_begin()
		var file := dir.get_next()
		while file != "":
			if file.begins_with("."):
				file = dir.get_next()
				continue
			elif file.get_extension() == extension:
				files.append(file)
			elif dir.current_is_dir():
				files += list_files_in_directory(file, extension)
			file = dir.get_next()
	dir.list_dir_end()
	
	return files


func set_build_status_icon(library_item: TreeItem, icon: Texture) -> void:
	var tooltip: String = {
		get_icon("StatusError", "EditorIcons"): "Build failed! Check the console for errors.",
		get_icon("StatusSuccess", "EditorIcons"): "Build successful!",
		get_icon("Progress1", "EditorIcons"): "Building...",
		get_icon("Progress2", "EditorIcons"): "Building...",
		get_icon("Progress3", "EditorIcons"): "Building...",
		get_icon("Progress4", "EditorIcons"): "Building...",
		get_icon("Progress5", "EditorIcons"): "Building...",
		get_icon("Progress6", "EditorIcons"): "Building...",
		get_icon("Progress7", "EditorIcons"): "Building...",
		get_icon("Progress8", "EditorIcons"): "Building...",
		null: ""
	}.get(icon, "icon error")
	
	if library_item.get_button_count(0) > 1:
		library_item.erase_button(0, 1)
	library_item.add_button(0, icon, 1, false, tooltip)


func update_buttons() -> void:
	var library_selected := current_library_item != null
	var class_selected := current_class_item != null
	
	$VBoxContainer/HBoxContainer/Config.disabled = not library_selected
	$VBoxContainer/HBoxContainer/Build.disabled = not library_selected


func scan_languages() -> void:
	languages.clear()
	var dir := Directory.new()
	var lang_path_root: String = data_dir + '/' + "native_languages"
	if dir.open(lang_path_root):
		printerr("Could not open the language templates at %s!" % lang_path_root)
		return
	
	dir.list_dir_begin(true, true)
	var file_dir := dir.get_next()
	while file_dir:
		if not dir.current_is_dir():
			file_dir = dir.get_next()
			continue
		
		var language := {
			lib_templates = [],
			class_templates = [],
			build_path = ""
		}
		
		var lang_dir := Directory.new()
		lang_dir.open(dir.get_current_dir() + '/' + file_dir)
		lang_dir.list_dir_begin(true, true)
		var lang_file_dir := lang_dir.get_next()
		while lang_file_dir:
			if lang_dir.current_is_dir():
				lang_file_dir = lang_dir.get_next()
				continue
			
			var file_path = "%s/%s" % [lang_dir.get_current_dir(), lang_file_dir]
			
			if lang_file_dir.find("library_template") != -1:
				language.lib_templates.append(file_path)
			elif lang_file_dir.find("class_template") != -1:
				language.class_templates.append(file_path)
			elif lang_file_dir.find("build") != -1:
				language.build_path = file_path
			elif lang_file_dir.find("config.json") != -1:
				language.config_path = file_path
				
				var config_file := File.new()
				config_file.open(file_path, File.READ)
				var config: Dictionary = parse_json(config_file.get_as_text())
				language.source_extension = config.source_extension
				language.header_extension = config.get("header_extension", "")
				config_file.close()
			
			lang_file_dir = lang_dir.get_next()
		lang_dir.list_dir_end()
		
		languages[file_dir.get_basename()] = language
		
		file_dir = dir.get_next()
	dir.list_dir_end()


func save_solution() -> void:
	ResourceSaver.save(solution_path, solution, ResourceSaver.FLAG_CHANGE_PATH)


func open_code(item: TreeItem, is_header := false) -> void:
	var path: String
	if is_header:
		path = item.get_meta("header")
		if path.empty():
			$NoHeaderDialog.popup_centered()
			return
	else:
		path = item.get_meta("source")
	OS.shell_open(ProjectSettings.globalize_path(path))


func key_shortcut(key: int, modifier_0 := 0, modifier_1 := 0) -> ShortCut:
	var shortcut := ShortCut.new()
	shortcut.shortcut = InputEventKey.new()
	shortcut.shortcut.scancode = key
	if KEY_ALT in [modifier_0, modifier_1]:
		shortcut.shortcut.alt = true
	if KEY_SHIFT in [modifier_0, modifier_1]:
		shortcut.shortcut.shift = true
	if KEY_CONTROL in [modifier_0, modifier_1]:
		shortcut.shortcut.control = true
	return shortcut
