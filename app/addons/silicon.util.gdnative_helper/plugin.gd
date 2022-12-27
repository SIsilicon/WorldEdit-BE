tool
extends EditorPlugin

var editor_settings: EditorSettings
var data_dir: String
var library_manager: Control

func _enter_tree() -> void:
	editor_settings = get_editor_interface().get_editor_settings()
	
	setup_default_languages()
	
	library_manager = preload("library_manager/library_manager.tscn").instance()
	library_manager.editor_file_system = get_editor_interface().get_resource_filesystem()
	library_manager.data_dir = data_dir
	library_manager.connect("console_requested", self, "_on_console_requested")
	add_control_to_bottom_panel(library_manager, "GDNative")
	
	get_editor_interface().get_script_editor().connect("editor_script_changed", self, "_on_editor_script_changed")


func _exit_tree() -> void:
	remove_control_from_bottom_panel(library_manager)


func _on_editor_script_changed(script: Script) -> void:
	if script is NativeScript:
		pass
#		var script_editor := get_editor_interface().get_script_editor()
#		var tab_container := script_editor.get_child(0).get_child(1).get_child(1)
#		var script_text_editor := tab_container.get_child(script_editor.get_open_scripts().find(script))
#		var text_edit: TextEdit = script_text_editor.get_child(0).get_child(0).get_child(0)
#		if not text_edit:
#			return
#
#		text_edit.syntax_highlighting = false
#		text_edit.breakpoint_gutter = false
#		text_edit.context_menu_enabled = false
#		text_edit.shortcut_keys_enabled = false
#		text_edit.readonly = true
#
#		var solution: GDNativeSolution = library_manager.solution
#		var classs: Dictionary = library_manager.solution.find_class_by_script(script)
#		var file := File.new()
#		file.open(solution.class_abs_source_file(classs), File.READ)
#		text_edit.text = "READONLY DATA! EDIT YOUR CODE SOMEWHERE ELSE.\n\n"
#		text_edit.text += file.get_as_text()
#		file.close()


func _on_console_requested() -> void:
	make_bottom_panel_item_visible(library_manager.get_parent().get_child(0))


func modify_dir(dir: Directory, from: String, to: String, mode := "copy") -> int:
	var original_dir := dir.get_current_dir()
	if not to.is_abs_path():
		to = original_dir + '/' + to
	dir.change_dir(from)
	
	dir.list_dir_begin(true, true)
	var path := dir.get_next()
	var err := 0
	while path:
		if dir.current_is_dir():
			var inner_dir := Directory.new()
			inner_dir.open(dir.get_current_dir())
			err = modify_dir(inner_dir, path, to + '/' + path, mode)
			if err:
				printerr("Failed to %s directory '%s' to '%s' from '%s'" % [mode, path, to + '/' + path, dir.get_current_dir()])
				break
		else:
			dir.make_dir_recursive(to)
			if mode == "copy":
				err = dir.copy(dir.get_current_dir() + '/' + path, to.plus_file(path))
			elif mode == "remove":
				err = dir.remove(dir.get_current_dir() + '/' + path)
			else:
				printerr("Invalid directory mode: %s" % mode)
				break
			
			if err:
				printerr("failed to %s file '%s' to '%s' from '%s'" % [mode, path, to + '/' + path, dir.get_current_dir()])
				break
		
		path = dir.get_next()
	dir.list_dir_end()
	if mode == "remove":
		err = dir.remove(dir.get_current_dir())
	dir.change_dir(original_dir)
	return err


func setup_default_languages() -> void:
	var plugin_dir := ProjectSettings.globalize_path("res://addons/silicon.util.gdnative_helper")
	var dir := Directory.new()
	dir.open(editor_settings.get_project_settings_dir())
	dir.change_dir("../..")
	data_dir = dir.get_current_dir()
	
	var debug_languages := File.new().file_exists("res://addons/silicon.util.gdnative_helper/.debug_languages")
	dir.open("file://")
	
	if dir.dir_exists(plugin_dir + '/' + "native_languages"):
		modify_dir(dir, plugin_dir + '/' + "native_languages", data_dir.plus_file("native_languages"), "copy")
		if not debug_languages:
			modify_dir(dir, plugin_dir + '/' + "native_languages", "", "remove")
