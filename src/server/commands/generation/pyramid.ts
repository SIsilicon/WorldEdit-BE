import { Jobs } from "@modules/jobs.js";
import { Pattern } from "@modules/pattern.js";
import { RawText } from "@notbeer-api";
import { PyramidShape } from "../../shapes/pyramid.js";
import { registerCommand } from "../register_commands.js";

const registerInformation = {
    name: "pyramid",
    permission: "worldedit.generation.pyramid",
    description: "commands.wedit:pyramid.description",
    usage: [
        {
            name: "pattern",
            type: "Pattern",
        },
        {
            name: "size",
            type: "int",
            range: [1, null] as [number, null],
        },
        {
            name: "hollow",
            type: "bool",
            default: false,
        },
    ],
};

registerCommand(registerInformation, function* (session, builder, args) {
    const pattern: Pattern = args.get("pattern");
    const isHollow = args.get("hollow");
    const size: number = args.get("size");

    const loc = session.getPlacementPosition();
    const pyramidShape = new PyramidShape(size);
    const count = yield* Jobs.run(session, 2, pyramidShape.generate(loc, pattern, null, session, { hollow: isHollow }));
    return RawText.translate("commands.blocks.wedit:created").with(`${count}`);
});
