import argparse
import json

parser = argparse.ArgumentParser(
    description="Build manifest files from 'mc_manifest.json'."
)
parser.add_argument(
    "--target",
    choices=["release", "debug", "server"],
    default="debug",
    help="Whether to build the addon in debug or release mode or for servers.",
)
args = parser.parse_args()

bp_manifest = {}
rp_manifest = {}


def processJsonElement(element, bp_element, rp_element):
    def process(key, value):
        if isinstance(value, dict):
            bp_element[key] = {}
            rp_element[key] = {}
            processJsonElement(value, bp_element[key], rp_element[key])
        elif isinstance(value, list):
            bp_element[key] = []
            rp_element[key] = []
            processJsonElement(value, bp_element[key], rp_element[key])
        else:
            if isinstance(bp_element, list):
                bp_element.append(value)
                rp_element.append(value)
            else:
                bp_element[key] = value
                rp_element[key] = value

    if isinstance(element, dict):
        for [key, value] in element.items():
            if key.startswith("bp_"):
                if key.startswith("bp_server_"):
                    sub = bp_element[key[10:]]
                    if isinstance(sub, list):
                        bp_element[key[10:]] = sub + value
                    elif isinstance(sub, dict):
                        bp_element[key[10:]] = {**sub, **value}
                else:
                    bp_element[key[3:]] = value
            elif key.startswith("rp_"):
                rp_element[key[3:]] = value
            else:
                process(key, value)
    elif isinstance(element, list):
        i = 0
        for value in element:
            process(i, value)
            i = i + 1


# load base manifest
with open("mc_manifest.json", "r") as file:
    manifest = json.load(file)
    processJsonElement(manifest, bp_manifest, rp_manifest)

version = manifest["header"]["version"]
bp_manifest["header"]["name"] += " " + ".".join(map(str, version))
rp_manifest["header"]["name"] += " " + ".".join(map(str, version))

if not type(version) is str:
    version = version[:3]
bp_manifest["header"]["version"] = version
rp_manifest["header"]["version"] = version

if not "dependencies" in bp_manifest:
    bp_manifest["dependencies"] = []
bp_manifest["dependencies"].append(
    {"uuid": rp_manifest["header"]["uuid"], "version": rp_manifest["header"]["version"]}
)

if not "dependencies" in rp_manifest:
    rp_manifest["dependencies"] = []
rp_manifest["dependencies"].append(
    {"uuid": bp_manifest["header"]["uuid"], "version": bp_manifest["header"]["version"]}
)

if args.target == "debug":
    bp_manifest["header"]["name"] += " [DEBUG]"
    rp_manifest["header"]["name"] += " [DEBUG]"

# export behaviour and resource manifests
with open("BP/manifest.json", "w") as file:
    json.dump(bp_manifest, file, indent=4)
with open("RP/manifest.json", "w") as file:
    json.dump(rp_manifest, file, indent=4)
