import argparse
import glob
import json
import re
from os.path import relpath

parser = argparse.ArgumentParser(
    description="Remaps imports with absolute paths in the typescript build output."
)
parser.add_argument(
    "--watch",
    "-w",
    action="store_true",
    help="Whether to watch for file changes in the build output.",
)
args = parser.parse_args()

with open("tsconfig.json") as file:
    tsconfig = json.load(file)
    outdir = tsconfig["compilerOptions"]["outDir"]
    baseurl = tsconfig["compilerOptions"]["baseUrl"]
    paths = tsconfig["compilerOptions"]["paths"]

regex = re.compile(r"import\s+.+\s+from\s['|\"](.+)['|\"]")


def modify_file(path):
    modified = False
    with open(path, "r") as file:
        newlines = []
        try:
            for line in file.readlines():
                match = re.match(regex, line)
                if match:
                    package = match.group(1)
                    for key, value in paths.items():
                        module = re.match(key.replace("*", "(.+)"), package)
                        if module:
                            newpackage = outdir + "/" + value[0]
                            for g in module.groups():
                                newpackage = newpackage.replace("*", g, 1)
                            newpackage = (
                                relpath(newpackage, path)
                                .replace("\\", "/")
                                .replace("../", "./", 1)
                            )
                            line = line.replace(package, newpackage)
                            modified = True
                            break
                newlines.append(line)
        except:
            pass

    if modified:
        print("remapped imports in: " + path)
        with open(path, "w") as file:
            file.writelines(newlines)

    return modified


for filename in glob.iglob(outdir + "/**/*.js", recursive=True):
    modify_file(filename)

if args.watch:
    import time

    from watchdog.events import FileSystemEventHandler
    from watchdog.observers import Observer

    def alert_watching():
        print("Watching for file changes...")

    class MyHandler(FileSystemEventHandler):
        def on_modified(self, event):
            if not event.is_directory:
                modify_file(event.src_path)

        def on_created(self, event):
            if not event.is_directory:
                modify_file(event.src_path)

        def on_deleted(self, event):
            pass

    observer = Observer()
    observer.schedule(MyHandler(), path=outdir, recursive=True)
    observer.start()

    try:
        alert_watching()
        while True:
            time.sleep(2)
    except KeyboardInterrupt:
        observer.stop()
    print("\n")
    observer.join()
pass
"""
regex = re.compile(r"builder.nameTag");
for filename in glob.iglob('./src/server/**/*.ts', recursive = True):
    modified = False
    with open(filename, 'r') as file:
        newlines = []
        for line in file.readlines():
            #modified = True
            match = re.match(regex, line)
            if match or True:
                line = line.replace('player.nameTag', 'player.name')
                modified = True
                package = match.group(1)
                for key, value in {'*/library/*': '@library/*'}.items():
                    module = re.match(key.replace('*', '(.+)'), package)
                    if module:
                        newpackage = value.replace('*', module.group(2), 1)
                        line = line.replace(package, newpackage)
                        modified = True
                        break
            newlines.append(line)
    
    if modified:
        print('modified ' + filename)
        with open(filename, 'w') as file:
            file.writelines(newlines)
"""
