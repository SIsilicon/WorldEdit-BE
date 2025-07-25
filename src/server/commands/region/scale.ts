import { registerCommand } from "../register_commands.js";
import { assertClipboard } from "@modules/assert.js";
import { CommandInfo, RawText, Vector } from "@notbeer-api";
import { transformSelection } from "./transform_func.js";
import { Jobs } from "@modules/jobs.js";

const registerInformation: CommandInfo = {
    name: "scale",
    permission: "worldedit.region.scale",
    description: "commands.wedit:scale.description",
    usage: [
        { flag: "o" },
        { flag: "w" },
        { flag: "s" },
        {
            subName: "_",
            args: [{ name: "scale", type: "float" }],
        },
        {
            subName: "_xy",
            args: [
                { name: "scaleXZ", type: "float" },
                { name: "scaleY", type: "float" },
            ],
        },
        {
            subName: "_xyz",
            args: [
                { name: "scaleX", type: "float" },
                { name: "scaleY", type: "float" },
                { name: "scaleZ", type: "float" },
            ],
        },
    ],
};

registerCommand(registerInformation, function* (session, builder, args) {
    let scale: Vector;
    if (args.has("_xyz")) scale = new Vector(args.get("scaleX"), args.get("scaleY"), args.get("scaleZ"));
    else if (args.has("_xy")) scale = new Vector(args.get("scaleXZ"), args.get("scaleY"), args.get("scaleXZ"));
    else scale = new Vector(args.get("scale"), args.get("scale"), args.get("scale"));

    let blockCount = 0;
    if (args.has("w")) {
        yield* Jobs.run(session, 4, transformSelection(session, builder, args, { scale }));
        blockCount = session.selection.getBlockCount();
    } else {
        assertClipboard(session);
        const clipTrans = session.clipboardTransform;

        // TODO: Get -o flag working for clipboard flips again
        // if (!args.has("o")) {
        //     if (Math.abs(dir.x)) {
        //         clipTrans.offset.x *= -1;
        //     } else if (Math.abs(dir.z)) {
        //         clipTrans.offset.z *= -1;
        //     }
        // }

        clipTrans.scale = clipTrans.scale.mul(scale);
        blockCount = session.clipboard.getVolume();
    }

    return RawText.translate("commands.wedit:scale.explain").with(blockCount);
});
