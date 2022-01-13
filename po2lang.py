import json, glob, re, polib
import os
from os.path import relpath

import argparse

parser = argparse.ArgumentParser(description='Converts .po translatation files to .lang Minecraft translatation files.')
parser.add_argument('--watch', '-w', action='store_true', help='Whether to watch for file changes in the texts folder.')
args = parser.parse_args()

BPdir = './BP/texts'
RPdir = './RP/texts'
srcdir = './texts'

def convert_file(in_path, out_path):
    newlines = []
    for entry in polib.pofile(in_path):
        if not(entry.msgid != 'pack.description' and 'BP' in out_path):
            string = entry.msgstr.replace('\\"', '"')
            newlines.append(f'{entry.msgid}={string}\n')
    
    with open(out_path, 'w') as file:
        file.writelines(newlines)
        print(f'{in_path} converted to {out_path}')

def convert_lang(filename):
    lang = os.path.basename(filename).replace('.po', '')
    convert_file(filename, BPdir + '/' + lang + '.lang')
    convert_file(filename, RPdir + '/' + lang + '.lang')
    return lang
    
languages = []
for filename in glob.iglob(srcdir + '/*.po', recursive = True):
    languages.append(convert_lang(filename))

for folder in [RPdir, BPdir]:
    with open(folder + '/languages.json', 'w') as file:
        file.write('[\n');
        for i in range(len(languages)):
            comma = ','
            if i == len(languages) - 1:
                comma = ''
            file.write(f'    "{languages[i]}"{comma}\n')
        file.write(']')

if args.watch:
    import time
    from watchdog.observers import Observer
    from watchdog.events import FileSystemEventHandler
    
    def alert_watching():
        print('Watching for file changes...')
    
    class MyHandler(FileSystemEventHandler):
        def on_modified(self, event):
            if not event.is_directory and not '.pot' in event.src_path:
                convert_lang(event.src_path)
                alert_watching()
        
        def on_created(self, event):
            if not event.is_directory and not '.pot' in event.src_path:
                convert_lang(event.src_path)
                alert_watching()
        
        def on_deleted(self, event):
            pass
    
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
