tool
extends Control

export(String, DIR, GLOBAL) var world_path: String setget set_world_path

onready var is_ready := true


func set_world_path(val: String) -> void:
	if val == world_path:
		return
	
	world_path = val
	if not is_ready:
		yield(self, "ready")
	
	var image := Image.new()
	image.load(world_path.plus_file("world_icon.jpeg"))
	var texture := ImageTexture.new()
	texture.create_from_image(image)
	$"%Image".texture = texture
	
	var file := File.new()
	file.open(world_path.plus_file("levelname.txt"), File.READ)
	var levelname := file.get_as_text()
	file.close()
	
	$"%Name".text = levelname


func _truncate_string(string: String, length: int) -> String:
	if string.length() > length:
		var left := floor(length/2)
		var right := length - left
		return string.left(left - 1) + "..." + string.right(string.length() - right - 2)
	return string
