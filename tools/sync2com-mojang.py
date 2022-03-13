from pathlib import Path
import glob, os, shutil
import argparse

parser = argparse.ArgumentParser(description='Syncs the project folder\'s data with com.mojang (Windows 10/11 only).')
parser.add_argument('--watch', '-w', action='store_true', help='Whether to watch for file changes.')
args = parser.parse_args()

com_mojang = os.path.expandvars('%localappdata%\\Packages\\Microsoft.MinecraftUWP_8wekyb3d8bbwe\\LocalState\\games\\com.mojang')
mojang_bp = com_mojang + '\\development_behavior_packs\\WorldEdit BP'
mojang_rp = com_mojang + '\\development_resource_packs\\WorldEdit RP'

def sync_file(path, from_root, to_root):
    from_file = Path(path).relative_to(from_root)
    to_file = Path(to_root, from_file)
    if os.path.exists(path):
        to_folder = to_file.parent
        if not os.path.exists(to_folder):
            os.makedirs(to_folder)
        shutil.copy(path, to_folder)
        print(f'synced {path} to com.mojang')
    else:
        os.remove(to_file)
        print(f'deleted {path} from com.mojang')

def sync_all():
    for file in glob.iglob('BP/**', recursive=True):
        if os.path.isfile(file):
            sync_file(file, './BP', mojang_bp)
    for file in glob.iglob('RP/**', recursive=True):
        if os.path.isfile(file):
            sync_file(file, './RP', mojang_rp)

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
                sync_file(path, './BP', mojang_bp)
            else:
                sync_file(path, './RP', mojang_rp)

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