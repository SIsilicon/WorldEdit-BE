import { Jobs } from "@modules/jobs.js";
import { Pattern } from "@modules/pattern.js";
import { CommandInfo, RawText } from "@notbeer-api";
import { ConeShape } from "../../shapes/cone.js";
import { registerCommand } from "../register_commands.js";
import { Cardinal } from "@modules/directions.js";

const registerInformation: CommandInfo = {
    name: "cone",
    permission: "worldedit.generation.cone",
    description: "commands.wedit:cone.description",
    usage: [
        { name: "pattern", type: "Pattern" },
        { flag: "d", name: "direction", type: "Direction" },
        { name: "radius", type: "float", range: [0.01, null] },
        { name: "height", type: "int", range: [1, null] },
    ],
};

registerCommand(registerInformation, function* (session, builder, args) {
    const pattern: Pattern = args.get("pattern");
    const radius: number = args.get("radius");
    const height: number = args.get("height");

    const direction = (<Cardinal>args.get("d-direction"))?.getDirection(builder);
    const loc = session.getPlacementPosition();

    const coneShape = new ConeShape(radius, height, direction);

    const count = yield* Jobs.run(session, 2, coneShape.generate(loc, pattern, null, session));

    return RawText.translate("commands.wedit:blocks.created").with(`${count}`);
});


