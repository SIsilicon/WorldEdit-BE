tool
extends HBoxContainer

signal path_changed(path)

export var path := "" setget set_path
export(int, "Open File", "Open Files", "Open Dir", "Open Any", "Save File") var mode := 0
export var file_dialog: NodePath setget set_file_dialog

var file_dialog_node: FileDialog
var selecting := false

func _ready() -> void:
	if file_dialog:
		file_dialog_node = get_node_or_null(file_dialog)
	if file_dialog_node:
		file_dialog_node.connect("dir_selected", self, "_on_FileDialog_path_selected")
		file_dialog_node.connect("file_selected", self, "_on_FileDialog_path_selected")
		file_dialog_node.connect("popup_hide", self, "_on_FileDialog_path_selected", ["CANCELLED"])
	
	yield(self, "visibility_changed")
	$Button.icon = get_icon("Folder", "EditorIcons")


func set_path(value: String) -> void:
	path = value
	$LineEdit.text = path
	emit_signal("path_changed", path)


func set_file_dialog(value: NodePath) -> void:
	file_dialog = value
	file_dialog_node = get_node_or_null(file_dialog)


func _on_FileDialog_path_selected(path: String) -> void:
	if selecting and path != "CANCELLED":
		set_path(path)
		selecting = false


func _on_LineEdit_text_changed(new_text: String) -> void:
	path = new_text
	emit_signal("path_changed", path)


func _on_Button_pressed() -> void:
	if path.is_valid_filename():
		file_dialog_node.filename = path
	file_dialog_node.mode = mode
	file_dialog_node.popup_centered_ratio(0.6)
	selecting = true
