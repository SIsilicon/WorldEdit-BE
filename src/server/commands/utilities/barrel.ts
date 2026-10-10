import { BlockInventoryComponent, ItemStack } from "@minecraft/server";
import { Jobs } from "@modules/jobs.js";
import { CommandInfo, RawText } from "@notbeer-api";
import { registerCommand } from "../register_commands.js";

const registerInformation: CommandInfo = {
    name: "barrel",
    permission: "worldedit.utility.barrel",
    description: "commands.wedit:barrel.description",
    usage: [{ name: "strength", type: "int", range: [0, 15] }],
};

registerCommand(registerInformation, function* (session, builder, args) {
    const strength: number = args.get("strength");
    const location = session.getPlacementPosition();

    const shovelCount = Math.ceil(Math.max(strength, (27 * (strength - 1)) / 14));

    return yield* Jobs.run(session, 1, function* () {
        const block = yield* Jobs.loadBlock(location);

        const history = session.history;
        const record = history.record();

        try {
            yield* history.trackRegion(record, location, location);

            block.setType("minecraft:barrel");

            const inventory = block.getComponent("inventory") as BlockInventoryComponent;
            const container = inventory?.container;

            if (!container) {
                throw RawText.translate("commands.generic.wedit:commandFail");
            }

            container.clearAll();

            for (let i = 0; i < shovelCount; i++) {
                container.setItem(i, new ItemStack("minecraft:wooden_shovel"));
            }

            yield* history.commit(record);
        } catch (err) {
            history.cancel(record);
            throw err;
        }

        return RawText.translate("commands.wedit:barrel.created").with(`${strength}`).with(`${shovelCount}`);
    });
});
