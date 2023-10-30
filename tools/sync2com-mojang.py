from pathlib import Path
import glob, os, shutil
import argparse

SERVER_LOCATION = '%appdata%\\.minecraft_bedrock\\servers\\1.20.10.24'

parser = argparse.ArgumentParser(description='Syncs the project folder\'s data with Minecraft (Windows 10/11 only).\nNote: Will only sync CHANGED files in watch mode.')
parser.add_argument('--watch', '-w', action='store_true', help='Whether to watch for file changes.')
parser.add_argument('--init', choices=['False', 'True'], default='True', help='Whether to initially sync com.mojang before watching file changes.')
parser.add_argument('--dest', choices=['stable', 'preview', 'server'], default='stable', help='The place to sync the addon to')
args = parser.parse_args()

if args.dest == 'stable':
    # com_mojang = os.path.expandvars('%localappdata%\\Packages\\Microsoft.MinecraftUWP_8wekyb3d8bbwe\\LocalState\\games\\com.mojang')
    com_mojang = os.path.expandvars('$HOME/.local/share/mcpelauncher/games/com.mojang')
elif args.dest == 'preview':
    com_mojang = os.path.expandvars('%localappdata%\\Packages\\Microsoft.MinecraftWindowsBeta_8wekyb3d8bbwe\\LocalState\\games\\com.mojang')
elif args.dest == 'server':
    com_mojang = os.path.expandvars(SERVER_LOCATION)

pack_folder = 'WorldEdit'

behaviour_pack = os.path.join(com_mojang, 'development_behavior_packs', f'{pack_folder} BP')
resource_pack = os.path.join(com_mojang, 'development_resource_packs', f'{pack_folder} RP')

def sync_file(path, from_root, to_root):
    from_file = Path(path).relative_to(from_root)
    to_file = Path(to_root, from_file)
    try:
        if os.path.exists(path):
            to_folder = to_file.parent
            if not os.path.exists(to_folder):
                os.makedirs(to_folder)
            shutil.copy(path, to_folder)
            print(f'synced {path} to com.mojang')
        else:
            os.remove(to_file)
            print(f'deleted {path} from com.mojang')
    except OSError:
        pass

def remove_dir_if_exists(path):
    if os.path.exists(path):
        shutil.rmtree(path)

def sync_all():
    remove_dir_if_exists(behaviour_pack)
    remove_dir_if_exists(resource_pack)

    for file in glob.iglob('BP/**', recursive=True):
        if os.path.isfile(file):
            sync_file(file, './BP', behaviour_pack)
    for file in glob.iglob('RP/**', recursive=True):
        if os.path.isfile(file):
            sync_file(file, './RP', resource_pack)

if args.watch:
    import time
    from watchdog.observers import Observer
    from watchdog.events import FileSystemEventHandler
    
    def alert_watching():
        print('Watching for file changes...')
    
    class MyHandler(FileSystemEventHandler):
        def __init__(self, packtype):
            self.packtype = packtype
        
        def update(self, path):
            if self.packtype == 'BP':
                sync_file(path, './BP', behaviour_pack)
            else:
                sync_file(path, './RP', resource_pack)
        
        def on_modified(self, ev):
            if not ev.is_directory:
                self.update(ev.src_path)
        
        def on_created(self, ev):
            if not ev.is_directory:
                self.update(ev.src_path)
        
        def on_deleted(self, ev):
            if not ev.is_directory:
                self.update(ev.src_path)
    
    observerBP = Observer()
    observerBP.schedule(MyHandler('BP'),  path='BP',  recursive=True)
    observerBP.start()

    observerRP = Observer()
    observerRP.schedule(MyHandler('RP'),  path='RP',  recursive=True)
    observerRP.start()

    if args.init == 'True':
        sync_all()
    try:
        alert_watching()
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        observerBP.stop()
        observerRP.stop()
    print('\n')
    observerBP.join()
    observerRP.join()
else:
    sync_all()