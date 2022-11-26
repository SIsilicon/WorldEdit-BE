extends Spatial

var chunk_list = Dictionary()
var radius = -1
var id2colors = [
	Color.blue, Color.green
]

onready var debug_label = $"../VBoxContainer/Label"

func _ready() -> void:
	for i in 200:
		id2colors.append(Color(randi()))


func _process(_delta: float) -> void:
	var cam_pos = $Camera.translation
	var chunk_x = floor(cam_pos.x / 16)
	var chunk_z = floor(cam_pos.z / 16)
	debug_label.text = "Coords: {0} {1} {2}".format([int(cam_pos.x), int(cam_pos.y), int(cam_pos.z)])
	
	if not get_parent().is_open:
		return
	
	var chunk = Vector2(chunk_x, chunk_z)
	
	for z in range(-radius, radius + 1):
		for x in range(-radius, radius + 1):
			if not chunk_list.has(Vector2(chunk_x + x, chunk_z + z)):
				var chunk_data = BiomeHeightData.new(chunk_x + x, chunk_z + z)
				chunk_data.min_height = -64
				chunk_data.load_from_db(get_parent().leveldb)
				_generate_height_mesh(chunk_data)
				chunk_list[Vector2(chunk_x + x, chunk_z + z)] = chunk_data
	
	if chunk_list.has(chunk) and chunk_list[chunk].valid():
		var chunk_data = chunk_list[chunk]
		var biome = chunk_data.get_biome(
			cam_pos.x - chunk_x * 16,
			cam_pos.y,
			cam_pos.z - chunk_z * 16
		)
#		var search_y = chunk_data.y_to_lookup(cam_pos.y)
#		prints(search_y[0], typeof(search_y[1]))
		debug_label.text += "\nBiome Id: {0}".format([biome])
	
	_handle_input()


func _handle_input() -> void:
	if Input.is_mouse_button_pressed(BUTTON_LEFT):
		var mouse_position = get_viewport().get_mouse_position()
		var camera = get_viewport().get_camera()
		var physics = get_viewport().find_world().direct_space_state
		
		var origin = camera.project_ray_origin(mouse_position)
		var ray = camera.project_ray_normal(mouse_position)
		
		var hit = physics.intersect_ray(origin, origin + ray * 100)
		if hit.empty():
			return
		
		var pos = hit.position
		var chunk = Vector2(floor(pos.x / 16), floor(pos.z / 16))
		
		if not chunk_list.has(chunk):
			return
		
		prints(int(pos.x), int(pos.y), int(pos.z))
		var chunk_data = chunk_list[chunk]
		chunk_data.set_biome(
			pos.x - chunk.x * 16, pos.y, pos.z - chunk.y * 16, 12
		)
#		for x in 16:
#			for y in 16:
#				for z in 16:
#					chunk_data.set_biome(
#						chunk.x * 16 + x, floor(pos.y / 16) * 16 + y, chunk.y * 16 + z, 12
#					)
		
#		chunk_data.apply_biome_changes()
		
		var prev_mesh = get_node("{0} - {1}".format([chunk.x, chunk.y]))
		if prev_mesh:
			prev_mesh.name = "Deleting"
			prev_mesh.queue_free()
		_generate_height_mesh(chunk_data)
		
		# 984 62 -1293


func _generate_height_mesh(chunk_data: BiomeHeightData) -> void:
	if not chunk_data.valid():
		return
	
	var mesh_inst = MeshInstance.new()
	var surface_tool := SurfaceTool.new()
	surface_tool.begin(Mesh.PRIMITIVE_TRIANGLES)
	for z in 16:
		for x in 16:
			var val = chunk_data.get_height(x, z)
			var biome = chunk_data.get_biome(x, val, z)
			surface_tool.add_triangle_fan(PoolVector3Array([
				Vector3(x, val, z+1),
				Vector3(x, val, z),
				Vector3(x+1, val, z),
				Vector3(x+1, val, z+1)
			]), [], [id2colors[biome]])
	surface_tool.generate_normals()
	mesh_inst.mesh = surface_tool.commit()
	
	var x := chunk_data.coord.x
	var z := chunk_data.coord.y
	
	mesh_inst.mesh.surface_set_material(0, preload("res://material.tres"))
	mesh_inst.translation = Vector3(x * 16, 0, z * 16)
	mesh_inst.name = "{0} - {1}".format([x, z])
	add_child(mesh_inst)
	mesh_inst.create_trimesh_collision()


func _on_Button3_pressed() -> void:
	var cam_pos = $Camera.translation
	var chunk_x = floor(cam_pos.x / 16)
	var chunk_z = floor(cam_pos.z / 16)
	var chunk = Vector2(chunk_x, chunk_z)
	
	if not get_parent().is_open or not chunk_list.has(chunk):
		return
	
	chunk_list[chunk].save_to_db(get_parent().leveldb)
