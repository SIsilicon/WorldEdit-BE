import { Jobs } from "@modules/jobs.js";
import { Pattern } from "@modules/pattern.js";
import { Cardinal } from "@modules/directions.js";
import { CommandInfo, RawText, Vector } from "@notbeer-api";
import { SphereShape } from "../../shapes/sphere.js";
import { registerCommand } from "../register_commands.js";

const registerInformation: CommandInfo = {
    name: "dome",
    permission: "worldedit.generation.sphere",
    description: "commands.wedit:dome.description",
    usage: [
        { name: "pattern", type: "Pattern" },
        { flag: "d", name: "direction", type: "Direction" },
        { name: "radius", type: "float", range: [0.01, null] },
        { name: "thickness", type: "float", default: 0, range: [0, null] },
    ],
};

registerCommand(registerInformation, function* (session, builder, args) {
    const pattern: Pattern = args.get("pattern");
    const radius: number = args.get("radius");
    const thickness: number = args.get("thickness");

    const direction = (<Cardinal>args.get("d-direction"))?.getDirection(builder) ?? new Vector(0, 1, 0);
    const loc = session.getPlacementPosition();

    const domeShape = new SphereShape(radius, radius, radius, direction);

    const count = yield* Jobs.run(
        session,
        2,
        domeShape.generate(loc, pattern, null, session, {
            hollow: thickness > 0,
            hollowThickness: thickness || 1,
        })
    );

    return RawText.translate("commands.wedit:blocks.created").with(`${count}`);
});
