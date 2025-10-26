import fs from "fs";

function processJsonElement(element, bpElement, rpElement, options = {}) {
    function process(key, value) {
        if (Array.isArray(value)) {
            bpElement[key] = [];
            rpElement[key] = [];
            processJsonElement(value, bpElement[key], rpElement[key], options);
        } else if (typeof value === "object" && value !== null) {
            bpElement[key] = {};
            rpElement[key] = {};
            processJsonElement(value, bpElement[key], rpElement[key], options);
        } else {
            if (Array.isArray(bpElement)) {
                bpElement.push(value);
                rpElement.push(value);
            } else {
                bpElement[key] = value;
                rpElement[key] = value;
            }
        }
    }

    if (Array.isArray(element)) {
        for (let i = 0; i < element.length; i++) {
            process(i, element[i]);
        }
    } else if (typeof element === "object" && element !== null) {
        for (const [key, value] of Object.entries(element)) {
            if (key.startsWith("bp_")) {
                if (key.startsWith("bp_server_")) {
                    if (!options.isServer) continue;
                    const sub = bpElement[key.slice("bp_server_".length)];
                    if (Array.isArray(sub)) {
                        bpElement[key.slice(10)] = sub.concat(value);
                    } else if (typeof sub === "object" && sub !== null) {
                        bpElement[key.slice(10)] = { ...sub, ...value };
                    }
                } else if (key.startsWith("bp_editor_")) {
                    if (!options.isEditor) continue;
                    const sub = bpElement[key.slice("bp_editor_".length)];
                    if (Array.isArray(sub)) {
                        bpElement[key.slice(10)] = sub.concat(value);
                    } else if (typeof sub === "object" && sub !== null) {
                        bpElement[key.slice(10)] = { ...sub, ...value };
                    }
                } else {
                    bpElement[key.slice(3)] = value;
                }
            } else if (key.startsWith("rp_")) {
                rpElement[key.slice(3)] = value;
            } else {
                process(key, value);
            }
        }
    }
}

function processManifest(debugMode, isServer, isEditor) {
    const bp_manifest = {};
    const rp_manifest = {};

    // load base manifest
    const manifest = JSON.parse(fs.readFileSync("mc_manifest.json", "utf8"));
    processJsonElement(manifest, bp_manifest, rp_manifest, { isServer, isEditor });

    let version = manifest.header.version;
    bp_manifest.header.name += " " + (version.join ? version.join(".") : version);
    rp_manifest.header.name += " " + (version.join ? version.join(".") : version);

    if (typeof version !== "string") version = version.slice(0, 3);
    bp_manifest.header.version = version;
    rp_manifest.header.version = version;

    if (!bp_manifest.dependencies) bp_manifest.dependencies = [];
    bp_manifest.dependencies.push({
        uuid: rp_manifest.header.uuid,
        version: rp_manifest.header.version,
    });

    if (!rp_manifest.dependencies) rp_manifest.dependencies = [];
    rp_manifest.dependencies.push({
        uuid: bp_manifest.header.uuid,
        version: bp_manifest.header.version,
    });

    if (debugMode) {
        bp_manifest.header.name += " [DEBUG]";
        rp_manifest.header.name += " [DEBUG]";
    }

    // export behaviour and resource manifests
    fs.mkdirSync("BP", { recursive: true });
    fs.mkdirSync("RP", { recursive: true });
    fs.writeFileSync("BP/manifest.json", JSON.stringify(bp_manifest, undefined, 4));
    fs.writeFileSync("RP/manifest.json", JSON.stringify(rp_manifest, undefined, 4));
}

export default function (args) {
    const debugMode = args.target === "debug";
    const isServer = args.target === "server" || args.target === "server";
    const isEditor = args.editor === true;
    processManifest(debugMode, isServer, isEditor);

    if (args.watch) {
        fs.watch("mc_manifest.json", { persistent: true, recursive: false }, (eventType, filename) => {
            if (filename === "mc_manifest.json") processManifest(debugMode, isServer, isEditor);
        });
    }
}
