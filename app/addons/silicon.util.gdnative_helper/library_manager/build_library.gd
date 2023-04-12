tool
extends ConfirmationDialog

signal finished()

const FileEdit = preload("res://addons/silicon.util.gdnative_helper/utils/file_edit.tscn")

const LOG_PATH = "res://addons/silicon.util.gdnative_helper/build_log.txt"

onready var main := get_parent()

var mutex := Mutex.new()
var thread := Thread.new()
var pending_tasks := []

var building_lib_item: TreeItem
var prev_build_failed := false

func _ready() -> void:
	connect("finished", self, "finish_task")


func _notification(what: int) -> void:
	if what == NOTIFICATION_THEME_CHANGED:
		$Container/Header/Label.get_stylebox("normal").bg_color = get_color("prop_category", "Editor") * 1.2


func _exit_tree() -> void:
	if thread.is_active():
		thread.wait_to_finish()
	
	var dir := Directory.new()
	dir.remove(LOG_PATH)


func _on_build_options_changed(value, option: String) -> void:
	var library: Dictionary = main.solution.libraries[main.current_library_item.get_meta("name")]
	library.build_options[option] = value


func _on_about_to_show() -> void:
	var library: String = main.current_library_item.get_meta("name")
	update_targets_gui()
	generate_build_gui(library)


func _on_Architectures_toggled(button_pressed: bool, platform: String, arch: String) -> void:
	var platforms: Dictionary = main.solution.platform_archs
	
	if button_pressed and not platforms[platform].has(arch):
		platforms[platform].append(arch)
	elif not button_pressed and platforms[platform].has(arch):
		platforms[platform].erase(arch)


func _on_Target_pressed(target: String) -> void:
	self.target = target


func _on_confirmed() -> void:
	main.save_solution()


func build_current_lib() -> void:
	var task := {
		platforms = main.solution.platform_archs,
		target = "debug" if main.solution.debug_mode else "release",
		lib_item = main.current_library_item
	}
	
	if building_lib_item:
		pending_tasks.append(task)
	else:
		main.error_logs.clear()
		
		if thread.is_active():
			thread.wait_to_finish()
		thread.start(self, "build", task)


func generate_build_gui(lib_name: String) -> void:
	var library: Dictionary = main.solution.libraries[lib_name]
	var language: String = library.language
	
	var file := File.new()
	assert(file.open(main.languages[language].config_path, File.READ) == OK)
	var config: Dictionary = parse_json(file.get_as_text())
	var config_options: Dictionary = config.get("build_options", {})
	file.close()
	
	for option in config_options:
		if not library.build_options.has(option):
			library.build_options[option] = config_options[option].value
	
	var options_container := $Container/Options/VBox
	for child in options_container.get_children():
		child.queue_free()
	
	for name in config_options:
		var option: Dictionary = config_options[name]
		var value = library.build_options[name]
		var control: Control
		match typeof(option.value):
			TYPE_BOOL:
				control = CheckBox.new()
				control.pressed = value
				control.text = "On"
				control.connect("toggled", self, "_on_build_options_changed", [name])
			TYPE_STRING:
				if option.has("hint") and option.hint.find("FOLDER") != -1:
					control = FileEdit.instance()
					control.mode = FileDialog.MODE_OPEN_DIR
					control.file_dialog_node = $FileDialog
					control.path = value
					control.connect("path_changed", self, "_on_build_options_changed", [name])
				else:
					control = LineEdit.new()
					control.text = value
					control.connect("text_changed", self, "_on_build_options_changed", [name])
			TYPE_REAL:
				if option.has("hint") and option.hint.find("ENUM") != -1:
					control = OptionButton.new()
					var items: Array = option.get("hint_string", "").split(",")
					for item in items:
						control.add_item(item)
					control.selected = value
					control.connect("item_selected", self, "_on_build_options_changed", [name])
				else:
					control = SpinBox.new()
					var hints: Array = option.get("hint_string", "").split(",")
					for i in hints.size():
						if i == 0:
							control.min_value = int(hints[0])
						elif 1 == 1:
							control.max_value = int(hints[1])
						else:
							break
					if "allow_greater" in hints:
						control.allow_greater = true
					if "allow_lesser" in hints:
						control.allow_greater = true
					control.value = value
					control.connect("value_changed", self, "_on_build_options_changed", [name])
		
		if control:
			var hbox := HBoxContainer.new()
			var label := Label.new()
			label.hint_tooltip = option.get("description", "")
			control.size_flags_horizontal = SIZE_EXPAND_FILL
			control.rect_clip_content = true
			hbox.size_flags_horizontal = SIZE_EXPAND_FILL
			label.size_flags_horizontal = SIZE_EXPAND_FILL
			label.clip_text = true
			label.mouse_filter = MOUSE_FILTER_STOP
			label.text = name.capitalize()
			hbox.add_child(label)
			hbox.add_child(control)
			options_container.add_child(hbox)


func update_targets_gui() -> void:
	var platform_archs: Dictionary = main.solution.platform_archs
	for button in get_tree().get_nodes_in_group("__native_arch_buttons__"):
		var platform: String = {
			"Windows": "windows",
			"MacOS": "osx",
			"Linux": "linux",
			"Android": "android",
			"IOS": "ios"
		}[button.get_parent().name]
		
		var arch: String = {
			"86": "x86",
			"86_64": "x86_64",
			"arm7": "armv7",
			"arm8": "arm64v8"
		}.get(button.name, button.name)
		
		button.pressed = arch in platform_archs[platform]


func build(data: Dictionary) -> int:
	var platforms: Dictionary = data.platforms
	var target: String = data.target
	
	building_lib_item = data.lib_item
	prev_build_failed = false
	
	var library: Dictionary = main.solution.libraries[building_lib_item.get_meta("name")]
	var language: Dictionary = main.languages.get(library.language, null)
	
	var library_name: String = library.name
	var build_path: String = language.build_path
	var library_path: String = library.data_folder
	var lib_config: ConfigFile = library.native_lib.config_file
	
	# Check for python
	var python := "python" if OS.has_feature("Windows") else "python3"
	if OS.execute(python, ["--version"], true, []):
		printerr("Python isn't installed or not part of your environment variables!")
		printerr("Please setup python and restart the editor after that.")
		call_deferred("finish_task")
		return ERR_DOES_NOT_EXIST
	
	# Write the build options to a file for the build script to read
	var build_data_file := File.new()
	var err := build_data_file.open("res://addons/silicon.util.gdnative_helper/build_config.json", File.WRITE)
	if err:
		printerr("Failed to transfer build options to builder script!")
		call_deferred("finish_task")
		return err
	var build_options: Dictionary = library.build_options
	build_options.godot_version = str(Engine.get_version_info().major) + "." + str(Engine.get_version_info().minor)
	build_data_file.store_string(to_json(build_options))
	build_data_file.close()
	
	var err_lines := []
	var warning_lines := []
	
	# Loop through all the selected architectures and compile each
	for platform in platforms:
		var archs: Array = platforms[platform]
		for arch in archs:
			print("building '%s' (%s, %s, %s)." % [library_name, platform, arch, target])
			main.set_build_status_icon(building_lib_item, get_icon("Progress1", "EditorIcons"))
			var extension: String = {
				windows = "dll",
				osx = "dylib",
				linux = "so",
				android = "so",
				ios = "a"
			}[platform]
			
			var output := []
			var exit := OS.execute(python, [
				ProjectSettings.globalize_path("res://addons/silicon.util.gdnative_helper/main_build.py"),
				build_path.get_base_dir(),
				library_name,
				ProjectSettings.globalize_path("%s/bin/lib-%s.%s.%s.%s" % [library_path, library_name, platform, target, arch]),
				ProjectSettings.globalize_path(library_path),
				extension, platform,
				arch, target
			], true, output, true)
			
			for line in output[0].split("\n"):
				if line.find("error") != -1:
					main.error_logs.push_error(line)
				elif line.find("warning") != -1:
					main.error_logs.push_warning(line)
			
			var build_logs := File.new()
			build_logs.open(LOG_PATH, File.WRITE_READ)
			build_logs.seek_end()
			build_logs.store_line("%s (%s, %s, %s)." % [library_name, platform, arch, target])
			build_logs.store_string(output[0])
			build_logs.store_line("\n")
			
			if exit:
				prev_build_failed = true
				call_deferred("finish_task")
				return ERR_COMPILATION_FAILED
			
			var lib_name: String = {
				windows_32 = "Windows.32",
				windows_64 = "Windows.64",
				osx_64 = "OSX.64",
				linux_32 = "X11.32",
				linux_64 = "X11.64",
				android_armv7 = "Android.armeabi-v7a",
				android_arm64v8 = "Android.arm64-v8a",
				android_x86 = "Android.x86",
				android_x86_64 = "Android.x86_64",
				ios_armv7 = "iOS.armv7",
				ios_arm64v8 = "iOS.arm64"
			}[platform + "_" + arch]
			
			lib_config.set_value("entry", lib_name, "%s/bin/lib-%s.%s.%s.%s.%s" % [library.data_folder, library_name, platform, target, arch, extension])
			lib_config.save(library.native_lib.resource_path)
	
	print("Built '%s' successfully!" % library_name)
	call_deferred("finish_task")
	return OK


func finish_task() -> void:
	var err: int = thread.wait_to_finish()
	OS.request_attention()
	main.set_build_status_icon(building_lib_item, get_icon("StatusError" if err else "StatusSuccess", "EditorIcons"))
	building_lib_item = null
	if not pending_tasks.empty():
		var next_task: Dictionary = pending_tasks.pop_back()
		thread.start(self, "build", next_task)
