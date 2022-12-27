extends Control

const previewUI = preload("res://ui/WorldPreview.tscn")

var process_dialog: Popup

func _ready() -> void:
	var worlds := []
	var dir := Directory.new()
	for com_mojang in Global.COM_MOJANG:
		var worlds_folder = com_mojang + Global.WORLDS_FOLDER
		
		dir.open(worlds_folder)
		dir.list_dir_begin(true, true)
		var world_folder := dir.get_next()
		while world_folder:
			var absolute_path: String = (worlds_folder).plus_file(world_folder)
			if dir.file_exists(absolute_path + "/level.dat"):
				worlds.append(absolute_path)
			world_folder = dir.get_next()
		dir.list_dir_end()
	worlds.sort_custom(self, "sort_worlds")
	
	for world in worlds:
		var preview: WorldPreviewButton = previewUI.instance()
		preview.world_path = world
		preview.connect("pressed", self, "_on_world_preview_pressed", [preview])
		$"%WorldsList".add_child(preview)
	
	process_dialog = preload("res://menus/ProcessDialog.tscn").instance()


func _gui_input(event: InputEvent) -> void:
	if UI.should_grab_focus(event) and not get_focus_owner():
		accept_event()
		if $"%WorldsList".get_child_count():
			$"%WorldsList".get_child(0).grab_focus()
		else:
			$AspectRatio/VBox/OpenFolder.grab_focus()


func open_world(world: MCWorld) -> void:
	UI.set_popup(process_dialog)
	process_dialog.open(world)


var modified_time_test := File.new()
func sort_worlds(a: String, b: String) -> bool:
	return modified_time_test.get_modified_time(b) < modified_time_test.get_modified_time(a)


func _on_world_preview_pressed(preview: WorldPreviewButton) -> void:
	open_world(preview.world)


func _on_SearchBar_text_entered(text: String) -> void:
	for world in $"%WorldsList".get_children():
		var name: String = world.get_node("Name").text
		world.visible = text.empty() or name.findn(text) != -1


func _on_OpenFolder_pressed() -> void:
	$SelectFolder.show()
	UI.set_ui_blocked(true)


func _on_SelectFolder_folder_selected(folder: String) -> void:
	UI.set_ui_blocked(false)
	if folder:
		open_world(MCWorld.new(folder))
