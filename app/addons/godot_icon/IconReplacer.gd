tool
extends ConfirmationDialog

const ReplaceIconScript := preload("res://addons/godot_icon/ReplaceIcon.gd")

var replace_icon := ReplaceIconScript.new()
var executable_path: String
var icon_path: String
var error := false


func _ready() -> void:
	replace_icon.error_handler = self
	replace_icon.error_callback = "print_error"
	$Buttons/ChooseExecutable.connect("pressed", $ChooseExecutableDialog, "popup_centered")
	$ChooseExecutableDialog.connect("file_selected", self, "on_executable_selected")
	$Buttons/ChooseIcon.connect("pressed", $ChooseIconDialog, "popup_centered")
	$ChooseIconDialog.connect("file_selected", self, "on_icon_path_selected")
	connect("confirmed", self, "on_confirmed")
	disable_ok()


func on_executable_selected(_executable_path: String) -> void:
	executable_path = _executable_path
	$Buttons/ChooseExecutable.text = executable_path
	$Buttons/Errors.text = ""
	error = false
	disable_ok()


func on_icon_path_selected(_icon_path: String) -> void:
	icon_path = _icon_path
	$Buttons/ChooseIcon.text = icon_path
	$Buttons/Errors.text = ""
	error = false
	remove_all_children($Buttons/Images)
	var bytes := read_icon(icon_path)
	if bytes.size() and validate_icon_header(bytes):
		var images := replace_icon.Icon.new(bytes).images
		for size in images.keys():
			$Buttons/Images.add_child(create_texture_rect(images[size]))
	else:
		icon_path = ""
		$Buttons/ChooseIcon.text = "Choose icon"
	disable_ok()


func validate_icon_header(bytes: PoolByteArray) -> bool:
	var header := PoolByteArray([0, 0, 1, 0, 6, 0])
	for offset in header.size():
		if bytes[offset] != header[offset]:
			return false
	return true


func create_texture_rect(bytes: PoolByteArray) -> TextureRect:
	var image := Image.new()
	image.load_png_from_buffer(bytes)
	var texture := ImageTexture.new()
	texture.create_from_image(image)
	var texture_rect := TextureRect.new()
	texture_rect.texture = texture
	return texture_rect


func on_confirmed() -> void:
	error = false
	replace_icon.replace_icon($ChooseExecutableDialog.current_path, $ChooseIconDialog.current_path)
	disable_ok()
	if not error:
		if OS.has_feature("Windows"):
			OS.execute("ie4uinit.exe", PoolStringArray(["-show"]))
			OS.execute("ie4uinit.exe", PoolStringArray(["-ClearIconCache"]))
		hide()


func disable_ok() -> void:
	get_ok().disabled = executable_path == "" or icon_path == "" or error


func print_error(error_message) -> void:
	$Buttons/Errors.text += str(error_message, "\n")
	error = true


func remove_all_children(parent: Node) -> void:
	while parent.get_child_count():
		parent.remove_child(parent.get_child(0))


func read_icon(icon_path: String) -> PoolByteArray:
	var file := File.new()
	var io_error := file.open(icon_path, File.READ)
	if not io_error:
		var bytes := file.get_buffer(replace_icon.ICON_SIZE)
		io_error = file.get_error()
		file.close()
		if not io_error:
			return bytes
	print_error(str("Could not open icon file! Error code: ", io_error))
	return PoolByteArray()
