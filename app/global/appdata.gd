extends Node

const APPDATA_PATH = "user://appdata.cfg"

const MANIFEST_UUID = "manifest_uuid"
const DATA_MODULE_UUID = "data_module_uuid"
const AUTO_PROCESS_WORLDS = "auto_process_worlds"

var userdata_cfg := ConfigFile.new()

func _init() -> void:
	var err := userdata_cfg.load(APPDATA_PATH)
	if err:
		userdata_cfg.set_value("", MANIFEST_UUID, UUID.v4())
		userdata_cfg.set_value("", DATA_MODULE_UUID, UUID.v4())
		userdata_cfg.set_value("", AUTO_PROCESS_WORLDS, false)
		# warning-ignore:return_value_discarded
		userdata_cfg.save(APPDATA_PATH)


func get_appdata(name: String, default):
	return userdata_cfg.get_value("", name, default)


func set_appdata(name: String, value) -> void:
	userdata_cfg.set_value("", name, value)
	# warning-ignore:return_value_discarded
	userdata_cfg.save(APPDATA_PATH)
