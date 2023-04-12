extends WindowDialog

const LevelDB = preload("res://leveldb_ref.gdns")

var world_index := 0


func update_list() -> void:
	var worlds := []
	var dir := Directory.new()
	var worlds_folder = Global.COM_MOJANG[world_index] + Global.WORLDS_FOLDER
	
	dir.open(worlds_folder)
	dir.list_dir_begin(true, true)
	var world_folder := dir.get_next()
	while world_folder:
		var absolute_path: String = (worlds_folder).plus_file(world_folder)
		if dir.file_exists(absolute_path + "/level.dat"):
			worlds.append(absolute_path)
		world_folder = dir.get_next()
	dir.list_dir_end()
	
	for child in $"%WorldList".get_children():
		child.queue_free()
	for world in worlds:
		var preview := preload("res://ui/WorldPreview.tscn").instance()
		preview.world_path = world
		preview.connect("pressed", self, "_on_world_preview_pressed", [world])
		$"%WorldList".add_child(preview)


func _on_PreviewWorlds_toggled(button_pressed: bool) -> void:
	world_index = int(button_pressed)
	update_list()


func _on_WindowDialog_about_to_show() -> void:
	$"%WorldPath".text = ""
	$"%ProcessWorld".disabled = true
	update_list()


func _on_WorldPath_text_changed(new_text: String) -> void:
	$"%ProcessWorld".disabled = new_text.empty()


func _on_world_preview_pressed(world_path: String) -> void:
	$"%WorldPath".text = world_path
	$"%ProcessWorld".disabled = false


func _on_ProcessWorld_pressed() -> void:
	var world_path: String = $"%WorldPath".text
	var changes: Dictionary = get_parent().check_for_changes(world_path)
	
	if changes.empty():
		$"%NoProcessDialog".popup_centered()
		return
	
	var message := ""
	if changes.has("exports"):
		message = "There are %s structures waiting to be processed.\n" % changes.exports
	if changes.has("no_ref_actors"):
		message = "There are %s unreferenced entities.\n" % changes.no_ref_actors.size()
	if changes.has("biomes"):
		message = "There are some biome changes pending.\n"
	message += "Do you want to process this world?"
	
	$"%ConfirmProcessDialog".dialog_text = message
	$"%ConfirmProcessDialog".popup_centered()

