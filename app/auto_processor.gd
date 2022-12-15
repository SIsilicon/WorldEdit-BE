extends Node

const NativeDialogs = preload("res://addons/native_dialogs/native_dialogs.gd")

var world_check_thread := Thread.new()
var world_check_mutex := Mutex.new()
var world_check_locked := false setget set_world_check_locked
var finish_world_check := false
var world_processor := preload("res://world_processor.gd").new()

onready var dialog := $NativeDialogMessage

func _ready() -> void:
	set_world_check_locked(not Appdata.get_appdata(Appdata.AUTO_PROCESS_WORLDS, false))
	world_check_thread.start(self, "_world_check_thread", null, Thread.PRIORITY_LOW)


func _notification(what: int) -> void:
	if what == NOTIFICATION_PREDELETE and world_check_thread.is_alive():
		print_debug("Finishing auto process check")
		set_world_check_locked(true)
		finish_world_check = true
		set_world_check_locked(false)
		world_check_thread.wait_to_finish()


func set_world_check_locked(val: bool) -> void:
	if val != world_check_locked:
		world_check_locked = val
		if world_check_locked:
			world_check_mutex.lock()
		else:
			world_check_mutex.unlock()


func _world_check_thread() -> void:
	var prev_times := {}
	var file := File.new()
	var dir := Directory.new()
	dir.open("C:/")
	
	while true:
		world_check_mutex.lock()
		if finish_world_check:
			world_check_mutex.unlock()
			return
		world_check_mutex.unlock()
		
		var worlds := []
		worlds.append_array(DirUtil.get_content(Global.COM_MOJANG[0].plus_file("minecraftWorlds")))
		worlds.append_array(DirUtil.get_content(Global.COM_MOJANG[1].plus_file("minecraftWorlds")))
		
		for world_path in worlds:
			var folder: String = world_path.get_file()
			var image: String = world_path.plus_file("world_icon.jpeg")
			if not dir.file_exists(image):
				continue
			
			var modified_time := file.get_modified_time(image)
			if not prev_times.has(folder) or modified_time > prev_times[folder]:
				prev_times[folder] = modified_time
				var world := MCWorld.new(world_path)
				world.open()
				if not world.is_open():
					printerr("Failed to open %s!" % folder)
					continue
				
				var changes := world_processor.check_for_changes(world)
				if not changes.empty() and not changes.has("error"):
					print_debug("Changes detected in %s." % folder)
					
					if world_processor.apply_changes([world, changes]) != OK:
						dialog.icon = NativeDialogs.MessageIcons.ERROR
						dialog.text = "Failed to process world \"%s\"!" % world.get_name()
					else:
						dialog.icon = NativeDialogs.MessageIcons.INFO
						dialog.text = "World \"%s\" has been processed!" % world.get_name()
					dialog.show()
					world.close()
		
		yield(get_tree().create_timer(1.0), "timeout")


## OPEN MINECRAFT CODE
## JUST IN CASE IT'S NEEDED
#	
#	var uwp_package := "Microsoft.MinecraftUWP_8wekyb3d8bbwe"
#	if world_path.begins_with(Global.COM_MOJANG[1]): # Minecraft Preview
#		uwp_package = "Microsoft.MinecraftWindowsBeta_8wekyb3d8bbwe"
#
#	_execute_shell("start", [
#		"shell:appsFolder/" + uwp_package + "!App",
#		"-FilePath", ProjectSettings.globalize_path(BUILD_PATH + ".mcpack")
#	])
