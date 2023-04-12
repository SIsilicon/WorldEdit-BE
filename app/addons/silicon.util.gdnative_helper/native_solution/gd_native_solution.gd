tool
class_name GDNativeSolution, "res://addons/silicon.util.gdnative_helper/native_solution/gd_native_solution.svg"
extends Resource

export var libraries := {}
export var classes := {}

export var platform_archs := {"windows": [], "linux": [], "osx": [], "android": [], "ios": []}
export var debug_mode := true

var languages: Dictionary

func create_library(lib_path: String, language: String) -> void:
	var library := Library()
	library.name = lib_path.get_file().replace(".gdnlib", "")
	library.language = language
	library.data_folder = "res://addons/gdnative_data/" + library.name
	
	var native_lib := GDNativeLibrary.new()
	native_lib.resource_path = lib_path
	ResourceSaver.save(lib_path, native_lib, ResourceSaver.FLAG_CHANGE_PATH)
	library.native_lib = native_lib
	
	libraries[library.name] = library
	generate_library_code(library)


func create_class(library_name: String, cls_name: String, cls_path: String, base: String) -> void:
	var library: Dictionary = libraries[library_name]
	var language: Dictionary = languages[library.language]
	var cls_file_name := get_filename(cls_path)
	
	var classs := Class()
	classs.name = cls_name
	classs.base = base
	classs.source_file = "src/%s.%s" % [cls_file_name, language.source_extension]
	if not language.header_extension.empty():
		classs.header_file = "src/%s.%s" % [cls_file_name, language.header_extension]
	
	var native_script := NativeScript.new()
	native_script.set("class_name", classs.name) # class_name is a keyword, so a setter is required here.
	native_script.library = library.native_lib
	native_script.resource_path = cls_path
	ResourceSaver.save(cls_path, native_script, ResourceSaver.FLAG_CHANGE_PATH)
	classs.native_script = native_script
	
	if not library.classes.has(classs.name):
		library.classes.append(classs.name)
	classes[classs.name] = classs
	classs.library = library.name
	generate_class_code(classs)
	generate_library_code(library)


func delete_library(lib_name: String) -> int:
	var library: Dictionary = libraries[lib_name]
	var err := OK
	
	while not library.classes.empty():
		err = delete_class(library.classes[0])
		if err:
			printerr("failed to delete class '%s'!" % library.classes[0])
			return err
	
	var dir := Directory.new()
	err = dir.remove(library.source_file)
	if err:
		printerr("Failed to delete %s's source file!" % lib_name)
		return err
	if not library.header_file.empty():
		err = dir.remove(library.header_file)
		if err:
			printerr("Failed to delete %s's header file!" % lib_name)
			return err
	
	err = dir.remove(library.native_lib.resource_path)
	if err:
		printerr("Failed to delete %s's native library!" % lib_name)
		return err
	
	libraries.erase(lib_name)
	return err


func delete_class(cls_name: String) -> int:
	var classs: Dictionary = classes[cls_name]
	var library := class_get_library(classs)
	var err := OK
	
	var dir := Directory.new()
	err = dir.remove(class_abs_source_file(classs))
	if err:
		printerr("Failed to delete %s's source file!" % cls_name)
		return err
	if not classs.header_file.empty():
		err = dir.remove(class_abs_header_file(classs))
		if err:
			printerr("Failed to delete %s's header file!" % cls_name)
			return err
	
	err = dir.remove(classs.native_script.resource_path)
	if err:
		printerr("Failed to delete %s's native script!" % cls_name)
		return err
	
	library.classes.erase(classs.name)
	classes.erase(classs.name)
	
	generate_library_code(library)
	return err


func generate_class_code(classs: Dictionary) -> void:
	var library := class_get_library(classs)

	var dir := Directory.new()
	dir.make_dir_recursive(class_abs_source_file(classs).get_base_dir())

	var language: Dictionary = languages[library.language]

	var class_code: String

	# Class source
	var file := File.new()
	for template in language.class_templates:
		var error := file.open(template, File.READ)
		if not error:
			class_code = file.get_as_text()
		else:
			printerr("Failed to load template at: '%s'! Returned error code: %d." % [template, error])
			file.close()
			return 
		file.close()
		class_code = class_code.replace("%CLASS_NAME%", classs.name)
		class_code = class_code.replace("%CLASS_FILE_NAME%", get_filename(classs.source_file))
		class_code = class_code.replace("%CLASS_BASE%", classs.base)
		class_code = class_code.replace("%LIBRARY_NAME%", library.name)

		if template.get_extension() == language.header_extension:
			file.open(class_abs_header_file(classs), File.WRITE)
		else:
			file.open(class_abs_source_file(classs), File.WRITE)
		file.store_string(class_code)
		file.close()
		
		if template.get_extension() == language.header_extension:
			classs.header_modified_time = file.get_modified_time(class_abs_header_file(classs))
		else:
			classs.source_modified_time = file.get_modified_time(class_abs_source_file(classs))


func generate_library_code(library: Dictionary) -> void:
	var language: Dictionary = languages[library.language]
	
	var lib_name: String = library.name
	var lib_classes: Array = library.classes
	var class_names := []
	var class_file_names := []
	var class_bases := []
	for cls in lib_classes:
		class_names.append(cls)
		class_file_names.append(get_filename(classes[cls].source_file))
		class_bases.append(classes[cls].base)
	
	var dir := Directory.new()
	dir.make_dir_recursive(library.data_folder + "/src")
	
	var library_code: String
	var file := File.new()
	
	for template in language.lib_templates:
		var error := file.open(template, File.READ)
		if not error:
			library_code = file.get_as_text()
		else:
			printerr("Failed to load template at: '%s'! Returned error code: %d." % [template, error])
			file.close()
			return 
		file.close()
		
		var regex := RegEx.new()
		regex.compile("\\{CLASS_TEMPLATE\\}\\n([\\S\\s]+?)\\n\\{CLASS_TEMPLATE\\}")
		var matches := regex.search_all(library_code)
		
		for i in range(matches.size() - 1, -1, -1):
			var result: RegExMatch = matches[i]
			var sub := result.get_string(1)
			library_code.erase(result.get_start(), len(result.get_string()))
			
			for j in class_names.size():
				var replace := sub.replace("%CLASS_NAME%", class_names[j])
				replace = replace.replace("%CLASS_FILE_NAME%", class_file_names[j])
				replace = replace.replace("%CLASS_BASE%", class_bases[j])
				replace = replace.replace("%LIBRARY_NAME%", lib_name)
				library_code = library_code.insert(result.get_start(), replace + "\n")
		
		var file_path := "%s/src/%s.%s" % [library.data_folder, lib_name, template.get_extension()]
		file.open(file_path, File.WRITE)
		file.store_string(library_code)
		file.close()
		
		var time := file.get_modified_time(file_path)
		if template.get_extension() == language.header_extension:
			library.header_file = file_path
			library.header_modified_time = time
		else:
			library.source_file = file_path
			library.source_modified_time = time
	
	# Generate a .gdignore along side the source code.
	file.open("%s/src/.gdignore" % library.data_folder, File.WRITE)
	file.close()


func class_exists(classs: String, library := "") -> bool:
	var lib_iterate: Array = libraries.keys() if library.empty() else [library]
	for lib in lib_iterate:
		for cls in libraries[lib].classes:
			if cls == classs:
				return true
	return false


func find_class_by_script(script: NativeScript) -> Dictionary:
	for classs in classes.values():
		if classs.native_script == script:
			return classs
	return Class()


static func get_filename(string: String) -> String:
	return string.get_file().trim_suffix("." + string.get_extension())

# For some odd reason, inner classes don't get saved well,
# So we're gonna be defining them "C Style".

func Library() -> Dictionary:
	return {
		name = "",
		
		classes = [],
		language = "",
		native_lib = null, # GDNativeLibrary
		
		source_file = "",
		header_file = "",
		source_modified_time = 0,
		header_modified_time = 0,
		
		build_options = {},
		
		# Includes source code and binary folder
		data_folder = ""
	}


func library_update_modified_times(lib: Dictionary) -> void:
	var file := File.new()
	lib.source_modified_time = file.get_modified_time(lib.source_file)
	if not lib.header_file.empty():
		lib.header_modified_time = file.get_modified_time(lib.header_file)
	
	for cls in lib.classes:
		var classs = classes[cls]
		classs.source_modified_time = file.get_modified_time(class_abs_source_file(classs))
		if not classs.header_file.empty():
			classs.header_modified_time = file.get_modified_time(class_abs_header_file(classs))


func library_are_sources_modified(lib: Dictionary) -> bool:
	var file := File.new()
	
	if lib.source_modified_time != file.get_modified_time(lib.source_file):
		return true
	if not lib.header_file.empty():
		if lib.header_modified_time != file.get_modified_time(lib.header_file):
			return true
	
	for cls in lib.classes:
		var classs = classes[cls]
		if classs.source_modified_time != file.get_modified_time(class_abs_source_file(classs)):
			return true
		if not classs.header_file.empty():
			if classs.header_modified_time != file.get_modified_time(class_abs_header_file(classs)):
				return true
	
	return false


func Class() -> Dictionary:
	return {
		name = "",
		base = "",
		
		library = "", # Library name
		native_script = null, # NativeScript
		
		source_file = "",
		header_file = "",
		source_modified_time = 0,
		header_modified_time = 0
	}


func class_get_library(cls: Dictionary) -> Dictionary:
	return libraries[cls.library]


func class_abs_source_file(cls: Dictionary) -> String:
	return class_get_library(cls).data_folder + "/" + cls.source_file


func class_abs_header_file(cls: Dictionary) -> String:
	return class_get_library(cls).data_folder + "/" + cls.header_file


func class_is_code_modified(cls: Dictionary) -> bool:
	var file := File.new()
	var modified: bool = cls.source_modified_time != file.get_modified_time(class_abs_source_file(cls))
	if not (modified or cls.header_file.empty()):
		modified = modified or cls.header_modified_time != file.get_modified_time(class_abs_header_file(cls))
	return modified
