import { Jobs } from "@modules/jobs.js";
import { CommandInfo, RawText } from "@notbeer-api";
import { CuboidShape } from "../../shapes/cuboid.js";
import { registerCommand } from "../register_commands.js";

const registerInformation: CommandInfo = {
    name: "replacenear",
    permission: "worldedit.utility.replacenear",
    description: "commands.wedit:replacenear.description",
    usage: [
        { name: "size", type: "int" },
        { name: "mask", type: "Mask" },
        { name: "pattern", type: "Pattern" },
    ],
};

registerCommand(registerInformation, function* (session, builder, args) {
    const size = (args.get("size") - 1) * 2 + 1;
    const origin = session
        .getPlacementPosition()
        .sub(size / 2)
        .ceil()
        .floor();

    const shape = new CuboidShape(size, size, size);
    const count = yield* Jobs.run(session, 2, shape.generate(origin, args.get("pattern"), args.get("mask"), session, { ignoreGlobalMask: true }));
    return RawText.translate("commands.wedit:blocks.changed").with(`${count}`);
});
