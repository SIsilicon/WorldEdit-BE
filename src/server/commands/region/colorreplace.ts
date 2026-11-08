import { BlockTypes } from "@minecraft/server";
import { assertSelection } from "@modules/assert.js";
import { Jobs } from "@modules/jobs.js";
import { TypePatternNode } from "@modules/pattern.js";
import { CommandInfo, RawText } from "@notbeer-api";

import { registerCommand } from "../register_commands.js";

// TODO: add support for beds and banners

const dyeColors = ["white", "orange", "magenta", "light_blue", "yellow", "lime", "pink", "gray", "light_gray", "cyan", "purple", "blue", "brown", "green", "red", "black"] as const;

type DyeColor = (typeof dyeColors)[number];

function parseColor(value: string): DyeColor {
    let color = value.toLowerCase();

    // Small convenience :3
    if (color === "grey") {
        color = "gray";
    } else if (color === "light_grey") {
        color = "light_gray";
    }

    if (!dyeColors.includes(color as DyeColor)) {
        throw RawText.translate("commands.wedit:colorreplace.invalidColor").with(value);
    }

    return color as DyeColor;
}

function normalizeStateColor(value: string | number | boolean | undefined): DyeColor | undefined {
    if (typeof value !== "string") {
        return;
    }

    // Older Bedrock color states use "silver"
    // where modern IDs use "light_gray".
    const color = value === "silver" ? "light_gray" : value;

    if (dyeColors.includes(color as DyeColor)) {
        return color as DyeColor;
    }
}

function getStateColor(color: DyeColor) {
    return color === "light_gray" ? "silver" : color;
}

function getReplacementType(typeId: string, from: DyeColor, to: DyeColor) {
    const separator = typeId.indexOf(":");

    const namespace = separator === -1 ? "minecraft" : typeId.slice(0, separator);

    const id = separator === -1 ? typeId : typeId.slice(separator + 1);

    const prefix = `${from}_`;

    if (!id.startsWith(prefix)) {
        return;
    }

    const targetId = `${namespace}:${to}_` + id.slice(prefix.length);

    if (!BlockTypes.get(targetId)) {
        return;
    }

    return targetId;
}

const registerInformation: CommandInfo = {
    name: "colorreplace",
    aliases: ["creplace", "cr"],
    permission: "worldedit.region.colorreplace",
    description: "commands.wedit:colorreplace.description",
    usage: [
        {
            name: "from",
            type: "string",
        },
        {
            name: "to",
            type: "string",
        },
    ],
};

registerCommand(registerInformation, function* (session, builder, args) {
    assertSelection(session);

    const from = parseColor(args.get("from"));

    const to = parseColor(args.get("to"));

    if (from === to) {
        return RawText.translate("commands.wedit:blocks.changed").with("0");
    }

    const total = session.selection.getBlockCount();

    const count = yield* Jobs.run(session, 2, function* () {
        const history = session.history;

        const record = history.record();

        const patterns = new Map<string, TypePatternNode>();

        let changed = 0;
        let progress = 0;

        try {
            const [min, max] = session.selection.getRange();

            yield* history.trackRegion(record, min, max);

            yield Jobs.nextStep("commands.wedit:colorreplace.replacing");

            for (const loc of session.selection.getBlocks()) {
                const block = yield* Jobs.loadBlock(loc);

                const stateColor = normalizeStateColor(block.permutation.getState("color" as any));

                if (stateColor === from) {
                    const replacement = block.permutation.withState("color" as any, getStateColor(to) as any);

                    block.setPermutation(replacement);

                    changed++;

                    yield Jobs.setProgress(++progress / total);

                    continue;
                }

                const targetId = getReplacementType(block.typeId, from, to);

                if (targetId) {
                    let pattern = patterns.get(targetId);

                    if (!pattern) {
                        pattern = new TypePatternNode(null, targetId);

                        pattern.prepare();

                        patterns.set(targetId, pattern);
                    }

                    const permutation = pattern.getPermutation(block);

                    block.setPermutation(permutation);

                    changed++;
                }

                yield Jobs.setProgress(++progress / total);
            }

            yield* history.commit(record);
        } catch (error) {
            history.cancel(record);
            throw error;
        }

        return changed;
    });

    return RawText.translate("commands.wedit:blocks.changed").with(`${count}`);
});
