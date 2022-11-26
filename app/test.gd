extends Control

const LevelDB = preload("res://leveldb_ref.gdns")

const BUILD_PATH := "user://temp_behavior_pack"

const MAX_STRUCT_SIZE := Vector3(64, 256, 64)

var world_check_thread := Thread.new()
var world_check_mutex := Mutex.new()
var world_check_locked := false setget set_world_check_locked
var finish_world_check := false

func _ready() -> void:
	set_world_check_locked(not $"%AutoProcess".pressed)
	if OS.get_name() != "HTML5":
		world_check_thread.start(self, "_world_check_thread", null, Thread.PRIORITY_LOW)


func _notification(what: int) -> void:
	if what == NOTIFICATION_PREDELETE and world_check_thread.is_alive():
		print("Finish")
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


func check_for_changes(path: String) -> Dictionary:
	var changes := {}
	var world := _open_world(path)
	if not world.is_open():
		return changes
	
	var exports := []
	var export_objective := world.get_scoreboard().get_objective("wedit:exports")
	if export_objective:
		exports = export_objective.get_players()
	
	if not exports.empty():
		changes.exports = exports.size()
	
	var no_ref_actors := _get_unreferenced_actors(world)
	if not no_ref_actors.empty():
		changes.no_ref_actors = no_ref_actors
	
	var db_objective := world.get_scoreboard().get_objective("GAMETEST_DB")
	if db_objective:
		# TODO: Make better tester
		changes.biomes = true
	
	world.close()
	return changes


func extract_exported_structures(world: MCWorld, world_path: String) -> void:
	# Step 1: Get exported structure names from scoreboard
	var scoreboard := world.get_scoreboard()
	
	var exports := {}
	var objective := scoreboard.get_objective("wedit:exports")
	if objective:
		for score_player in objective.get_players():
			if score_player.get_type() == MCWorld.ScoreboardPlayerType.FAKE_PLAYER:
				var struct_name: String = score_player.get_fake_player_name()
				exports[struct_name] = struct_name.split(":", false, 1)
	
	if exports.size() == 0:
		return
	
	# Step 2: Extract relevant structures and metadata from database
	var structures = {}
	for struct_name in exports:
		var id: String = exports[struct_name][1]
		var namespace: String = exports[struct_name][0]
		
		var struct_meta := world.get_nbt(_struct_key("weditstructmeta_" + id, namespace))
		assert(struct_meta)
		
		var entity_list: Array = struct_meta.tags.structure.tags.entities.tags
		var meta_entity: NBT.CompoundTag
		for entity in entity_list:
			if entity.tags.identifier.value == "wedit:struct_meta":
				meta_entity = entity
				break
		assert(meta_entity)
		entity_list.clear()
		entity_list.append(meta_entity)
		
		var metadata: Dictionary = JSON.parse(meta_entity.tags.CustomName.value).result
		var struct_size := Vector3(metadata.size.x, metadata.size.y, metadata.size.z)
		
		var struct_ref := struct_meta.duplicate() as NBT.CompoundTag
		struct_ref.tags.structure.tags.entities.tags[0].tags.CustomName.value = struct_name
		
		var structs := {}
		if struct_size.x > MAX_STRUCT_SIZE.x || struct_size.y > MAX_STRUCT_SIZE.y || struct_size.z > MAX_STRUCT_SIZE.z:
			for x in range(0, struct_size.x, MAX_STRUCT_SIZE.x):
				for y in range(0, struct_size.y, MAX_STRUCT_SIZE.y):
					for z in range(0, struct_size.z, MAX_STRUCT_SIZE.z):
						var subid := PoolStringArray([ id,
							floor(x / MAX_STRUCT_SIZE.x),
							floor(y / MAX_STRUCT_SIZE.y),
							floor(z / MAX_STRUCT_SIZE.z),
						]).join("_")
						structs[subid] = world.get_nbt(_struct_key("weditstructexport_" + subid, namespace))
		else:
			structs[id] = world.get_nbt(_struct_key("weditstructexport_" + id, namespace))
		
		structures[struct_name] = {
			exporter = metadata.exporter,
			namespace = namespace,
			id = id,
			ref = struct_ref,
			meta = struct_meta,
			structs = structs
		}
	
	if structures.empty():
		return
	
	# Step 3: Build behaviour pack
	var is_com_mojang := \
		world_path.begins_with(Global.COM_MOJANG[0]) or \
		world_path.begins_with(Global.COM_MOJANG[1])
	
	DirUtil.remove(BUILD_PATH)
	if is_com_mojang:
		var beh_packs_folder := world_path.get_base_dir().get_base_dir().plus_file("development_behavior_packs")
		var prev_pack := _find_behaviour_pack(beh_packs_folder, Appdata.get_appdata(Appdata.MANIFEST_UUID))
		
		if prev_pack:
			DirUtil.copy(prev_pack, BUILD_PATH)
			_structures_to_bp(structures)
			DirUtil.replace(prev_pack, BUILD_PATH)
		else:
			_structures_to_bp(structures)
			DirUtil.copy(BUILD_PATH, beh_packs_folder.plus_file("WorldEdit SP"))
	else:
		_structures_to_bp(structures)
		DirUtil.copy(BUILD_PATH, world_path + "_export")
		_compress(world_path + "_export", world_path + "_export.mcpack")
	
	
	# Step 4: Clean up scoreboard and structures from database
	scoreboard.remove_objective("wedit:exports")
	world.save()
	
	for struct in structures:
		var id: String = structures[struct].id
		var namespace: String = structures[struct].namespace
		world.delete_db_entry((_struct_key("weditstructref_" + id)).to_ascii())
		world.delete_db_entry((_struct_key("weditstructmeta_" + id, namespace)).to_ascii())
		for subid in structures[struct].structs:
			world.delete_db_entry((_struct_key("weditstructexport_" + subid, namespace)).to_ascii())


func apply_biome_changes(world: MCWorld) -> void:
	var scoreboard := world.get_scoreboard()
	var gamtest_db := scoreboard.get_objective("GAMETEST_DB")
	
	if not gamtest_db:
		return
	
	var changes := {}
	var players := []
	for player in gamtest_db.get_players():
		if player.get_type() == MCWorld.ScoreboardPlayerType.FAKE_PLAYER:
			var json_string: String = player.get_fake_player_name().replace("\\\"", "\"")
			var json_result := JSON.parse(json_string)
			if json_result.error:
				prints("err", player.get_fake_player_name().length())
				continue
			
			var result: Dictionary = json_result.result[1]
			var params: Array = json_result.result[0].rsplit(",", true, 2)
			if params.size() != 3 or params[0] != "wedit:biome":
				continue
			
			var change := {}
			var biomes: Array = result.biomes
			var pallete: Array = result.pallete
			
			var palleteMap := { 0: -1 }
			for i in pallete.size():
				palleteMap[i + 1] = pallete[i]
			
			for loc in 4096:
				loc = int(loc)
				var idx: int = biomes[loc]
				var biome: int = palleteMap[idx]
				if biome >= 0:
					var loc_array := Vector3(loc % 16, int(floor(loc / 16)) % 16, int(floor(loc / 256)) % 16)
					change[loc_array] = biome
			
			var chunk_coords := (params[2] as String).split("_")
			changes[{
				dimension = params[1],
				chunk = Vector3(
					int(chunk_coords[0]),
					int(chunk_coords[1]),
					int(chunk_coords[2])
				)
			}] = change
			players.append(player)
			prints("good", player.get_fake_player_name().length())
	
	for chunk_loc in changes:
		var subchange: Dictionary = changes[chunk_loc]
		for loc in subchange:
			var final_loc: Vector3 = chunk_loc.chunk * 16 + loc
			world.set_biome(chunk_loc.dimension, final_loc, subchange[loc])
	
	for player in players:
		gamtest_db.reset_player(player)


func remove_unreferenced_actors(world: MCWorld) -> void:
	for actor in _get_unreferenced_actors(world):
		var id := StreamPeerBuffer.new()
		id.put_data("actorprefix".to_ascii())
		id.big_endian = true
		id.put_64(actor)
		world.delete_db_entry(id.data_array)


func _get_unreferenced_actors(world: MCWorld) -> Array:
	var actors = []
	var actor_refs = []
	
	world.iterate_db(funcref(self, "_iterate_unreferenced_actors"), [actors, actor_refs])
	
	var no_ref_actors := []
	for actor in actors:
		if not actor_refs.has(actor):
			no_ref_actors.append(actor)
	return no_ref_actors


func _iterate_unreferenced_actors(key: PoolByteArray, value: PoolByteArray, data: Array) -> void:
	var actors: Array = data[0]
	var actor_refs: Array = data[1]
	var key_buffer := StreamPeerBuffer.new()
	key_buffer.data_array = key
	
	if key.get_string_from_ascii().begins_with("digp"):
		key_buffer.seek(4)
		var x = key_buffer.get_32()
		var y = key_buffer.get_32()
		var id = key_buffer.get_32() if key_buffer.get_available_bytes() else 0
		
		var value_buffer := StreamPeerBuffer.new()
		value_buffer.big_endian = true
		value_buffer.data_array = value
		while value_buffer.get_available_bytes():
			actor_refs.append(value_buffer.get_64())
	elif key.get_string_from_ascii().begins_with("actorprefix"):
		key_buffer.seek(11)
		key_buffer.big_endian = true
		actors.append(key_buffer.get_64())


func _structures_to_bp(structures: Dictionary) -> void:
	var dir := Directory.new()
	dir.open("user://")
	
	for struct in structures:
		var structure: Dictionary = structures[struct]
		var struct_path: String = BUILD_PATH + "/structures/" + structure.namespace
		dir.make_dir_recursive(struct_path)
		
		var ref_file: String = BUILD_PATH + "/structures/weditstructref_" + structure.id + ".mcstructure"
		_write_nbt_to_file(structure.ref, ref_file)
		var meta_file: String = struct_path + "/weditstructmeta_" + structure.id + ".mcstructure"
		_write_nbt_to_file(structure.meta, meta_file)
		
		for id in structure.structs:
			var struct_file: String = struct_path + "/weditstructexport_" + id + ".mcstructure"
			_write_nbt_to_file(structure.structs[id], struct_file)
	
	var manifest = {
		"format_version": 2,
		"header": {
			"name": "WorldEdit Exported Structures",
			"description": "This pack contains structures that can be imported in-game with WorldEdit.",
			"uuid": Appdata.get_appdata(Appdata.MANIFEST_UUID),
			"version": [ 1, 0, 0 ],
			"min_engine_version": [ 1, 18, 0 ]
		},
		"modules": [
			{
				"description": "data module",
				"type": "data",
				"uuid": Appdata.get_appdata(Appdata.DATA_MODULE_UUID),
				"version": [1, 0, 0]
			}
		]
	}
	
	var file := File.new()
	file.open(BUILD_PATH + "/manifest.json", File.WRITE)
	file.store_string(JSON.print(manifest, " "))
	file.close()
	dir.copy("res://bp_template/pack_icon.png", BUILD_PATH + "/pack_icon.png")


func _find_behaviour_pack(folder: String, uuid: String) -> String:
	var dir := Directory.new()
	var has_manifest := false
	var children := []
	
	if not dir.dir_exists(folder):
		return ""
	
	dir.open(folder)
	dir.list_dir_begin(true, true)
	var path := dir.get_next()
	while path:
		children.append({
			path = folder.plus_file(path),
			is_dir = dir.current_is_dir()
		})
		if path == "manifest.json":
			has_manifest = true
			break
		path = dir.get_next()
	dir.list_dir_end()
	
	if has_manifest:
		var file := File.new()
		file.open(folder.plus_file("manifest.json"), File.READ)
		var json_parse_result := JSON.parse(file.get_as_text())
		file.close()
		
		if json_parse_result.error || typeof(json_parse_result.result) != TYPE_DICTIONARY:
			return ""
		if json_parse_result.result.get("header", {}).get("uuid", "") == uuid:
			return folder
	else:
		for child in children:
			if not child.is_dir:
				continue
			
			if _find_behaviour_pack(child.path, uuid):
				return child.path
	
	return ""


func _write_nbt_to_file(nbt: NBT.CompoundTag, path: String) -> void:
	var file := File.new()
	var stream := StreamPeerBuffer.new()
	NBT.write(stream, nbt)
	file.open(path, File.WRITE)
	file.store_buffer(stream.data_array)
	file.close()


func _struct_key(id: String, namespace := "mystructure") -> String:
	return "structuretemplate_" + namespace + ":" + id


func _execute_shell(cmd: String, args: PoolStringArray, blocking := true) -> int:
	for i in args.size():
		if " " in args[i]:
			args[i] = "\"\"" + args[i] + "\"\""
	args.insert(0, cmd)
	return OS.execute("powershell", args, blocking)


func _compress(path: String, output: String) -> void:
	var dir := Directory.new()
	dir.open(path.get_base_dir())
	_execute_shell("Compress-Archive", [
		"-Path", ProjectSettings.globalize_path(path) + "/*",
		"-DestinationPath", ProjectSettings.globalize_path(path + ".zip")
	])
	dir.rename(path + ".zip", output)


func _open_world(world_path: String) -> MCWorld:
	var world := MCWorld.new(world_path)
	world.open()
	return world


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
		
		for world_path in DirUtil.get_content(Global.COM_MOJANG[0].plus_file("minecraftWorlds")):
			var folder: String = world_path.get_file()
			var image: String = world_path.plus_file("world_icon.jpeg")
			if not dir.file_exists(image):
				continue
			
			var modified_time := file.get_modified_time(image)
			if not prev_times.has(folder) or modified_time > prev_times[folder]:
				prev_times[folder] = modified_time
				
				var changes := check_for_changes(world_path)
				if not changes.empty():
					print("Changes detected in %s." % folder)
					var world := _open_world(world_path)
					if not world.is_open():
						printerr("Failed to open %s!" % folder)
						continue
					remove_unreferenced_actors(world)
					extract_exported_structures(world, world_path)
					apply_biome_changes(world)
					world.save()
					world.close()
		
		yield(get_tree().create_timer(1.0), "timeout")


func _on_AutoProcess_toggled(button_pressed: bool) -> void:
	set_world_check_locked(not button_pressed)


func _on_Button_pressed() -> void:
	$ChooseWorld.popup_centered_ratio()


func _on_ConfirmProcessDialog_confirmed() -> void:
	var world_path: String = $"%WorldPath".text
	var world := _open_world(world_path)
	if not world.is_open():
		printerr("Failed to open world!")
		return
	
	remove_unreferenced_actors(world)
	extract_exported_structures(world, world_path)
	apply_biome_changes(world)
	world.save()
	world.close()


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
