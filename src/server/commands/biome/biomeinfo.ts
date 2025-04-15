import { assertSelection } from "@modules/assert.js";
import { Biome, getBiomeId } from "@modules/biome_data.js";
import { Jobs } from "@modules/jobs.js";
import { PlayerUtil } from "@modules/player_util.js";
import { CommandInfo, RawText } from "@notbeer-api";
import { registerCommand } from "../register_commands.js";

const registerInformation: CommandInfo = {
    name: "biomeinfo",
    permission: "worldedit.biome.info",
    description: "commands.wedit:biomeinfo.description",
    usage: [{ name: "detectAt", type: "enum", values: ["selection", "position", "lineofsight"], default: "selection" }],
};

registerCommand(registerInformation, function* (session, builder, args) {
    switch (args.get("detectAt")) {
        case "selection": {
            assertSelection(session);
            return yield* Jobs.run(session, 1, function* () {
                yield Jobs.nextStep("Reading biome data...");
                const biomes = new Map<number, Biome>();
                const promises: Promise<void>[] = [];
                const blockCount = session.selection.getBlockCount();
                const checkChance = Math.ceil(1 / Math.min(128 / blockCount, 1));

                let i = 0;
                let j = 0;
                for (const block of session.selection.getBlocks()) {
                    if (j % checkChance == 0) {
                        promises.push(
                            getBiomeId(builder.dimension, block).then((id) => {
                                if (!biomes.has(id)) biomes.set(id, new Biome(`${id}`));
                            })
                        );
                    } else {
                        yield Jobs.setProgress(++i / blockCount);
                    }
                    j++;
                    if (promises.length >= 128) {
                        yield Promise.all(promises);
                        promises.length = 0;
                    } else {
                        yield;
                    }
                }
                if (promises.length) yield Promise.all(promises);
                Jobs.setProgress(1);

                const result = "\n" + [...biomes.values()].map((biome) => biome.getName()).join(",\n");
                return RawText.translate("commands.wedit:biomeinfo.selection").with(result);
            });
        }
        case "position": {
            const result = (yield getBiomeId(builder.dimension, PlayerUtil.getBlockLocation(builder))) as number;
            return RawText.translate("commands.wedit:biomeinfo.position").with(new Biome(`${result}`).getName());
        }
        case "lineofsight": {
            const hit = PlayerUtil.traceForBlock(builder);
            if (!hit) throw "commands.wedit:jumpto.none";
            const result = (yield getBiomeId(builder.dimension, hit)) as number;
            return RawText.translate("commands.wedit:biomeinfo.lineofsight").with(new Biome(`${result}`).getName());
        }
    }
});
