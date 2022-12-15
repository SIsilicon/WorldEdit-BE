class_name MCWorld extends Reference

const LevelDB = preload("res://leveldb_ref.gdns")

enum ScoreboardPlayerType {
	NONE = 0,
	PLAYER = 1,
	ENTITY = 2,
	FAKE_PLAYER = 3
}

var _leveldb: LevelDB
var _is_open := false
var _scoreboard: Scoreboard
var _biome_height_data: Dictionary

# TODO: Cache world image and name

var path: String

func _init(path: String) -> void:
	self.path = path


func get_image() -> ImageTexture:
	var image := Image.new()
	image.load(path.plus_file("world_icon.jpeg"))
	var texture := ImageTexture.new()
	texture.create_from_image(image)
	return texture


func get_name() -> String:
	var file := File.new()
	file.open(path.plus_file("levelname.txt"), File.READ)
	var levelname := file.get_as_text()
	file.close()
	return levelname


func rename(new_name: String) -> void:
	var file := File.new()
	file.open(path.plus_file("levelname.txt"), File.WRITE)
	file.store_string(new_name)
	file.close()


func get_modified_time() -> int:
	return File.new().get_modified_time(path.plus_file("world_icon.jpeg"))


func open() -> int:
	if _is_open:
		return ERR_FILE_ALREADY_IN_USE
	
	_leveldb = LevelDB.new()
	var file := File.new()
	
	if not file.file_exists(path.plus_file("level.dat")):
		return ERR_DOES_NOT_EXIST
	
	file.open(path.plus_file("db/LOCK"), File.WRITE)
	file.close()
	
	if _leveldb.open(path.plus_file("db")):
		return ERR_CANT_OPEN
	
	_is_open = true
	return OK


func is_open() -> bool:
	return _is_open


func save() -> int:
	var success := 1
	if _scoreboard:
		success &= int(store_nbt("scoreboard", _scoreboard._nbt) == OK)
	for data in _biome_height_data:
		success &= int((_biome_height_data[data] as BiomeHeightData).save_to_db(_leveldb) == OK)
	return OK if success else ERR_DATABASE_CANT_WRITE


func close() -> void:
	if not _is_open:
		return
	_biome_height_data.clear()
	_leveldb.close()
	_scoreboard = null
	_leveldb = null
	_is_open = false


func get_scoreboard() -> Scoreboard:
	if not _scoreboard:
		_scoreboard = Scoreboard.new(self) 
	return _scoreboard


func get_db_entry(key: PoolByteArray) -> PoolByteArray:
	return _leveldb.get_data(key)


func store_db_entry(key: PoolByteArray, value: PoolByteArray) -> int:
	_leveldb.store_data(key, value)
	return OK


func delete_db_entry(key: PoolByteArray) -> int:
	_leveldb.delete_data(key)
	return OK


func get_nbt(key: String) -> NBT.CompoundTag:
	var nbt: PoolByteArray = _leveldb.get_data(key.to_ascii())
	if nbt.empty():
		return null
	
	var stream := StreamPeerBuffer.new()
	stream.data_array = nbt
	return NBT.parse(stream)

## TODO: Implement leveldb.get_last_error()

func store_nbt(key: String, nbt: NBT.CompoundTag) -> int:
	var stream := StreamPeerBuffer.new()
	NBT.write(stream, nbt)
	_leveldb.store_data(key.to_ascii(), stream.data_array)
	return OK


func iterate_db(function: FuncRef, data = []) -> void:
	_leveldb.seek_to_first()
	while _leveldb.valid():
		function.call_func(_leveldb.key(), _leveldb.value(), data)
		_leveldb.next()


func get_biome(dimension: String, loc: Vector3) -> int:
	var key := "%s,%s,%s" % [dimension, floor(loc.x / 16), floor(loc.z / 16)]
	if not _biome_height_data.has(key):
		var data := BiomeHeightData.new(floor(loc.x / 16), floor(loc.z / 16), _dimesnion2id(dimension))
		if dimension == "minecraft:overworld":
			data.min_height = -64
		data.load_from_db(_leveldb)
		_biome_height_data[key] = data
	return (_biome_height_data[key] as BiomeHeightData).get_biome(int(loc.x) % 16, int(loc.y) % 16, int(loc.z) % 16)


func set_biome(dimension: String, loc: Vector3, biome: int) -> void:
	var key := "%s,%s,%s" % [dimension, floor(loc.x / 16), floor(loc.z / 16)]
	if not _biome_height_data.has(key):
		var data := BiomeHeightData.new(floor(loc.x / 16), floor(loc.z / 16), _dimesnion2id(dimension))
		if dimension == "minecraft:overworld":
			data.min_height = -64
		data.load_from_db(_leveldb)
		_biome_height_data[key] = data
	(_biome_height_data[key] as BiomeHeightData).set_biome(int(loc.x) % 16, int(loc.y), int(loc.z) % 16, biome)


func _dimesnion2id(dimension: String) -> int:
	return 2 if dimension == "minecraft:the_end" else 1 if dimension == "minecraft:nether" else 0


class Scoreboard:
	var _nbt: NBT.CompoundTag
	
	func _init(world: MCWorld) -> void:
		_nbt = world.get_nbt("scoreboard")
	
	
	func get_objective(name: String) -> ScoreboardObjective:
		for obj in _nbt.tags.get("Objectives", {"tags": []}).tags:
			if obj.tags["Name"].value == name:
				return ScoreboardObjective.new(obj, self)
		return null
	
	
	func get_objectives(player: ScoreboardParticipant = null) -> Array:
		var objectives := []
		for obj in _nbt.tags.get("Objectives", {"tags": []}).tags:
			var objective := ScoreboardObjective.new(obj, self)
			for p in objective.get_players():
				if p._id == player._id:
					objectives.append(objective)
		return objectives
	
	
	func remove_objective(name: String) -> void:
		var objective := get_objective(name)
		if not objective:
			return
		
		for player in objective.get_players():
			objective.reset_player(player)
		
		var objectives: Array = _nbt.tags.get("Objectives", {"tags": []}).tags
		objectives.erase(objective._nbt)



class ScoreboardObjective:
	var _nbt: NBT.CompoundTag
	var _scoreboard: Scoreboard
	
	func _init(nbt: NBT.CompoundTag, scoreboard: Scoreboard) -> void:
		_nbt = nbt
		_scoreboard = scoreboard
	
	
	func get_players() -> Array:
		var players := []
		for score_tag in _nbt.tags["Scores"].tags:
			players.append(ScoreboardParticipant.new(_scoreboard, score_tag.tags["ScoreboardId"].value))
		return players
	
	
	func reset_player(player: ScoreboardParticipant) -> void:
		var scores: Array = _nbt.tags["Scores"].tags
		for i in range(scores.size() - 1, -1, -1):
			if scores[i].tags["ScoreboardId"].value == player._id:
				scores.remove(i)
				break
		
		if _scoreboard.get_objectives(player).size():
			return
		
		var entries: Array = _scoreboard._nbt.tags.get("Entries", {"tags": []}).tags
		for i in range(entries.size() - 1, -1, -1):
			if entries[i].tags["ScoreboardId"].value == player._id:
				entries.remove(i)
				break



class ScoreboardParticipant:
	var _scoreboard: Scoreboard
	var _id: int
	
	func _init(scoreboard: Scoreboard, id: int) -> void:
		_scoreboard = scoreboard
		_id = id
	
	
	func get_type() -> int:
		for entry in _scoreboard._nbt.tags.get("Entries", {"tags": []}).tags:
			if entry.tags["ScoreboardId"].value == _id:
				return entry.tags["IdentityType"].value
		return ScoreboardPlayerType.NONE
	
	
	func get_fake_player_name() -> String:
		for entry in _scoreboard._nbt.tags.get("Entries", {"tags": []}).tags:
			if entry.tags["ScoreboardId"].value == _id:
				if entry.tags.has("FakePlayerName"):
					return entry.tags["FakePlayerName"].value
				break
		return ""
