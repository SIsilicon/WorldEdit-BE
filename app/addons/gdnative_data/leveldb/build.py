
import os
from distutils.command.build import build
from pathlib import Path


def execute(args):
    run_command = args["run_commands"]
    source_path = Path(args["source_path"])
    target_file_path = args["target_file_path"]
    build_target = "Debug" if args["target"] == "debug" else "Release"

    run_command(str(source_path / "build"), [
        "cmake", "--build", ".", "--target", "leveldb", "--config", build_target
    ])
    
    if os.path.exists(target_file_path + ".exp"):
        os.remove(target_file_path + ".exp")
    if os.path.exists(target_file_path + ".lib"):
        os.remove(target_file_path + ".lib")

    os.rename(source_path / f"build/{build_target}/leveldb.dll", target_file_path + ".dll")
    os.rename(source_path / f"build/{build_target}/leveldb.exp", target_file_path + ".exp")
    os.rename(source_path / f"build/{build_target}/leveldb.lib", target_file_path + ".lib")
