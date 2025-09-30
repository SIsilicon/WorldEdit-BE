import fs from "fs";
import path from "path";
import polib from "pofile";
import { globSync } from "glob";

const BPdir = "BP/texts";
const RPdir = "RP/texts";
const srcDir = "texts";

function getLang(file) {
    return path.basename(file).replace(".po", "");
}

function convertFile(inPath, outPath) {
    const po = polib.parse(fs.readFileSync(inPath, "utf-8"));

    let newlines = [];
    for (const entry of po.items) {
        if (entry.msgid !== "" && !(entry.msgid !== "pack.description" && outPath.includes("BP"))) {
            const string = entry.msgstr[0].replace(/\\"/, '"').replace(/\n/, "~LINEBREAK~");
            newlines.push(`${entry.msgid}=${string}\n`);
            if (outPath.includes("BP")) break;
        }
    }
    if (newlines.length > 0) {
        newlines[newlines.length - 1] = newlines[newlines.length - 1].replace(/\n$/, "");
    }
    fs.writeFileSync(outPath, newlines.join(""), { encoding: "utf-8" });
    // console.log(`${inPath} converted to ${outPath}`);
}

function convertLang(filename) {
    const lang = getLang(filename);
    convertFile(filename, `${BPdir}/${lang}.lang`);
    convertFile(filename, `${RPdir}/${lang}.lang`);
}

function updateLangJson() {
    globSync(srcDir + "/*.po", (err, files) => {
        if (err) throw err;
        const languages = files.map(getLang);
        for (const folder of [RPdir, BPdir]) {
            const arr = languages.map((l) => `    "${l}"`);
            const json = "[\n" + arr.join(",\n") + "\n]";
            fs.writeFileSync(path.join(folder, "languages.json"), json, "utf-8");
        }
    });
}

export default function (args) {
    // Remove old .lang files
    for (const file of [...globSync(`${BPdir}/*.lang`), ...globSync(`${RPdir}/*.lang`)]) {
        if (!file.includes("AUTO_GENERATED")) fs.unlinkSync(file);
    }
    // Convert all .po files
    for (const file of globSync(`${srcDir}/*.po`)) convertLang(file);
    updateLangJson();

    if (args.watch) {
        // Watch for changes in the source directory
        fs.watch(srcDir, { recursive: true }, (eventType, filename) => {
            if (!filename.endsWith(".po")) return;
            convertLang(path.join(srcDir, filename));
            updateLangJson();
        });
    }
}
