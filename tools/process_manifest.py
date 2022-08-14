from pathlib import Path
import glob, os, shutil, json, argparse

parser = argparse.ArgumentParser(description='Build manifest files from \'mc_manifest.json\'.')
parser.add_argument('--target', choices=['release', 'debug', 'release_server'], default='debug', help='Whether to build the addon in debug or release mode or for servers.')
parser.add_argument('--version', choices=['1.18', 'latest'], default='latest', help='The version of Minecraft to build for.')
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
            if key.startswith('bp_'):
                bp_element[key[3:]] = value
            elif key.startswith('rp_'):
                rp_element[key[3:]] = value
            else:
                process(key, value)
    elif isinstance(element, list):
        i = 0
        for value in element:
            process(i, value)
            i = i + 1

# load base manifest
with open('mc_manifest.json', 'r') as file:
    manifest = json.load(file)
    processJsonElement(manifest, bp_manifest, rp_manifest)

if args.target != 'release_server':
    bp_manifest['dependencies'].append({
        'uuid': rp_manifest['header']['uuid'],
        'version': rp_manifest['header']['version']
    })

if args.target == 'debug':
    bp_manifest['header']['name'] += ' [DEBUG]'
    rp_manifest['header']['name'] += ' [DEBUG]'

if args.version == '1.18':
    bp_manifest['header']['min_engine_version'] = [1, 18, 10]
    bp_manifest['modules'][1]['type'] = 'javascript'
    del bp_manifest['modules'][1]['language']

    rp_manifest['header']['min_engine_version'] = [1, 18, 10]

# export behaviour and resource manifests
with open('BP/manifest.json', 'w') as file:
    json.dump(bp_manifest, file, indent=4)
with open('RP/manifest.json', 'w') as file:
    json.dump(rp_manifest, file, indent=4)