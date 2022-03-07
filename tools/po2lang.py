import json, glob, re, polib
import os
from os.path import relpath
from itertools import chain

import argparse

parser = argparse.ArgumentParser(description='Converts .po translatation files to .lang Minecraft translatation files.')
parser.add_argument('--watch', '-w', action='store_true', help='Whether to watch for file changes in the texts folder.')
args = parser.parse_args()

BPdir = './BP/texts'
RPdir = './RP/texts'
srcdir = './texts'

def get_lang(file):
    return os.path.basename(file).replace('.po', '')

def convert_file(in_path, out_path):
    newlines = []
    for entry in polib.pofile(in_path):
        if entry.msgid != "" and not(entry.msgid != 'pack.description' and 'BP' in out_path):
            string = entry.msgstr.replace('\\"', '"')
            if '\n' in string:
                print('new line!')
            newlines.append(f'{entry.msgid}={string}\n')
            
            if 'BP' in out_path:
                break
    newlines[-1] = newlines[-1][:-1]
    
    with open(out_path, 'w') as file:
        file.writelines(newlines)
        print(f'{in_path} converted to {out_path}')

def update_keys(filename):
    if filename.endswith('en_US.po'):
        return
    
    base_entries = {}
    lang_entries = {}
    
    for entry in polib.pofile(f'{srcdir}/en_US.po'):
        base_entries[entry.msgid] = entry.msgstr.replace('"', '\\"')
    for entry in polib.pofile(filename):
        lang_entries[entry.msgid] = entry.msgstr.replace('"', '\\"')
    
    meta = []
    with open(filename) as file:
        reading_meta = False
        line = file.readline()
        while line:
            if reading_meta:
                if line == '\n' or line.startswith('#') or line.startswith('msgid'):
                    break
                meta.append(line)
            if re.match(r'msgid\s+""', line):
                reading_meta = True
            line = file.readline()
    
    if get_lang(filename) == 'bg_BG':
        print(meta)
    
    with open(filename, 'w') as file:
        file.write('msgid ""\n')
        for line in meta:
            file.write(line)
        file.write('\n')
        
        for entry in base_entries:
            file.write(f'msgid "{entry}"\n')
            file.write(f"msgstr \"{lang_entries.get(entry, base_entries.get(entry, ''))}\"\n")
            file.write('\n')

def convert_lang(filename):
    lang = get_lang(filename)
    convert_file(filename, f'{BPdir}/{lang}.lang')
    convert_file(filename, f'{RPdir}/{lang}.lang')

def update_lang_json():
    languages = []
    for file in glob.iglob(srcdir + '/*.po', recursive = True):
        languages.append(get_lang(file))
    
    for folder in [RPdir, BPdir]:
        with open(folder + '/languages.json', 'w') as file:
            file.write('[\n');
            for i in range(len(languages)):
                comma = ','
                if i == len(languages) - 1:
                    comma = ''
                file.write(f'    "{languages[i]}"{comma}\n')
            file.write(']')

for file in chain(glob.iglob(BPdir + '/*.lang'), glob.iglob(RPdir + '/*.lang')):
    if not 'AUTO_GENERATED' in file:
        os.remove(file)

for file in glob.iglob(srcdir + '/*.po'):
    convert_lang(file)
update_lang_json()

if args.watch:
    import time
    from watchdog.observers import Observer
    from watchdog.events import FileSystemEventHandler
    
    def alert_watching():
        print('Watching for file changes...')
    
    updating_keys = False
    
    class MyHandler(FileSystemEventHandler):
        def __init__(self):
            self.updating_keys = False
        
        def on_modified(self, event):
            if self.updating_keys:
                return
            
            # if event.src_path.endswith('en_US.po'):
            #     self.updating_keys = True
            #     for filename in glob.iglob(srcdir + '/*.po', recursive = True):
            #         update_keys(filename)
            #         convert_lang(filename)
            #     self.updating_keys = False
            #     alert_watching()
            if event.src_path.endswith('.po'):
                convert_lang(event.src_path)
                alert_watching()
        
        def on_created(self, event):
            if event.src_path.endswith('.po'):
                convert_lang(event.src_path)
                update_lang_json()
                alert_watching()
        
        def on_deleted(self, event):
            lang = get_lang(event.src_path)
            if os.path.exists(BPdir + '/' + lang + '.lang'):
                os.remove(BPdir + '/' + lang + '.lang')
            if os.path.exists(RPdir + '/' + lang + '.lang'):
                os.remove(RPdir + '/' + lang + '.lang')
            print(f'Deleted {lang}.lang')
            update_lang_json()
            alert_watching()
    
    observer = Observer()
    observer.schedule(MyHandler(),  path=srcdir,  recursive=True)
    observer.start()
    
    try:
        alert_watching()
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        observer.stop()
    print('\n')
    observer.join()
