import { Jobs } from "@modules/jobs.js";
import { Pattern } from "@modules/pattern.js";
import { CommandInfo, RawText } from "@notbeer-api";
import { CuboidShape } from "../../shapes/cuboid.js";
import { getWorldHeightLimits } from "../../util.js";
import { registerCommand } from "../register_commands.js";

const registerInformation: CommandInfo = {
    name: "removeabove",
    permission: "worldedit.utility.removeabove",
    description: "commands.wedit:removeabove.description",
    usage: [
        { name: "size", type: "int" },
        { name: "height", type: "int", range: [1, null], default: -1 },
    ],
};

registerCommand(registerInformation, function* (session, builder, args) {
    const size = (args.get("size") - 1) * 2 + 1;
    const height: number = args.get("height") == -1 ? getWorldHeightLimits(builder.dimension)[1] - Math.floor(builder.location.y) + 1 : args.get("height");
    const origin = session
        .getPlacementPosition()
        .sub([size / 2, 0, size / 2])
        .ceil()
        .floor();

    const shape = new CuboidShape(size, height, size);
    const count = yield* Jobs.run(session, 2, shape.generate(origin, new Pattern("air"), null, session, { ignoreGlobalMask: true }));

    return RawText.translate("commands.wedit:blocks.changed").with(`${count}`);
});
