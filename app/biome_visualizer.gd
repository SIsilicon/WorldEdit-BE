extends Particles

var biome_data = {} setget set_biome_data

var colors = {
	35: Color.red,
	188: Color.green
}

func set_biome_data(val):
	biome_data = val
	
	var texture = Texture3D.new()
	texture.create(16, 16, 16, Image.FORMAT_R8, 0)
	for y in 16:
		
		var image = Image.new()
		image.create(16, 16, false, Image.FORMAT_R8)
		image.lock()
		for z in 16:
			for x in 16:
				var biome_id = biome_data[Vector3(x, y, z)]
				var color = colors[biome_id]
				if not color:
					color = Color.black
				image.set_pixel(x, z, color)
		image.unlock()
		
		texture.set_layer_data(image, y)
	
	process_material = process_material.duplicate()
	(process_material as ShaderMaterial).set_shader_param("biome_data", texture)
