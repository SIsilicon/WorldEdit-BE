import { registerCommand } from "../register_commands.js";
import { RawText, Vector } from "@notbeer-api";
import { assertClipboard } from "@modules/assert.js";
import { transformSelection } from "./transform_func.js";
import { Jobs } from "@modules/jobs.js";

const registerInformation = {
    name: "rotate",
    permission: "worldedit.region.rotate",
    description: "commands.wedit:rotate.description",
    usage: [
        {
            flag: "o",
        },
        {
            flag: "w",
        },
        {
            flag: "s",
        },
        {
            name: "rotate",
            type: "int",
        },
        {
            name: "rotateX",
            type: "int",
            default: 0,
        },
        {
            name: "rotateZ",
            type: "int",
            default: 0,
        },
    ],
};

registerCommand(registerInformation, function* (session, builder, args) {
    let blockCount = 0;
    const rotation = new Vector(args.get("rotateX"), args.get("rotate"), args.get("rotateZ"));

    if (args.has("w")) {
        yield* Jobs.run(session, 4, transformSelection(session, builder, args, { rotation }));
        blockCount = session.selection.getBlockCount();
    } else {
        assertClipboard(session);

        // TODO: Get -o flag working for clipboard rotations again
        // if (!args.has("o")) {
        //     session.clipboardTransform.offset = session.clipboardTransform.offset.rotate(args.get("rotate"), "y");
        // }
        session.clipboardTransform.rotation = session.clipboardTransform.rotation.add(rotation);
        blockCount = session.clipboard.getVolume();
    }

    return RawText.translate("commands.wedit:rotate.explain").with(blockCount);
});
