import json
import os
import sys
from pathlib import Path

sys.path.append(sys.argv[1])

from build_project import execute

with open("addons/silicon.util.gdnative_helper/build_config.json", 'r') as config:
	args = json.load(config)
	args["library_name"] = sys.argv[2]
	args["target_file_path"] = sys.argv[3]
	args["source_path"] = sys.argv[4]
	args["library_extension"] = sys.argv[5]
	args["platform"] = sys.argv[6]
	args["arch"] = sys.argv[7]
	args["target"] = sys.argv[8]
	args["gd_settings_dir"] = str(Path(sys.argv[1], "../..").resolve())

	os.chdir(sys.argv[1])

	# Get older dll out of the way on Windows.
	lib_name = "%s.%s" % (args["target_file_path"], args["library_extension"])
	try:
		if os.path.exists(lib_name) and args["platform"] == "windows" and os.name == "nt":
			# if os.path.exists(lib_name + ".old"):
			# 	os.remove(lib_name + ".old")
			os.replace(lib_name, lib_name + ".old")
	except OSError as e:
		raise OSError("Cannot delete Windows DLL at \"%s\"! Please delete it manually." % lib_name)

	# Create directory for library files to reside
	try:
		os.makedirs(Path(args["target_file_path"]).parent)
	except: pass

	execute(args)
