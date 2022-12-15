extends Node

signal task_finished(id, result)

const COM_MOJANG = [
	"C:/Users/rouje/AppData/Local/Packages/Microsoft.MinecraftUWP_8wekyb3d8bbwe/LocalState/games/com.mojang",
	"C:/Users/rouje/AppData/Local/Packages/Microsoft.MinecraftWindowsBeta_8wekyb3d8bbwe/LocalState/games/com.mojang"
]
const WORLDS_FOLDER = "/minecraftWorlds"

var threads := []
var debug_id := 0

func _physics_process(_delta) -> void:
	for thread in threads:
		if not thread.is_alive():
			threads.erase(thread)
			emit_signal("task_finished", thread.get_id(), thread.wait_to_finish())


func start_task(obj: Object, method: String, arg, priority := Thread.PRIORITY_LOW) -> String:
	if OS.is_debug_build():
		debug_id += 1
		var result = obj.call(method, arg)
		call_deferred("emit_signal", "task_finished", str(debug_id), result)
		return str(debug_id)
	else:
		var thread := Thread.new()
		thread.start(obj, method, arg, priority)
		threads.push_back(thread)
		return thread.get_id()
