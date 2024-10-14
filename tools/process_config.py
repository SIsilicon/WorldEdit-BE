import argparse
import json

parser = argparse.ArgumentParser(
    description="Build config file from worldedit_settings.json"
)
parser.add_argument(
    "--target",
    choices=["release", "debug", "server"],
    default="debug",
    help="Whether to build the addon in debug or release mode or for servers",
)
parser.add_argument(
    "--watch",
    "-w",
    action="store_true",
    help="Watch config.js and wordedit_settings.json for changes and update",
)
parser.add_argument(
    "--generateConfigTS",
    action="store_true",
    help="Generate/update config.ts in the src folder",
)
parser.add_argument(
    "--generateConfigJSON",
    action="store_true",
    help="Generate/update variables.json in the builds folder",
)
args = parser.parse_args()

settings = {
    "debug": {
        "description": "Enables debug messages to content logs.",
        "default": args.target == "debug",
    }
}
version_str = ""


def generateScript(isServer):
    result = ""
    if isServer:
        result += 'import { variables } from "@minecraft/server-admin";\n\n'

    result += "export default {\n"
    for name, data in settings.items():
        if isServer:
            variable = data["default"]
            if type(data["default"]) is bool:
                variable = "true" if data["default"] else "false"
            elif type(data["default"]) is str:
                variable = f'"{data["default"]}"'
            result += f'  {name}: variables.get("{name}") || {variable},\n'
        else:
            value = data["default"]

            if type(value) is str:
                value = f'"{value}"'
            elif type(value) is bool:
                value = "true" if value else "false"

            result += "  /**\n"
            for line in data["description"].splitlines():
                result += f"   * {line}\n"
            result += "   */\n"
            result += f"  {name}: {value},\n"
    result += "};\n\n"

    result += "\n".join(
        [
            "// WorldEdit version (do not change)",
            f'export const VERSION = "{version_str}";',
        ]
    )
    return result


def generateVariables():
    result = []
    for name, data in settings.items():
        value = data["default"]

        if type(value) is str:
            value = f'"{value}"'
        elif type(value) is bool:
            value = "true" if value else "false"

        var = "\n    /**\n"
        for line in data["description"].splitlines():
            var += f"     * {line}\n"
        var += "     */\n"
        var += f'    "{name}": {value}'
        result.append(var)
    return "{" + ",".join(result) + "\n}"


prevResult = ""


def update():
    global prevResult
    try:
        with open("BP/scripts/config.js", "r") as file:
            if len(prevResult) != 0 and prevResult == file.read():
                return
    except IOError:
        pass

    with open("BP/scripts/config.js", "w") as file:
        prevResult = generateScript(args.target == "server")
        file.write(prevResult)


# load settings file
with open("worldedit_settings.json", "r") as file:
    settings = {**settings, **json.load(file)}

# load addon version
with open("mc_manifest.json", "r") as file:
    manifest = json.load(file)
    version = manifest["header"]["version"]

    if type(version) is str:
        version_str = version
    else:
        version_str = ".".join(map(str, version)) + (
            " [BETA]" if len(version) > 3 else ""
        )
# Generate src/config.ts
if args.generateConfigTS:
    with open("src/config.ts", "w") as file:
        file.write(generateScript(False))
    exit(0)

# Generate builds/variables.json
if args.generateConfigJSON:
    with open("builds/variables.json", "w") as file:
        file.write(generateVariables())
    exit(0)

if args.watch:
    import time

    from watchdog.events import FileSystemEventHandler
    from watchdog.observers import Observer

    class MyHandler(FileSystemEventHandler):
        def on_modified(self, ev):
            if ev.src_path in ["./worldedit_settings.json", "BP/scripts/config.js"]:
                update()

    obsSettings = Observer()
    obsSettings.schedule(MyHandler(), path=".")
    obsSettings.start()

    obsConfigJS = Observer()
    obsConfigJS.schedule(MyHandler(), path="BP/scripts")
    obsConfigJS.start()

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        obsSettings.stop()
        obsConfigJS.stop()

    obsSettings.join()
    obsConfigJS.join()
else:
    update()
