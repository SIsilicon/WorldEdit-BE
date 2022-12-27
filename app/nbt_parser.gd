extends Node
class_name NBT

#{0: <class 'nbtlib.tag.End'>,
#1: <class 'nbtlib.tag.Byte'>,
#2: <class 'nbtlib.tag.Short'>,
#3: <class 'nbtlib.tag.Int'>,
#4: <class 'nbtlib.tag.Long'>,
#5: <class 'nbtlib.tag.Float'>,
#6: <class 'nbtlib.tag.Double'>,
#7: <class 'nbtlib.tag.ByteArray'>,
#8: <class 'nbtlib.tag.String'>,
#9: <class 'nbtlib.tag.List'>,
#10: <class 'nbtlib.tag.Compound'>,
#11: <class 'nbtlib.tag.IntArray'>,
#12: <class 'nbtlib.tag.LongArray'>}


static func parse(stream: StreamPeer) -> CompoundTag:
	var tag_id = stream.get_u8()
	assert(tag_id == 10, "Non-Compound root tags are not supported")
	BaseTag._read_string(stream)
	
	return CompoundTag.parse(stream) as CompoundTag


static func write(stream: StreamPeer, nbt: CompoundTag) -> void:
	stream.put_8(nbt.tag_id)
	stream.put_16(0)
	nbt.write(stream)


class BaseTag extends Reference:
	var tag_id: int
	
	func _init(id: int) -> void:
		tag_id = id
	
	func to_json() -> Dictionary:
		printerr("to_json() needs to be overriden!")
		return { "type": tag_id }
	
	# warning-ignore:unused_argument
	func write(stream: StreamPeer) -> void:
		printerr("write() needs to be overriden!")
	
	func duplicate() -> BaseTag:
		printerr("duplicate() needs to be overriden!")
		return null
	
	static func _read_string(stream: StreamPeer) -> String:
		var length := stream.get_u16()
		if not length:
			return ""
		return (stream.get_data(length)[1] as PoolByteArray).get_string_from_utf8()
	
	static func get_tag(id: int) -> GDScript:
		return [
			null, # Empty Tag
			ByteTag, ShortTag, IntTag, LongTag,
			FloatTag, DoubleTag, ByteArrayTag,
			StringTag, ListTag, CompoundTag,
			IntArrayTag, LongArrayTag
		][id]
	
	# warning-ignore:unused_argument
	static func parse(stream: StreamPeer) -> BaseTag:
		return null

class NumberIntTag extends BaseTag:
	var value: int
	
	func _init(id: int, val: int).(id) -> void:
		value = val
	
	func to_json() -> Dictionary:
		var dict = .to_json()
		dict["value"] = value
		return dict

class ByteTag extends NumberIntTag:
	
	func _init(data: int).(1, data) -> void:
		pass
	
	func write(stream: StreamPeer) -> void:
		stream.put_8(value)
	
	func duplicate() -> BaseTag:
		return ByteTag.new(value)

	static func parse(stream: StreamPeer) -> BaseTag:
		return ByteTag.new(stream.get_8())

class ShortTag extends NumberIntTag:
	
	func _init(data: int).(2, data) -> void:
		pass
	
	func write(stream: StreamPeer) -> void:
		stream.put_16(value)
	
	func duplicate() -> BaseTag:
		return ShortTag.new(value)

	static func parse(stream: StreamPeer) -> BaseTag:
		return ShortTag.new(stream.get_16())

class IntTag extends NumberIntTag:
	
	func _init(data: int).(3, data) -> void:
		pass
	
	func write(stream: StreamPeer) -> void:
		stream.put_32(value)
	
	func duplicate() -> BaseTag:
		return IntTag.new(value)
	
	static func parse(stream: StreamPeer) -> BaseTag:
		return IntTag.new(stream.get_32())

class LongTag extends NumberIntTag:
	
	func _init(data: int).(4, data) -> void:
		pass
	
	func write(stream: StreamPeer) -> void:
		stream.put_64(value)
	
	func duplicate() -> BaseTag:
		return LongTag.new(value)
	
	static func parse(stream: StreamPeer) -> BaseTag:
		return LongTag.new(stream.get_64())

class NumberFloatTag extends BaseTag:
	var value: float
	
	func _init(id: int, val: float).(id) -> void:
		value = val
	
	func to_json() -> Dictionary:
		var dict = .to_json()
		dict["value"] = value
		return dict

class FloatTag extends NumberFloatTag:
	
	func _init(data: float).(5, data) -> void:
		pass
	
	func write(stream: StreamPeer) -> void:
		stream.put_float(value)
	
	func duplicate() -> BaseTag:
		return FloatTag.new(value)
	
	static func parse(stream: StreamPeer) -> BaseTag:
		return FloatTag.new(stream.get_float())

class DoubleTag extends NumberFloatTag:
	
	func _init(data: float).(6, data) -> void:
		pass
	
	func write(stream: StreamPeer) -> void:
		stream.put_double(value)
	
	func duplicate() -> BaseTag:
		return DoubleTag.new(value)
	
	static func parse(stream: StreamPeer) -> BaseTag:
		return DoubleTag.new(stream.get_double())

class ArrayTag extends BaseTag:
	var values = []
	
	func _init(id: int, vals = []).(id) -> void:
		values = vals
	
	func to_json() -> Dictionary:
		var dict = .to_json()
		dict["values"] = values.duplicate()
		return dict
	
	func duplicate() -> BaseTag:
		return get_tag_class().new(tag_id, values.duplicate())
	
	func write(stream: StreamPeer) -> void:
		stream.put_32(values.size())
		for value in values:
			write_element(stream, value)
	
	# warning-ignore:unused_argument
	# warning-ignore:unused_argument
	func write_element(stream: StreamPeer, value) -> void:
		pass
	
	static func parse(stream: StreamPeer) -> BaseTag:
		var length = stream.get_32()
		# warning-ignore:shadowed_variable
		var values = []
		for i in length:
			values.push(get_element(stream))
		return get_tag_class().new(get_tag_id(), values)
	
	static func get_tag_class() -> GDScript:
		return ArrayTag
	
	# warning-ignore:unused_argument
	static func get_element(stream: StreamPeer) -> int:
		return 0
	
	static func get_tag_id() -> int:
		return 0

class ByteArrayTag extends ArrayTag:
	
	func write_element(stream: StreamPeer, value: int) -> void:
		stream.put_8(value)
	
	static func get_tag_class() -> GDScript:
		return ByteArrayTag
	
	static func get_element(stream: StreamPeer) -> int:
		return stream.get_8()
	
	static func get_tag_id() -> int:
		return 7

class StringTag extends BaseTag:
	var value: String
	
	func _init(val: String).(8) -> void:
		value = val
	
	func to_json() -> Dictionary:
		var dict = .to_json()
		dict["text"] = value
		return dict
	
	func duplicate() -> BaseTag:
		return StringTag.new(value)
	
	func write(stream: StreamPeer) -> void:
		stream.put_16(value.length())
		stream.put_data(value.to_ascii())
	
	static func parse(stream: StreamPeer) -> BaseTag:
		return StringTag.new(BaseTag._read_string(stream))

class ListTag extends BaseTag:
	var tags: Array
	var entry_type: int
	
	# warning-ignore:shadowed_variable
	# warning-ignore:shadowed_variable
	func _init(tags: Array, entry_type: int).(9) -> void:
		self.tags = tags
		self.entry_type = entry_type
	
	func to_json() -> Dictionary:
		var dict = .to_json()
		var values = []
		for tag in tags:
			var json: Dictionary = tag.to_json()
			json.erase("type")
			values.append(json)
		dict["tag_type"] = entry_type
		dict["tags"] = values
		return dict
	
	func duplicate() -> BaseTag:
		var duped_tags := []
		for tag in tags:
			duped_tags.append(tag.duplicate())
		return ListTag.new(duped_tags, entry_type)
	
	func write(stream: StreamPeer) -> void:
		stream.put_8(entry_type)
		stream.put_32(tags.size())
		for tag in tags:
			tag.write(stream)
	
	static func parse(stream: StreamPeer) -> BaseTag:
		var type := stream.get_8()
		var tag := BaseTag.get_tag(type)
		var length := stream.get_32()
		# warning-ignore:shadowed_variable
		var tags := []
		
		for i in length:
			tags.append(tag.parse(stream))
		
		return ListTag.new(tags, type)

class CompoundTag extends BaseTag:
	var tags: Dictionary
	
	# warning-ignore:shadowed_variable
	func _init(tags: Dictionary).(10) -> void:
		self.tags = tags
	
	func to_json() -> Dictionary:
		var dict = .to_json()
		var values = {}
		for tag in tags:
			values[tag] = tags[tag].to_json()
		dict["tags"] = values
		return dict
	
	func duplicate() -> BaseTag:
		var duped_tags := {}
		for tag_name in tags:
			duped_tags[tag_name] = tags[tag_name].duplicate()
		return CompoundTag.new(duped_tags)
	
	func write(stream: StreamPeer) -> void:
		for name in tags:
			var tag: BaseTag = tags[name]
			stream.put_8(tag.tag_id)
			stream.put_16(name.length())
			stream.put_data(name.to_ascii())
			tag.write(stream)
		stream.put_8(0)
	
	static func parse(stream: StreamPeer) -> BaseTag:
		# warning-ignore:shadowed_variable
		var tags := {}
		
		var tag_id := stream.get_8()
		while tag_id != 0:
			var name := BaseTag._read_string(stream)
			assert(not tags.has(name))
			tags[name] = BaseTag.get_tag(tag_id).parse(stream)
			tag_id = stream.get_8()
		
		return CompoundTag.new(tags)

class IntArrayTag extends ArrayTag:
	
	func write_element(stream: StreamPeer, value: int) -> void:
		stream.put_32(value)
	
	static func get_tag_class() -> GDScript:
		return IntArrayTag
	
	static func get_element(stream: StreamPeer) -> int:
		return stream.get_32()
	
	static func get_tag_id() -> int:
		return 11

class LongArrayTag extends ArrayTag:
	
	func write_element(stream: StreamPeer, value: int) -> void:
		stream.put_64(value)
	
	static func get_tag_class() -> GDScript:
		return LongArrayTag
	
	static func get_element(stream: StreamPeer) -> int:
		return stream.get_64()
	
	static func get_tag_id() -> int:
		return 12
