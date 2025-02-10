import { Jobs } from "@modules/jobs.js";
import { Pattern } from "@modules/pattern.js";
import { RawText } from "@notbeer-api";
import { registerCommand } from "../register_commands.js";
import { Cardinal } from "@modules/directions.js";
import { TorusShape } from "server/shapes/torus.js";

const registerInformation = {
    name: "torus",
    permission: "worldedit.generation.torus",
    description: "commands.wedit:torus.description",
    usage: [
        {
            flag: "h",
        },
        {
            flag: "d",
            name: "direction",
            type: "Direction",
        },
        {
            name: "pattern",
            type: "Pattern",
        },
        {
            name: "outerRadius",
            type: "float",
            range: [0.01, null] as [number, null],
        },
        {
            name: "innerRadius",
            type: "float",
            range: [0.01, null] as [number, null],
        },
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
    return RawText.translate("commands.blocks.wedit:created").with(`${count}`);
});
