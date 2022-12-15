tool
class_name WorldPreviewButton
extends Control

export(String, DIR, GLOBAL) var world_path: String setget set_world_path

onready var is_ready := true

var world: MCWorld

func set_world_path(val: String) -> void:
	if val == world_path:
		return
	
	world_path = val
	if not is_ready:
		yield(self, "ready")
	
	world = MCWorld.new(world_path)
	
	$"%Image".texture = world.get_image()
	$"%Name".text = world.get_name()
	$"%Folder".text = world.path.get_file()
	
	var modified_time := Time.get_date_dict_from_unix_time(File.new().get_modified_time(world.path))
	$"%Date".text = "%s/%s/%s" % [modified_time.month, modified_time.day, modified_time.year]
	
	$"%Preview".visible = world.path.begins_with(Global.COM_MOJANG[1])


func _truncate_string(string: String, length: int) -> String:
	if string.length() > length:
		var left := floor(length/2)
		var right := length - left
		return string.left(left - 1) + "..." + string.right(string.length() - right - 2)
	return string
