extends Reference
class_name BiomeHeightData

const LevelDB = preload("res://leveldb_ref.gdns")

var coord: Vector2
var dimension: int
var min_height: int
var height_limit: int

var _is_valid = false
var _height_data = []
var _biome_data = []
# var _biome_pallete_data = []

# warning-ignore:shadowed_variable
func _init(x: int, z: int, dimension = 0) -> void:
	coord.x = x
	coord.y = z
	self.dimension = dimension


func load_from_db(leveldb: LevelDB, mutex: Mutex = null) -> void:
# warning-ignore:narrowing_conversion
	var key = _to_int32(coord.x)
# warning-ignore:narrowing_conversion
	key.append_array(_to_int32(coord.y))
	if dimension:
		key.append_array(_to_int32(dimension))
	key.append(0x2b) # Tag for Data3D
	
	if mutex: mutex.lock()
	var data: PoolByteArray = leveldb.get_data(key)
	if mutex: mutex.unlock()
	
	if data.empty():
		return
	
	var buffer := StreamPeerBuffer.new()
	buffer.data_array = data
	
	if typeof(min_height) == TYPE_NIL:
		min_height = 0
	
	# The first 512 bytes represent the height map
	for i in 256:
		_height_data.append(buffer.get_16() + min_height)
	
	while buffer.get_available_bytes() > 0:
		var header = buffer.get_u8()
		if header == 0xff:
			_biome_data.append(null)
#			_biome_pallete_data.append(null)
			continue
		
# warning-ignore:unused_variable
		var bit_0 = header & 0b00000001
		var bits_per_entry = (header & 0b11111110) >> 1
		
		if (bits_per_entry != 0):
			var ids: Array
			if bits_per_entry > 2:
				ids = []
				var int_count = ceil((bits_per_entry * 16) / 32)
				var height_buffer = StreamPeerBuffer.new()
				height_buffer.big_endian = true
				for c in 256:
					var column: PoolByteArray = buffer.get_data(int_count * 4)[1]
					column.invert()
					height_buffer.data_array = column
					ids.append_array(_get_packed_bits(height_buffer, bits_per_entry, 16))
			else:
				ids = _get_packed_bits(buffer, bits_per_entry, 4096)
			
			var palletes = []
			var pallete_count = buffer.get_u8()
			buffer.big_endian = true
			for i in pallete_count:
				var biome = buffer.get_32()
				palletes.append(biome)
			buffer.big_endian = false
			
			buffer.seek(buffer.get_position() + 3) # strangely three bytes of padding seem to be added to the pallete
			
			var biome_ids = []
			for id in ids:
				biome_ids.append(palletes[id] if id < pallete_count else 0)
			_biome_data.append(biome_ids)
#			_biome_pallete_data.append(palletes)
			
		else:
			var id = buffer.get_32()
			_biome_data.append(id)
#			_biome_pallete_data.append([id])
	
	height_limit = min_height + _biome_data.size() * 16
	_is_valid = true


func save_to_db(leveldb: LevelDB, mutex: Mutex = null) -> int:
# warning-ignore:narrowing_conversion
	var key = _to_int32(coord.x)
# warning-ignore:narrowing_conversion
	key.append_array(_to_int32(coord.y))
	if dimension:
		key.append_array(_to_int32(dimension))
	key.append(0x2b) # Tag for Data3D
	
	var buffer = StreamPeerBuffer.new()
	
	for h in _height_data:
		buffer.put_16(h - min_height)
	
	for i in _biome_data.size():
		var biomes = _biome_data[i]
		if typeof(biomes) == TYPE_NIL:
			buffer.put_u8(0xff)
			continue
		
		var pallete: Array
		if typeof(biomes) == TYPE_ARRAY:
			var new_pallete := {}
			for b in biomes:
				new_pallete[b] = 0
			pallete = new_pallete.keys()
		else:
			pallete = [biomes]
		
		if pallete.size() > 1:
# warning-ignore:narrowing_conversion
			var bits_per_entry: int = nearest_po2(log(nearest_po2(pallete.size())) / log(2))
			buffer.put_u8((bits_per_entry << 1) + 1)
			
			var reverse_pallete = {}
			for j in pallete.size():
				reverse_pallete[pallete[j]] = j
			
			var ids = []
			for biome in biomes:
				ids.append(reverse_pallete[biome])
			
			if bits_per_entry > 2:
				var height_buffer = StreamPeerBuffer.new()
				height_buffer.big_endian = true
				for c in 256:
					_put_packed_bits(height_buffer, bits_per_entry, ids.slice(c*16, c*16 + 15))
					var column = height_buffer.data_array
					column.invert()
					buffer.put_data(column)
					height_buffer.clear()
			else:
				_put_packed_bits(buffer, bits_per_entry, ids)
			
			buffer.put_u8(pallete.size())
			buffer.big_endian = true
			for p in pallete:
				buffer.put_32(p)
			buffer.big_endian = false
			
			buffer.put_data([0x00, 0x00, 0x00])
		else:
			buffer.put_u8(0x01)
			buffer.put_32(pallete[0])
	
	if mutex:
		mutex.lock()
	leveldb.store_data(key, buffer.data_array)
	if mutex:
		mutex.unlock()
	
	# TODO: Implement leveldb.get_last_error()
	return OK


func get_height(x: int, z: int) -> int:
	return _height_data[x + z*16]


func get_biome(x: int, y: int, z: int) -> int:
	if y < min_height:
		return -1
	
	var lookup = y_to_lookup(y)
	
	if typeof(lookup[1]) == TYPE_INT:
		return lookup[1]
	elif typeof(lookup[1]) == TYPE_ARRAY:
		return lookup[1][xyz_to_idx(x, y, z)]
	
	return -1


func set_biome(x: int, y: int, z: int, biome: int) -> void:
	if y < min_height or y >= height_limit:
		return
	
# warning-ignore:integer_division
	var y_idx := floor((y - min_height) / 16)
	var biomes = _biome_data[y_idx]
	
	if typeof(biomes) == TYPE_NIL:
		biomes = biome
		_biome_data[y_idx] = biome
		return
	elif typeof(biomes) == TYPE_INT:
		if biomes == biome:
			# Nothing changes
			return
		
		var new_data = []
		for i in 4096:
			new_data.append(biomes)
		_biome_data[y_idx] = new_data
		biomes = new_data
	
	var subchunk_idx = xyz_to_idx(x, y, z)
	biomes[subchunk_idx] = biome


func set_biome_subchunk(y: int, biome: int) -> void:
	if y < min_height or y >= height_limit:
		return
	
# warning-ignore:integer_division
	var y_idx := floor((y - min_height) / 16)
	_biome_data[y_idx] = biome


func valid() -> bool:
	return _is_valid


func xyz_to_idx(x: int, y: int, z: int) -> int:
	y = wrapi(y, 0, 16)
	return (wrapi(15 - y, 0, 16)) + wrapi(z, 0, 16) * 16 + wrapi(x, 0, 16) * 256


func y_to_lookup(y: int) -> Array:
# warning-ignore:narrowing_conversion
	y = min(y, height_limit - 1)
# warning-ignore:integer_division
	var sub_data = _biome_data[floor((y - min_height) / 16)]
	while sub_data == null and y >= min_height:
# warning-ignore:integer_division
# warning-ignore:narrowing_conversion
# warning-ignore:integer_division
		y = floor(y / 16) * 16 - 1
		sub_data = _biome_data[floor((y - min_height) / 16)]
	
# warning-ignore:integer_division
	return [y, sub_data, floor((y - min_height) / 16)]


func _to_int32(val: int) -> PoolByteArray:
	var buffer = StreamPeerBuffer.new()
	buffer.put_32(val)
	return buffer.data_array


func _get_packed_bits(buffer: StreamPeer, size: int, count: int) -> Array:
	var arr := []
	var temp := 0
	var curr_byte := 0
	var bits_left := 0
	var bits_processed := 0
	
	while arr.size() < count:
		if bits_left <= 0:
			if not buffer.get_available_bytes():
				break
			curr_byte = buffer.get_u32()
			bits_left = 32
		
		while bits_processed < size && bits_left > 0:
			temp += ((curr_byte >> (bits_left-1)) & 1) << (size - bits_processed - 1)
			
			bits_processed += 1
			bits_left -= 1
			
			if bits_processed >= size:
				bits_processed = 0
				arr.append(temp)
				temp = 0
				break
	
	return arr

func _put_packed_bits(buffer: StreamPeer, size: int, input: Array) -> void:
	var BYTE_SIZE = 32
	
	var index = 0
	var temp = 0
	var bits_left = size
	var bits_processed = 0
	
	while index < input.size():
		while bits_processed < BYTE_SIZE and bits_left > 0:
			temp += ((input[index] >> (bits_left-1)) & 1) << (BYTE_SIZE - bits_processed - 1)
			
			bits_processed += 1
			bits_left -= 1
			
			if bits_left <= 0:
				index += 1
				bits_left = size
			
			if index >= input.size():
				bits_processed = BYTE_SIZE
		
		if bits_processed >= BYTE_SIZE:
			buffer.put_u32(temp)
			bits_processed = 0
			temp = 0

#func set_biome(x: int, y: int, z: int, biome: int) -> void:
#	if y < min_height or y >= height_limit:
#		return
#
#	var y_idx := floor((y - min_height) / 16)
#
#	if not _biome_changes.has(y_idx):
#		var biomes = _biome_data[y_idx]
#		if typeof(biomes) == TYPE_INT and biomes == biome:
#			return
#		if typeof(biomes) == TYPE_ARRAY and biomes[xyz_to_idx(x, y, z)] == biome:
#			return
#
#		_biome_changes[y_idx] = {}
#	_biome_changes[y_idx][Vector3(x, wrapi(y, 0, 15), z)] = biome
#
#
#func apply_biome_changes() -> void:
#	for y_idx in _biome_changes:
#		var new_biomes = _biome_changes[y_idx]
#
#		var biomes = _biome_data[y_idx]
#		var pallete = _biome_pallete_data[y_idx]
#
#		for change in new_biomes:
#			var biome: int = new_biomes[change]
#
#			if pallete.size() == 1:
#				if pallete[0] == biome:
#					continue
#
#				pallete.append(biome)
#				var new_data = []
#				for i in 4096:
#					new_data.append(pallete[0])
#				_biome_data[y_idx] = new_data
#				biomes = new_data
#
#			var subchunk_idx = xyz_to_idx(change.x, change.y, change.z)
#
#		if pallete.size() > 1:
#			var new_pallete = {}
#			for b in biomes:
#				new_pallete[b] = 0
#
#			_biome_pallete_data[y_idx] = new_pallete.keys()
#			if new_pallete.size() == 1:
#				_biome_data[y_idx] = new_pallete.keys()[0]
