tool
extends Tree

var root: TreeItem
var errors := []
var warnings := []

func _ready() -> void:
	clear()


func clear() -> void:
	.clear()
	errors.clear()
	warnings.clear()
	root = create_item()


func push_error(err: String) -> void:
	var item := create_item(root)
	item.set_text(0, err)
	item.set_icon(0, get_icon("Error", "EditorIcons"))
	errors.append(item)


func push_warning(warn: String) -> void:
	var item := create_item(root)
	item.set_text(0, warn)
	item.set_icon(0, get_icon("Warning", "EditorIcons"))
	warnings.append(item)
