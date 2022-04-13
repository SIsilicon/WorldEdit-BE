from pathlib import Path
import glob, os, shutil
import argparse

parser = argparse.ArgumentParser(description='Syncs the project folder\'s data with com.mojang (Windows 10/11 only).\nNote: Will only sync CHANGED files in watch mode.')
parser.add_argument('--watch', '-w', action='store_true', help='Whether to watch for file changes.')
parser.add_argument('--init', choices=['False', 'True'], default='True', help='Whether to initially sync com.mojang before watching file changes.')
args = parser.parse_args()

com_mojang = os.path.expandvars('%localappdata%\\Packages\\Microsoft.MinecraftUWP_8wekyb3d8bbwe\\LocalState\\games\\com.mojang')
dev_bev_pack = com_mojang + '\\development_behavior_packs\\WorldEdit BP'
dev_res_pack = com_mojang + '\\development_resource_packs\\WorldEdit RP'

sync_preview = False
if os.path.exists(os.path.expandvars('%localappdata%\\Packages\\Microsoft.MinecraftWindowsBeta_8wekyb3d8bbwe')):
    sync_preview = True
    PREV_com_mojang = os.path.expandvars('%localappdata%\\Packages\\Microsoft.MinecraftWindowsBeta_8wekyb3d8bbwe\\LocalState\\games\\com.mojang')
    PREV_dev_bev_pack = PREV_com_mojang + '\\development_behavior_packs\\WorldEdit BP'
    PREV_dev_res_pack = PREV_com_mojang + '\\development_resource_packs\\WorldEdit RP'

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
    remove_dir_if_exists(dev_bev_pack)
    remove_dir_if_exists(dev_res_pack)
    if sync_preview:
        remove_dir_if_exists(PREV_dev_bev_pack)
        remove_dir_if_exists(PREV_dev_res_pack)

    for file in glob.iglob('BP/**', recursive=True):
        if os.path.isfile(file):
            sync_file(file, './BP', dev_bev_pack)
            if sync_preview:
                sync_file(file, './BP', PREV_dev_bev_pack)
    for file in glob.iglob('RP/**', recursive=True):
        if os.path.isfile(file):
            sync_file(file, './RP', dev_res_pack)
            if sync_preview:
                sync_file(file, './RP', PREV_dev_res_pack)

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
                sync_file(path, './BP', dev_bev_pack)
                if sync_preview:
                    sync_file(path, './BP', PREV_dev_bev_pack)
            else:
                sync_file(path, './RP', dev_res_pack)
                if sync_preview:
                    sync_file(path, './RP', PREV_dev_res_pack)
        
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