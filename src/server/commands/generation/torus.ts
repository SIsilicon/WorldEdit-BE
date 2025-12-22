import { Jobs } from "@modules/jobs.js";
import { Pattern } from "@modules/pattern.js";
import { CommandInfo, RawText } from "@notbeer-api";
import { registerCommand } from "../register_commands.js";
import { Cardinal } from "@modules/directions.js";
import { TorusShape } from "server/shapes/torus.js";

const registerInformation: CommandInfo = {
    name: "torus",
    permission: "worldedit.generation.torus",
    description: "commands.wedit:torus.description",
    usage: [
        { flag: "h" },
        { name: "pattern", type: "Pattern" },
        { name: "outerRadius", type: "float", range: [0.01, null] },
        { name: "innerRadius", type: "float", range: [0.01, null] },
        { flag: "d", name: "direction", type: "Direction" },
    ],
};

registerCommand(registerInformation, function* (session, builder, args) {
    const pattern: Pattern = args.get("pattern");
    const outerRadius = args.get("outerRadius");
    const innerRadius = args.get("innerRadius");
    const isHollow = args.has("h");

    const loc = session.getPlacementPosition();

    const cylShape = new TorusShape(outerRadius, innerRadius, (<Cardinal>args.get("d-direction"))?.getDirection(builder));
    const count = yield* Jobs.run(session, 2, cylShape.generate(loc, pattern, null, session, { hollow: isHollow }));
    return RawText.translate("commands.wedit:blocks.created").with(`${count}`);
});
