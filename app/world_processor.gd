extends Reference

const LevelDB = preload("res://leveldb_ref.gdns")

const BUILD_PATH := "user://temp_behavior_pack"

const MAX_STRUCT_SIZE := Vector3(64, 256, 64)


func check_for_changes(world: MCWorld) -> Dictionary:
	var changes := {}
	if not world.is_open():
		return { err = "Failed to open world!" }
	
	var scoreboard := world.get_scoreboard()
	
	var exports := {}
	var objective := scoreboard.get_objective("wedit:exports")
	if objective:
		for score_player in objective.get_players():
			if score_player.get_type() == MCWorld.ScoreboardPlayerType.FAKE_PLAYER:
				var struct_name: String = score_player.get_fake_player_name()
				exports[struct_name] = struct_name.split(":", false, 1)
	
	if not exports.empty():
		var structures := {}
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
		changes.exports = structures
	
	var db_objective := world.get_scoreboard().get_objective("GAMETEST_DB")
	if db_objective:
		var biome_changes := {}
		var players := []
		for player in db_objective.get_players():
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
				var palette: Array = result.palette
				
				var paletteMap := { 0: -1 }
				for i in palette.size():
					paletteMap[i + 1] = palette[i]
				
				for loc in 4096:
					loc = int(loc)
					var idx: int = biomes[loc]
					var biome: int = paletteMap[idx]
					if biome >= 0:
						var loc_array := Vector3(loc % 16, int(floor(loc / 16)) % 16, int(floor(loc / 256)) % 16)
						change[loc_array] = biome
				
				var chunk_coords := (params[2] as String).split("_")
				biome_changes[{
					dimension = params[1],
					chunk = Vector3(
						int(chunk_coords[0]),
						int(chunk_coords[1]),
						int(chunk_coords[2])
					)
				}] = change
				players.append(player)
		if not biome_changes.empty():
			changes.biomes = biome_changes
			changes.biome_data_players = players
	
	return changes


func backup(world: MCWorld) -> int:
	var dir := Directory.new()
	var path := world.path
	var backup_path := path.get_base_dir().plus_file(path.get_file() + " (Backup)")
	
	dir.open(backup_path.get_base_dir())
	if dir.dir_exists(backup_path):
		var dupe := 2
		backup_path = path.get_base_dir().plus_file(path.get_file() + " (Backup_%s)" % dupe)
		while dir.dir_exists(backup_path):
			dupe += 1
	
	var err := DirUtil.copy(path, backup_path, dir)
	if err != OK:
		return err
	
	MCWorld.new(backup_path).rename(world.get_name() + " (Backup)")	
	return err


func apply_changes(args: Array) -> int:
	var world: MCWorld = args[0]
	var changes: Dictionary = args[1]
	
	## Apply Biome Changes
	
	if changes.has("biomes"):
		var gametest_db := world.get_scoreboard().get_objective("GAMETEST_DB")
		var biome_data_players: Array = changes.biome_data_players
		var biome_changes: Dictionary = changes.biomes
		for chunk_loc in biome_changes:
			var subchange: Dictionary = biome_changes[chunk_loc]
			for loc in subchange:
				var final_loc: Vector3 = chunk_loc.chunk * 16 + loc
				world.set_biome(chunk_loc.dimension, final_loc, subchange[loc])
		
		for player in biome_data_players:
			gametest_db.reset_player(player)
	
	## Export Structures
	
	if changes.has("exports"):
		var structures: Dictionary = changes.exports
		
		DirUtil.remove(BUILD_PATH)
		if world_in_minecraft(world.path):
			var prev_pack := find_export_pack(world.path)
			if prev_pack:
				DirUtil.copy(prev_pack, BUILD_PATH)
				_structures_to_bp(structures)
				DirUtil.replace(prev_pack, BUILD_PATH)
			else:
				var beh_packs_folder := world.path.get_base_dir().get_base_dir().plus_file("development_behavior_packs")
				_structures_to_bp(structures)
				DirUtil.copy(BUILD_PATH, beh_packs_folder.plus_file("WorldEdit SP"))
		else:
			_structures_to_bp(structures)
			DirUtil.copy(BUILD_PATH, world.path + "_export")
			_compress(world.path + "_export", world.path + "_export.mcpack")
		
		world.get_scoreboard().remove_objective("wedit:exports")
		for struct in structures:
			var id: String = structures[struct].id
			var namespace: String = structures[struct].namespace
			world.delete_db_entry((_struct_key("weditstructref_" + id)).to_ascii())
			world.delete_db_entry((_struct_key("weditstructmeta_" + id, namespace)).to_ascii())
			for subid in structures[struct].structs:
				world.delete_db_entry((_struct_key("weditstructexport_" + subid, namespace)).to_ascii())
	
	return world.save()


func world_in_minecraft(world_path: String) -> bool:
	return world_path.begins_with(Global.COM_MOJANG[0]) or world_path.begins_with(Global.COM_MOJANG[1])


func find_export_pack(world_path: String) -> String:
	var beh_packs_folder := world_path.get_base_dir().get_base_dir().plus_file("development_behavior_packs")
	return _find_behaviour_pack(beh_packs_folder, Appdata.get_appdata(Appdata.MANIFEST_UUID, UUID.v4()))


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
			"uuid": Appdata.get_appdata(Appdata.MANIFEST_UUID, UUID.v4()),
			"version": [ 1, 0, 0 ],
			"min_engine_version": [ 1, 18, 0 ]
		},
		"modules": [
			{
				"description": "data module",
				"type": "data",
				"uuid": Appdata.get_appdata(Appdata.DATA_MODULE_UUID, UUID.v4()),
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
	dir.remove(path)
