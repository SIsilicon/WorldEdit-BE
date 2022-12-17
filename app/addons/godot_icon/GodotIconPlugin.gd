tool
extends EditorPlugin

const CREATE_ICON_FILENAME := "user://CreateIcon.gd"
const IconCreatorScene := preload("res://addons/godot_icon/IconCreator.tscn")
const IconReplacerScene := preload("res://addons/godot_icon/IconReplacer.tscn")

var icon_creator: ConfirmationDialog
var icon_replacer: ConfirmationDialog


func _enter_tree() -> void:
	add_tool_menu_item("Icon Creator", self, "show_icon_creator")
	add_tool_menu_item("Icon Replacer", self, "show_icon_replacer")


func _exit_tree() -> void:
	remove_tool_menu_item("Icon Creator")
	remove_tool_menu_item("Icon Replacer")
	if icon_creator:
		icon_creator.queue_free()
	if icon_replacer:
		icon_replacer.queue_free()


func show_icon_creator(_ignore) -> void:
	if not icon_creator:
		icon_creator = IconCreatorScene.instance()
		get_editor_interface().add_child(icon_creator)
	icon_creator.popup_centered()


func show_icon_replacer(_ignore) -> void:
	if not icon_replacer:
		icon_replacer = IconReplacerScene.instance()
		get_editor_interface().add_child(icon_replacer)
	icon_replacer.popup_centered()
