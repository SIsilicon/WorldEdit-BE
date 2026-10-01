import { Cardinal } from "@modules/directions.js";
import { Jobs } from "@modules/jobs.js";
import { Pattern } from "@modules/pattern.js";
import { CommandInfo, RawText } from "@notbeer-api";
import { CastShape } from "../../shapes/cast.js";
import { registerCommand } from "../register_commands.js";

const registerInformation: CommandInfo = {
    name: "cast",
    permission: "worldedit.generation.cast",
    description: "commands.wedit:cast.description",
    usage: [
        { name: "pattern", type: "Pattern" },
        { flag: "h" },
        { flag: "d", name: "direction", type: "Direction" },
        { name: "radius", type: "float", range: [0.01, null] },
        { name: "maxRadius", type: "float", range: [0.01, null] },
        { name: "height", type: "int", range: [1, null] },
    ],
};

registerCommand(registerInformation, function* (session, builder, args) {
    const pattern: Pattern = args.get("pattern");
    const radius: number = args.get("radius");
    const maxRadius: number = args.get("maxRadius");
    const height: number = args.get("height");
    const isHollow = args.has("h");

    const direction = (<Cardinal>args.get("d-direction"))?.getDirection(builder);

    const loc = session.getPlacementPosition();

    const castShape = new CastShape(radius, maxRadius, height, direction);

    const count = yield* Jobs.run(
        session,
        2,
        castShape.generate(loc, pattern, null, session, {
            hollow: isHollow,
        })
    );

    return RawText.translate("commands.wedit:blocks.created").with(`${count}`);
});
