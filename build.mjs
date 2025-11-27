/* global console */
import fs from "fs";
import path from "path";
import esbuild from "esbuild";
import { Command } from "commander";
import { ZipFile } from "yazl";
import { glob } from "glob";
import { argv, env, exit } from "process";
import { copyDir, ensureDir, removeDirIfExists } from "./tools/utils.mjs";
import { infoPlugin, transformerPlugin } from "./tools/plugins.mjs";
import tsconfig from "./tsconfig.json" assert { type: "json" };
import buildManifest from "./tools/process_manifest.mjs";
import buildLang from "./tools/po2lang.mjs";
import buildConfig from "./tools/process_config.mjs";

const program = new Command();
program
    .option("-w, --watch <type>", "Whether to continually build and where to sync the project while editing it.")
    .action((type) => {
        if (["stable", "preview", "server"].includes(type)) {
            console.error("Invalid fs.watch type specified. Valid options are: []");
            exit(1);
        }
    })
    .option("--server <path>", "The path to the server to build for.")
    .option("--target <type>", "Whether to build the addon in debug or release mode.")
    .action((type) => {
        if (["debug", "release", "server"].includes(type)) {
            console.error("Invalid fs.watch type specified. Valid options are: []");
            exit(1);
        }
    })
    .option("-p, --package-only", "Only package what's already there.")
    .option("-g --gametest", "Whether to build with gametest enabled.")
    .option("-e, --editor", "Whether to build for editor mode.");
program.parse(argv);

const args = program.opts();
const srcDir = path.resolve("src");
const scriptOutputDir = path.resolve("BP/scripts");
const buildsDir = path.resolve("builds");
const packName = "WorldEdit";
const modulePaths = tsconfig.compilerOptions.paths || {};

function syncChange(eventType, srcRoot, destRoot, filename) {
    if (!filename) return;
    const srcPath = path.join(srcRoot, filename);
    const destPath = path.join(destRoot, filename);

    if (fs.existsSync(srcPath)) {
        const stat = fs.statSync(srcPath);
        if (stat.isDirectory()) {
            copyDir(srcPath, destPath);
        } else {
            ensureDir(path.join(destPath, ".."));
            fs.copyFileSync(srcPath, destPath);
        }
    } else {
        if (fs.existsSync(destPath)) {
            const stat = fs.statSync(destPath);
            if (stat.isDirectory()) {
                removeFilesRecursively(destPath);
                fs.rmdirSync(destPath);
            } else {
                fs.unlinkSync(destPath);
            }
        }
    }
}

function watchAndSync(srcRoot, destRoot) {
    copyDir(srcRoot, destRoot);
    fs.watch(srcRoot, { recursive: true }, (eventType, filename) => {
        if (filename) syncChange(eventType, srcRoot, destRoot, filename);
    });
}

function zipWriteDir(zip, dirname, arcname) {
    function addDir(dir, base) {
        for (const entry of fs.readdirSync(dir)) {
            const fullPath = path.join(dir, entry);
            const relPath = path.join(base, entry);
            if (fs.statSync(fullPath).isDirectory()) {
                addDir(fullPath, relPath);
            } else {
                zip.addFile(fullPath, path.join(arcname, path.relative(dirname, fullPath)));
            }
        }
    }
    addDir(dirname, "");
}

if (!fs.existsSync(srcDir)) throw "The src folder does not exist in the current working directory!";
if (!fs.existsSync(scriptOutputDir)) throw "The output scripts folder does not exist in the current working directory!";

// Calculate sync location when in fs.watch mode.
if (args.watch === "stable") {
    args.syncDir = env.LOCALAPPDATA + "\\Packages\\Microsoft.MinecraftUWP_8wekyb3d8bbwe\\LocalState\\games\\com.mojang";
} else if (args.watch === "preview") {
    args.syncDir = env.APPDATA + "\\Minecraft Bedrock Preview\\Users\\Shared\\games\\com.mojang";
} else if (args.watch === "server") {
    if (!args.server) {
        console.error("You must specify a server path when using the --server option.");
        exit(1);
    }
    args.syncDir = args.server;
}
// Enable gametest when in watch mode.
if (args.watch) args.gametest = true;

// Clear the script output folder.
const removeFilesRecursively = (dir) => {
    for (const file of fs.readdirSync(dir)) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
            removeFilesRecursively(filePath);
            fs.rmdirSync(filePath);
        } else if (!file.endsWith(".txt")) {
            fs.unlinkSync(filePath);
        }
    }
};
removeFilesRecursively(scriptOutputDir);

// Build manifest files
buildManifest(args);

// Build config files
buildConfig(args);

// Build lang files
buildLang(args);

const buildArgs = {
    outdir: scriptOutputDir,
    entryPoints: await glob("src/**/*.{ts,js}", { ignore: ["src/**/*.d.ts", args.gametest ? "" : "src/gametest/**", args.editor ? "" : "src/editor/**"] }),
    bundle: false,
    platform: "node",
    target: ["es2020"],
    tsconfig: "tsconfig.json",
    format: "esm",
    plugins: [
        infoPlugin(),
        transformerPlugin(/\.(js|ts)$/, [
            function remapImports(filePath, contents) {
                for (const [alias, paths] of Object.entries(modulePaths)) {
                    // Remove trailing /* from alias and path if present
                    const aliasPattern = alias.replace(/\/\*$/, "");
                    const target = paths[0].replace(/\/\*$/, "");
                    // Replace both import and require statements
                    const importRegex = new RegExp(`(['"\`])${aliasPattern}(\\/[^'"\`]*)?\\1`, "g");
                    contents = contents.replace(importRegex, (match, quote, subPath = "") => {
                        return `${quote}${target}${subPath}${quote}`;
                    });
                }
                return contents;
            },
            function gametest(filePath, contents) {
                if (!path.normalize(filePath).endsWith(path.normalize("src/index.ts")) || !args.gametest) return;
                contents += `\nimport "gametest/index.js";`;
                return contents;
            },
            function editor(filePath, contents) {
                if (!path.normalize(filePath).endsWith(path.normalize("src/index.ts")) || !args.editor) return;
                contents += `\nimport "editor/index.js";`;
                return contents;
            },
        ]),
    ],
};

if (args.watch) {
    // Sync the BP and RP directories with the development pack folders
    watchAndSync("BP", path.join(args.syncDir, `development_behavior_packs/${packName}BP`));
    watchAndSync("RP", path.join(args.syncDir, `development_resource_packs/${packName}RP`));

    // Build the scripts and fs.watch for changes
    const ctx = await esbuild.context({ ...buildArgs, sourcemap: true, minify: false });
    await ctx.watch();
} else {
    // Build the scripts and bundle them into the script output folder.
    const ctx = await esbuild.context({ ...buildArgs, sourcemap: false, minify: true });
    await ctx.rebuild();
    await ctx.dispose();

    ensureDir(buildsDir);
    removeDirIfExists(path.join(buildsDir, `${packName}BP`));
    removeDirIfExists(path.join(buildsDir, `${packName}RP`));

    copyDir("BP", path.join(buildsDir, `${packName}BP`));
    copyDir("RP", path.join(buildsDir, `${packName}RP`));

    let exportName = args.target === "debug" ? `${packName}.beta` : packName;
    exportName = args.editor ? `${exportName}.editor` : exportName;
    exportName = args.target === "server" ? `${exportName}.server.zip` : `${exportName}.mcaddon`;
    const zipPath = path.join(buildsDir, exportName);
    const zip = new ZipFile();
    if (args.target === "server") {
        const variablesPath = path.join(buildsDir, "variables.json");
        if (fs.existsSync(variablesPath)) zip.addFile(variablesPath, "variables.json");
    }
    zipWriteDir(zip, path.join(buildsDir, `${packName}BP`), `${packName}BP`);
    zipWriteDir(zip, path.join(buildsDir, `${packName}RP`), `${packName}RP`);
    zip.outputStream.pipe(fs.createWriteStream(zipPath)).on("close", () => {});
    zip.end();
}
