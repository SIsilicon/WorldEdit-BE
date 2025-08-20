import fs from "fs";
import { exitMessage } from "./utils.mjs";

function valueToString(value) {
    if (typeof value === "string") return `"${value}"`;
    return value;
}

function generateScript(settings, version, isServer) {
    let result = isServer ? 'import { variables } from "@minecraft/server-admin";\n\n' : "";

    result += "export default {\n";
    for (const [name, data] of Object.entries(settings)) {
        if (isServer) {
            result += `    ${name}: variables.get("${name}") || ${valueToString(data.default)},\n`;
        } else {
            result += "    /**\n";
            for (const line of data.description.split(/\r?\n/)) result += `     * ${line}\n`;
            result += "     */\n";
            result += `    ${name}: ${valueToString(data.default)},\n`;
        }
    }
    result += "};\n\n";

    result += ["// WorldEdit version (do not change)", `export const VERSION = "${version}";`].join("\n").replace(/\n/g, "\r\n");
    return result;
}

function generateVariables(settings) {
    const result = [];
    for (const [name, data] of Object.entries(settings)) {
        let variable = "\n    /**\n";
        for (const line of data.description.split(/\r?\n/)) variable += `     * ${line}\n`;
        variable += "     */\n";
        variable += `    "${name}": ${valueToString(data.default)}`;
        result.push(variable);
    }
    return ("{" + result.join(",") + "\n}").replace(/\n/g, "\r\n");
}

function processConfig(args) {
    // load settings file
    if (!fs.existsSync("worldedit_settings.json")) exitMessage("Settings file 'worldedit_settings.json' not found");
    const loaded = JSON.parse(fs.readFileSync("worldedit_settings.json"));
    const settings = {
        debug: {
            description: "Enables debug messages to content logs.",
            default: args.target === "debug",
        },
        ...loaded,
    };

    // load addon version
    if (!fs.existsSync("mc_manifest.json")) exitMessage("Manifest file 'mc_manifest.json' not found");
    const manifest = JSON.parse(fs.readFileSync("mc_manifest.json"));
    const version = manifest.header.version;
    let versionStr;
    if (typeof version === "string") {
        versionStr = version;
    } else {
        versionStr = version.join(".");
        if (version.length > 3) versionStr += " [BETA]";
    }

    const isServer = args.watch === "server" || args.target === "server";

    // Generate BP/scripts/config.js
    fs.writeFileSync("BP/scripts/config.js", generateScript(settings, versionStr, isServer), "utf8");
    // Generate builds/variables.json
    if (isServer) {
        fs.mkdirSync("builds");
        fs.writeFileSync("builds/variables.json", generateVariables(settings), "utf8");
    }
}

export default function (args) {
    processConfig(args);
    if (args.watch)
        fs.watch(".", { persistent: true }, (eventType, filename) => {
            if (filename === "worldedit_settings.json" || filename === "mc_manifest.json") processConfig(args);
        });
}
