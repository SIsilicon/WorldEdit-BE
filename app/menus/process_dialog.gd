extends Popup

var world: MCWorld

var _changes: Dictionary
var _had_export_pack_created := false

var _check_task: String
var _process_task: String
var _processor := preload("res://world_processor.gd").new()

onready var process_button := $"%Process"
onready var details_text := $"%Details"

onready var progress_popup := $Popup

func _ready() -> void:
	Global.connect("task_finished", self, "_on_task_finished")
	remove_child(progress_popup)


func open(world: MCWorld) -> void:
	self.world = world
	world.open()
	$"%Title".text = world.get_name()
	$"%WorldImage".texture = world.get_image()
	popup_centered()
	
	$"%Loading".show()
	details_text.hide()
	process_button.disabled = true
	_check_task = Global.start_task(_processor, "check_for_changes", world)


func _on_task_finished(id: String, result) -> void:
	if id == _check_task:
		var changes := result as Dictionary
		
		$"%Loading".hide()
		details_text.show()
		details_text.text = ""
		
		if changes.empty():
			details_text.text += "Nothing here to process."
			return
		elif changes.has("err"):
			details_text.text += changes.err
			return
		
		process_button.disabled = false
		if changes.has("exports"):
			details_text.text += "- %s structures pending export.\n" % changes.exports.size()
		if changes.has("biomes"):
			details_text.text += "- Biome changes pending in %s subchunks.\n" % changes.biomes.size()
		_changes = changes
	
	elif id == _process_task:
		progress_popup.popup_exclusive = false
		if result != OK:
			progress_popup.set_message("Failed to process world")
		else:
			if not _had_export_pack_created and _processor.find_export_pack(world.path):
				progress_popup.set_message("Processing successful!\nMake sure to apply the created structure pack to any world you want to use exported structures in.")
			else:
				progress_popup.set_message("Processing successful!")


func _on_popup_hide() -> void:
	world.close()


func _on_Process_pressed() -> void:
	UI.set_popup(progress_popup)
	progress_popup.popup_centered()
	progress_popup.popup_exclusive = true
	progress_popup.set_message("Processing...", true)
	
	if $"%Backup".pressed and _processor.backup(world) != OK:
		progress_popup.popup_exclusive = false
		progress_popup.set_message("Failed to backup world!")
		return
	
	_had_export_pack_created = not _processor.find_export_pack(world.path).empty()
	_process_task = Global.start_task(_processor, "apply_changes", [world, _changes])


func _on_Cancel_pressed() -> void:
	hide()
