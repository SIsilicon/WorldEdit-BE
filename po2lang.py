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
            newlines.append(f'{entry.msgid}={string}\n')
    
    with open(out_path, 'w') as file:
        file.writelines(newlines)
        print(f'{in_path} converted to {out_path}')

def update_keys(filename):
    lang_entries = {}
    crowd_lang = ''
    lang_team = ''
    
    for entry in polib.pofile(filename):
        lang_entries[entry.msgid] = entry.msgstr.replace('"', '\\"')
    with open(filename) as file:
        line = file.readline()
        while line:
            if '"X-Crowdin-Language:' in line:
                crowd_lang = line
            elif '"Language-Team:' in line:
                lang_team = line
            if crowd_lang and lang_team:
                break
            line = file.readline()
    
    lines = []
    with open(f'{srcdir}/en_US.po') as file:
        lines = file.readlines()
    
    with open(filename, 'w') as file:
        msgid = ''
        for line in lines:
            if '"X-Crowdin-Language:' in line:
                file.write(crowd_lang)
            elif '"Language-Team:' in line:
                file.write(lang_team)
            elif '"Language:' in line:
                file.write(f'"Language: {get_lang(filename)}\n"')
            
            if msgid:
                file.write(f"msgstr \"{lang_entries.get(msgid, '')}\"\n")
                msgid = ''
            else:
                match = re.match(r'msgid(.+)"(.+)"', line)
                if match:
                    msgid = match.group(2)
                file.write(line)

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
    
    class MyHandler(FileSystemEventHandler):
        def on_modified(self, event):
            if event.src_path.endswith('en_US.po'):
                for filename in glob.iglob(srcdir + '/*.po', recursive = True):
                    update_keys(filename)
                    convert_lang(filename)
                alert_watching()
            elif event.src_path.endswith('.po'):
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
