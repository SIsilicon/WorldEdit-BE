import { Jobs } from "@modules/jobs.js";
import { Pattern } from "@modules/pattern.js";
import { CommandInfo, RawText } from "@notbeer-api";
import { CylinderShape } from "../../shapes/cylinder.js";
import { registerCommand } from "../register_commands.js";
import { Cardinal } from "@modules/directions.js";

const registerInformation: CommandInfo = {
    name: "cyl",
    permission: "worldedit.generation.cylinder",
    description: "commands.wedit:cyl.description",
    usage: [
        { name: "pattern", type: "Pattern" },
        { flag: "h" },
        { flag: "r" },
        { flag: "d", name: "direction", type: "Direction" },
        {
            subName: "_",
            args: [
                { name: "radii", type: "float", range: [0.01, null] },
                { name: "height", type: "int", default: 1, range: [1, null] },
            ],
        },
        {
            subName: "_xz",
            args: [
                { name: "radiiX", type: "float", range: [0.01, null] },
                { name: "radiiZ", type: "float", range: [0.01, null] },
                { name: "height", type: "int", default: 1, range: [1, null] },
            ],
        },
    ],
};

registerCommand(registerInformation, function* (session, builder, args) {
    const pattern: Pattern = args.get("pattern");
    let radii: [number, number];
    const height: number = args.get("height");
    const isHollow = args.has("h");
    const isRaised = args.has("r");

    if (args.has("_xz")) radii = [args.get("radiiX"), args.get("radiiZ")];
    else radii = [args.get("radii"), args.get("radii")];

    const loc = session.getPlacementPosition().offset(0, isRaised ? height / 2 : 0, 0);

    const cylShape = new CylinderShape(height, ...(<[number, number]>radii), (<Cardinal>args.get("d-direction"))?.getDirection(builder));
    const count = yield* Jobs.run(session, 2, cylShape.generate(loc, pattern, null, session, { hollow: isHollow }));
    return RawText.translate("commands.blocks.wedit:created").with(`${count}`);
});
