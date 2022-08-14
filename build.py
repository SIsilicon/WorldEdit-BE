from pathlib import Path
import subprocess, sys, os, shutil
import argparse, re

parser = argparse.ArgumentParser(description='Build and package the addon.')
parser.add_argument('--watch', '-w', choices=['release', 'preview', 'server'], help='Whether to continually build and where to sync the project while editing it.')
parser.add_argument('--target', choices=['release', 'debug', 'release_server'], default='debug', help='Whether to build the addon in debug or release mode.')
parser.add_argument('--version', choices=['1.18', 'latest'], default='latest', help='The version of Minecraft to build for.')
parser.add_argument('--clean', '-c', action='store_true', help='Clean "BP/scripts" folder before building.')
parser.add_argument('--package-only', '-p', action='store_true', help='Only package what\'s already there.')
args = parser.parse_args()

build_pack_name = 'WorldEdit'

def regExpSub(regEx, replace, file):
    with open(file, 'r') as f:
        content = f.read()
        contentNew = re.sub(regEx, replace, content, flags = re.M)
    with open(file, 'w') as f:
        f.write(contentNew)

if not args.package_only:
    # Check for input and output folder
    if not os.path.isdir('src'):
        sys.exit('The src folder does not exist in the current working directory!')
    elif not os.path.isdir('BP/scripts'):
        sys.exit('The output scripts folder does not exist in the current working directory!')

    # Clean script output folder
    if args.clean:
        print('cleaning script output folder...')
        folder = 'BP/scripts'
        for filename in os.listdir(folder):
            file_path = os.path.join(folder, filename)
            try:
                if file_path.endswith('.txt'):
                    continue
                if os.path.isfile(file_path) or os.path.islink(file_path):
                    os.unlink(file_path)
                elif os.path.isdir(file_path):
                    shutil.rmtree(file_path)
            except Exception as e:
                print('Failed to delete %s. Reason: %s' % (file_path, e))
    
    if args.watch:
        print('syncing com.mojang folder...')
        subprocess.call([sys.executable, 'tools/sync2com-mojang.py'], stdout=subprocess.DEVNULL)
        subprocess.call([sys.executable, 'tools/process_manifest.py', f'--target={args.target}', f'--version={args.version}'], stdout=subprocess.DEVNULL)

        print('Watch mode: press control-C to stop.')
        tsc = subprocess.Popen('tsc -w', shell=True)
        # Remap absolute imports
        remap_imports = subprocess.Popen([sys.executable, 'tools/remap_imports.py', '-w'], stdout=subprocess.DEVNULL)
        # Convert po to lang files
        po2lang = subprocess.Popen([sys.executable, 'tools/po2lang.py', '-w'], stdout=subprocess.DEVNULL)
        # Sync to com.mojang
        sync_mojang = subprocess.Popen([sys.executable, 'tools/sync2com-mojang.py', '-w', '--init=False', f'--dest={args.watch}'], stdout=subprocess.DEVNULL)
        
        from time import sleep
        try:
            while True:
                sleep(1)
        except KeyboardInterrupt:
            tsc.kill()
            remap_imports.kill()
            po2lang.kill()
            sync_mojang.kill()
            exit()
    else:
        print('building scripts...')
        subprocess.call(['tsc', '-b'], shell=True)

    # Set debug mode
    regExpSub('DEBUG =(.+);', f'DEBUG = {"false" if args.target == "release" else "true"};', 'BP/scripts/config.js')

    # Remap absolute imports
    subprocess.call([sys.executable, 'tools/remap_imports.py'])
    # Convert po to lang files
    subprocess.call([sys.executable, 'tools/po2lang.py'])
    # Build manifests
    subprocess.call([sys.executable, 'tools/process_manifest.py', f'--target={args.target}', f'--version={args.version}'], stdout=subprocess.DEVNULL)

if not os.path.isdir('builds'):
    os.makedirs('builds')

if os.path.exists(f'builds/{build_pack_name}BP'):
    shutil.rmtree(f'builds/{build_pack_name}BP')
if os.path.exists(f'builds/{build_pack_name}RP'):
    shutil.rmtree(f'builds/{build_pack_name}RP')
try: shutil.copytree('BP', f'builds/{build_pack_name}BP')
except: pass
try: shutil.copytree('RP', f'builds/{build_pack_name}RP')
except: pass

if args.target != 'debug':
    from zipfile import ZipFile;
    
    def zipWriteDir(zip, dirname, arcname):
        for folderName, _, filenames in os.walk(dirname):
            for filename in filenames:
                filePath = os.path.join(folderName, filename)
                zip.write(filePath, arcname / Path(filePath).relative_to(dirname))
    
    if args.target == 'release':
        with ZipFile(f'builds/{build_pack_name}.{args.version}.mcaddon', 'w') as zip:
            zipWriteDir(zip, f'builds/{build_pack_name}BP', f'{build_pack_name}BP')
            zipWriteDir(zip, f'builds/{build_pack_name}RP', f'{build_pack_name}RP')
    elif args.target == 'release_server':
        with ZipFile(f'builds/{build_pack_name}.server.zip', 'w') as zip:
            zipWriteDir(zip, f'builds/{build_pack_name}BP', f'{build_pack_name}BP')
            zipWriteDir(zip, f'builds/{build_pack_name}RP', f'{build_pack_name}RP')
