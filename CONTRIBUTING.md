# Contributing to WorldEdit

If you're thinking of contributing to WorldEdit, you've come to the right page! There are many ways you can help with the development of this addon.

## Reporting bugs

If you've encountered a bug with the addon, please go [here](https://github.com/SIsilicon/WorldEdit-BE/issues/new?template=bug_report.md) to submit one. When reporting a bug, you must:
- Make sure the bug has not been reported before
- Be descriptive about the bug and what caused to appear
- If applicable, provide content logs for more detail about the addon usage.

To get content logs, you must first enable it from `Settings > Creator`.

## Giving feedback

The aim of this project is to replicate as many of the original WorldEdit features as possible, so if there's a feature you want that's in the original mod, it will likely be implemented anyway if possible.
However, you can still propose features that _aren't_ in the original mod, so long as you can make a case for how useful it can be. Then the proposal will be considered.

You submit proposals [here](https://github.com/SIsilicon/WorldEdit-BE/issues/new?template=feature_request.md). Make sure that a similar proposal has not been made already.

## Contributing code

This addon is not like most other addons. It takes more resources to get it functioning. So if you want to contribute code, the following is required.

- Windows 10 and up
- Git (and the knowledge of using it)
- Python 3 and up
- Node package manager

It's recommended to have a code editor, such as Vscode, to easily modify the code.

### Preparations

First, you need to use Git and pull this project from GitHub. To do so, run the command `[TODO]` from the command line, the current working directory is where this project will appear. After you got all the files pulled, the next step is to install node dependencies with the command `npm install`.

### Building

Once that's all set up, you can now start building! The file responsible for this is `build.py`. It comes with many parameters when building the addon.

- `--watch, -w`: Defining this parameter puts the project in watch mode.
- `--target`: Defines the kind of build to make. The addon has three modes. `release`, `debug`, and `release_server`. Does not work when in watch mode.
- `--clean, -c`: Whether to clear the scripts folder before building. This folder contains the build result of the source typescript files.
- `--package-only, -p`: Only package what's already built.

So whenever you want to build the addon, all you have to do is run this script (`python build.py "parameters"`). Once built, the result will be inside the `builds` folder.

### Watch mode

When in watch mode, the addon builds its scripts and language files every time they're changed. They also sync the addon files with the game's pack folders. Use this when testing and modifying the addon files while the game is running. All you need to do is apply the addon (which will have `[DEBUG]` at the end by default) to a world to test it in. You can specify where the addon is synced too.

- `release`: Sync with the regular version of Minecraft
- `preview`: Sync with the preview version of Minecraft
- `server`: Sync with a Bedrock Dedicated Server

For that last one, you'll need to specify the location of the server at `tools/sync2com-mojang.py`.

One more thing. While changing scripts, you can run the command `/reload` ingame to reload them, without having to exit and enter the world.

## Translations

Speak another language? Help the addon become more localized by going to the addon's [Crowdin page](https://crowdin.com/project/worldedit-for-bedrock). Choose a language you're good with, and start contributing in places that don't have a translation.