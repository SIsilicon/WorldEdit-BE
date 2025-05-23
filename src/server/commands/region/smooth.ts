import { assertSelection } from "@modules/assert.js";
import { Jobs } from "@modules/jobs.js";
import { Mask } from "@modules/mask.js";
import { CommandInfo, RawText } from "@notbeer-api";
import { registerCommand } from "../register_commands.js";
import { smooth } from "./heightmap_func.js";

const registerInformation: CommandInfo = {
    name: "smooth",
    permission: "worldedit.region.smooth",
    description: "commands.wedit:smooth.description",
    usage: [
        { name: "iterations", type: "int", range: [1, null], default: 1 },
        { name: "mask", type: "Mask", default: new Mask() },
    ],
};

registerCommand(registerInformation, function* (session, builder, args) {
    assertSelection(session);
    const [shape, loc] = session.selection.getShape();
    const count = yield* Jobs.run(session, 2 + args.get("iterations") * 2, smooth(session, args.get("iterations"), shape, loc, args.get("mask"), null));
    return RawText.translate("commands.blocks.wedit:changed").with(`${count}`);
});
