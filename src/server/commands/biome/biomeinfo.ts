import { assertSelection } from "@modules/assert.js";
import { Jobs } from "@modules/jobs.js";
import { PlayerUtil } from "@modules/player_util.js";
import { CommandInfo, RawText } from "@notbeer-api";
import { registerCommand } from "../register_commands.js";

const registerInformation: CommandInfo = {
    name: "biomeinfo",
    permission: "worldedit.biome.info",
    description: "commands.wedit:biomeinfo.description",
    usage: [{ flag: "p" }, { flag: "t" }],
};

registerCommand(registerInformation, function* (session, builder, args) {
    if (args.has("p")) {
        const result = builder.dimension.getBiome(PlayerUtil.getBlockLocation(builder));
        return RawText.translate("commands.wedit:biomeinfo.position").with(result.id);
    } else if (args.has("t")) {
        const hit = PlayerUtil.traceForBlock(builder);
        if (!hit) throw "commands.wedit:jumpto.none";
        const result = builder.dimension.getBiome(hit);
        return RawText.translate("commands.wedit:biomeinfo.lineofsight").with(result.id);
    } else {
        assertSelection(session);
        return yield* Jobs.run(session, 1, function* () {
            yield Jobs.nextStep("commands.wedit:biome.reading");
            const dimension = builder.dimension;
            const biomes = new Set<string>();
            const blockCount = session.selection.getBlockCount();
            const checkChance = Math.ceil(1 / Math.min(128 / blockCount, 1));

            let i = 0;
            let j = 0;
            for (const block of session.selection.getBlocks()) {
                if (j % checkChance == 0) biomes.add(dimension.getBiome(block).id);
                else yield Jobs.setProgress(++i / blockCount);
                j++;
            }
            Jobs.setProgress(1);

            const result = "\n" + [...biomes].join(",\n");
            return RawText.translate("commands.wedit:biomeinfo.selection").with(result);
        });
    }
});
