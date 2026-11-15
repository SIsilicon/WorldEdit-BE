import { Player } from "@minecraft/server";
import { assertSelection } from "@modules/assert.js";
import { Biome, BiomeChanges } from "@modules/biome_data.js";
import { Jobs } from "@modules/jobs.js";
import { CommandInfo, RawText } from "@notbeer-api";
import { registerCommand } from "../register_commands.js";

const registerInformation: CommandInfo = {
    name: "replacebiome",
    permission: "worldedit.biome.set",
    description: "commands.wedit:replacebiome.description",
    usage: [
        { name: "from", type: "Biome" },
        { name: "to", type: "Biome" },
    ],
};

const warnedPlayers: Player[] = [];

registerCommand(registerInformation, function* (session, builder, args) {
    assertSelection(session);

    const from = (args.get("from") as Biome).getId();
    const to = (args.get("to") as Biome).getId();
    if (from === to) return RawText.translate("commands.wedit:replacebiome.changed").with(0);

    const biomeChanges = new BiomeChanges(builder.dimension);
    const { min, max } = builder.dimension.heightRange;
    const total = session.selection.getBlockCount();
    let checked = 0;
    let changed = 0;

    yield* Jobs.run(session, 1, function* () {
        yield Jobs.nextStep("commands.wedit:biome.setting");

        for (const loc of session.selection.getBlocks()) {
            if (loc.y >= min && loc.y < max) {
                if (!builder.dimension.isChunkLoaded(loc)) yield* Jobs.loadBlock(loc);

                if (biomeChanges.getBiome(loc) === from) {
                    yield* biomeChanges.setBiome(loc, to);
                    changed++;
                }
            }

            checked++;
            yield Jobs.setProgress(checked / total);
            if (checked % 4096 === 0) yield* biomeChanges.flush();
        }

        yield* biomeChanges.flush();
    });

    let message = RawText.translate("commands.wedit:replacebiome.changed").with(changed);
    if (changed > 0 && !warnedPlayers.includes(builder)) {
        message = message.append("text", "\n").append("translate", "commands.wedit:setbiome.warning");
        warnedPlayers.push(builder);
    }
    return message;
});
