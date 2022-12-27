tool
extends EditorPlugin


const NativeDialogs = preload("./native_dialogs.gd")


func _enter_tree():
	add_custom_type(
		"NativeDialogMessage",
		"Node",
		NativeDialogs.Message,
		preload("./icons/native_dialog_message.png")
	)

	add_custom_type(
		"NativeDialogNotify",
		"Node",
		NativeDialogs.Notify,
		preload("./icons/native_dialog_notify.png")
	)

	add_custom_type(
		"NativeDialogOpenFile",
		"Node",
		NativeDialogs.OpenFile,
		preload("./icons/native_dialog_open_file.png")
	)

	add_custom_type(
		"NativeDialogSaveFile",
		"Node",
		NativeDialogs.SaveFile,
		preload("./icons/native_dialog_save_file.png")
	)

	add_custom_type(
		"NativeDialogSelectFolder",
		"Node",
		NativeDialogs.SelectFolder,
		preload("./icons/native_dialog_select_folder.png")
	)


func _exit_tree():
	remove_custom_type("NativeDialogMessage")
	remove_custom_type("NativeDialogNotify")
	remove_custom_type("NativeDialogOpenFile")
	remove_custom_type("NativeDialogSaveFile")
	remove_custom_type("NativeDialogSelectFolder")
