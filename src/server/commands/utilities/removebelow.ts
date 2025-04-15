import { Jobs } from "@modules/jobs.js";
import { Pattern } from "@modules/pattern.js";
import { CommandInfo, RawText } from "@notbeer-api";
import { CuboidShape } from "../../shapes/cuboid.js";
import { getWorldHeightLimits } from "../../util.js";
import { registerCommand } from "../register_commands.js";

const registerInformation: CommandInfo = {
    name: "removebelow",
    permission: "worldedit.utility.removebelow",
    description: "commands.wedit:removebelow.description",
    usage: [
        { name: "size", type: "int" },
        { name: "depth", type: "int", range: [1, null], default: -1 },
    ],
};

registerCommand(registerInformation, function* (session, builder, args) {
    const size = (args.get("size") - 1) * 2 + 1;
    const depth: number = args.get("depth") == -1 ? Math.floor(builder.location.y) - getWorldHeightLimits(builder.dimension)[0] + 1 : args.get("depth");
    const origin = session
        .getPlacementPosition()
        .sub([size / 2, depth - 1, size / 2])
        .ceil()
        .floor();

    const shape = new CuboidShape(size, depth, size);
    const count = yield* Jobs.run(session, 2, shape.generate(origin, new Pattern("air"), null, session, { ignoreGlobalMask: true }));
    return RawText.translate("commands.blocks.wedit:changed").with(`${count}`);
});
