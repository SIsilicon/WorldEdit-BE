import subprocess, sys, os, shutil
import argparse, re

parser = argparse.ArgumentParser(description='Build and package the addon.')
parser.add_argument('--watch', '-w', action='store_true', help='Whether to continually build the project while editing it.')
parser.add_argument('--target', choices=['release', 'debug'], default='debug', help='Whether to build the addon in debug or release mode.')
parser.add_argument('--clean', '-c', action='store_true', help='Clean "BP/scripts" folder before building.')
parser.add_argument('--package-only', '-p', action='store_true', help='Only package what\'s already there.')
args = parser.parse_args()

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
    
    print('building scripts...')
    if args.watch:
        print('Watch mode: press control-C to stop.')
        tsc = subprocess.Popen('tsc -w', shell=True)
        # Remap absolute imports
        remap_imports = subprocess.Popen([sys.executable, 'tools/remap_imports.py', '-w'], stdout=subprocess.DEVNULL)
        # Convert po to lang files
        po2lang = subprocess.Popen([sys.executable, 'tools/po2lang.py', '-w'], stdout=subprocess.DEVNULL)
        # Sync to com.mojang
        sync_mojang = subprocess.Popen([sys.executable, 'tools/sync2com-mojang.py', '-w'], stdout=subprocess.DEVNULL)
        
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
        subprocess.call(['tsc', '-b'])

def regExpSub(regEx, replace, file):
    with open(file, 'r') as f:
        content = f.read()
        contentNew = re.sub(regEx, replace, content, flags = re.M)
    with open(file, 'w') as f:
        f.write(contentNew)

# Set debug mode
regExpSub('DEBUG =(.+);', f'DEBUG = {"false" if args.target == "release" else "true"};', 'BP/scripts/config.js')

# Remap absolute imports
subprocess.call([sys.executable, 'tools/remap_imports.py'])
# Convert po to lang files
subprocess.call([sys.executable, 'tools/po2lang.py'])

if not os.path.isdir('builds'):
    os.makedirs('builds')

if args.target == 'release':
    # Package the addon
    subprocess.call(['zip', '-r', '../WorldEditBP.mcpack', './', '-x', '.stfolder/'], cwd='BP')
    subprocess.call(['zip', '-r', '../WorldEditRP.mcpack', './', '-x', '.stfolder/'], cwd='RP')
    subprocess.call(['zip', '-m', 'WorldEdit.mcaddon', 'WorldEditRP.mcpack', 'WorldEditBP.mcpack'])
    os.replace('WorldEdit.mcaddon', 'builds/WorldEdit.mcaddon')
else:
    if os.path.exists('builds/WeditBP'):
        shutil.rmtree('builds/WeditBP')
    if os.path.exists('builds/WeditRP'):
        shutil.rmtree('builds/WeditRP')
    try: shutil.copytree('BP', 'builds/WeditBP')
    except: pass
    try: shutil.copytree('RP', 'builds/WeditRP')
    except: pass
    
    regExpSub('"name":(.+)",', r'"name":\1(Dev)",', 'builds/WeditBP/manifest.json')
    regExpSub('"name":(.+)",', r'"name":\1(Dev)",', 'builds/WeditRP/manifest.json')
    
