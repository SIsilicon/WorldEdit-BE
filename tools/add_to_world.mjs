import fs from "fs";
import path from "path";
import { Command } from "commander";
import { argv } from "process";
import { copyDir } from "./utils.mjs";

const program = new Command();
program.option("--world-path <path>", "Path to the world directory.");
program.parse(argv);

const args = program.opts();
const worldPath = args.worldPath;

function addPack(type, packFilePath) {
    const packsJSON = fs.existsSync(`${worldPath}/world_${type}_packs.json`) ? JSON.parse(fs.readFileSync(`${worldPath}/world_${type}_packs.json`, "utf8")) : [];
    const manifest = JSON.parse(fs.readFileSync(`${packFilePath}/manifest.json`, "utf8"));

    packsJSON.push({
        pack_id: manifest.header.uuid,
        version: manifest.header.version,
    });

    fs.writeFileSync(`${worldPath}/world_${type}_packs.json`, JSON.stringify(packsJSON, null, 4), "utf8");
    copyDir(packFilePath, `${worldPath}/${type}_packs/${path.basename(packFilePath)}`);
}

addPack("behavior", "builds/WorldEditBP");
addPack("resource", "builds/WorldEditRP");
