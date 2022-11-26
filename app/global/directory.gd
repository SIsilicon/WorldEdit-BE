extends Node


func remove(path: String) -> int:
	var dir := Directory.new()
	dir.open(path.get_base_dir())
	return _modify_dir(dir, path, "", "remove")


func copy(from: String, to: String) -> int:
	var dir := Directory.new()
	dir.open(from.get_base_dir())
	return _modify_dir(dir, from, to, "copy")


func replace(original: String, with: String) -> int:
	var dir := Directory.new()
	dir.open(original.get_base_dir())
	
	var err := _modify_dir(dir, original, "", "remove")
	if err:
		return err
	
	dir.open(with.get_base_dir())
	return _modify_dir(dir, with, original, "copy")


func get_content(path: String) -> Array:
	var children := []
	var dir := Directory.new()
	dir.open(path)
	
	dir.list_dir_begin(true, true)
	var child := dir.get_next()
	while child:
		children.append(path.plus_file(child))
		child = dir.get_next()
	
	return children


func _modify_dir(dir: Directory, from: String, to: String, mode := "copy") -> int:
	if not dir.dir_exists(from):
		return ERR_FILE_NOT_FOUND
	
	var original_dir := dir.get_current_dir()
	if not to.is_abs_path():
		to = original_dir + '/' + to
	dir.change_dir(from)
	
	dir.list_dir_begin(true, true)
	var path := dir.get_next()
	var err := 0
	while path:
		if dir.current_is_dir():
			var inner_dir := Directory.new()
			inner_dir.open(dir.get_current_dir())
			err = _modify_dir(inner_dir, path, to + '/' + path, mode)
			if err:
				printerr("Failed to %s directory '%s' to '%s' from '%s'" % [mode, path, to + '/' + path, dir.get_current_dir()])
				break
		else:
			if mode == "copy":
				dir.make_dir_recursive(to)
				err = dir.copy(dir.get_current_dir() + '/' + path, to.plus_file(path))
			elif mode == "remove":
				err = dir.remove(dir.get_current_dir() + '/' + path)
			else:
				printerr("Invalid directory mode: %s" % mode)
				break
			
			if err:
				printerr("failed to %s file '%s' to '%s' from '%s'" % [mode, path, to + '/' + path, dir.get_current_dir()])
				break
		
		path = dir.get_next()
	dir.list_dir_end()
	if mode == "remove":
		err = dir.remove(dir.get_current_dir())
	dir.change_dir(original_dir)
	return err
