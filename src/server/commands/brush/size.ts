import { registerCommand } from "../register_commands.js";
import { createDefaultBrush } from "./brush.js";
import { assertClipboard, assertSelection } from "@modules/assert.js";
import { RawText, Vector } from "@notbeer-api";

const registerInformation = {
    name: "size",
    description: "commands.wedit:size.description",
    usage: [
        {
            subName: "_brush",
            permission: "worldedit.brush.options.size",
            args: [
                {
                    name: "size",
                    type: "int",
                    range: [1, null] as [number, null],
                },
            ],
        },
        {
            subName: "_selection",
            permission: "worldedit.selection.size",
            args: [
                {
                    flag: "c",
                },
            ],
        },
    ],
};

registerCommand(registerInformation, function (session, builder, args) {
    if (args.has("_selection")) {
        const message = new RawText();
        let size: Vector;
        let blockCount: number;

        if (args.has("c")) {
            assertClipboard(session);

            size = Vector.from(session.clipboard.getSize());
            blockCount = session.clipboard.getBlockCount();

            message.append("translate", "commands.wedit:size.offset").with(`${session.clipboardTransform.offset}\n`);
        } else {
            assertSelection(session);

            const [pos1, pos2] = session.selection.points.map(Vector.from);
            const [start, end] = session.selection.getRange();
            size = Vector.sub(end, start).add(1);
            blockCount = session.selection.getBlockCount();

            message.append("translate", "commands.wedit:size.type").with(`${session.selection.mode}\n`);
            message.append("translate", "commands.wedit:size.pos1").with(`${pos1}\n`);
            message.append("translate", "commands.wedit:size.pos2").with(`${pos2}\n`);
        }

        message.append("translate", "commands.wedit:size.size").with(`${size}\n`);
        message.append("translate", "commands.wedit:size.distance").with(`${size.sub(1).length}\n`);
        message.append("translate", "commands.wedit:size.blocks").with(`${blockCount}`);
        return message;
    }

    if (!session.hasToolProperty(null, "brush")) {
        session.bindTool("brush", null, createDefaultBrush());
    }

    session.setToolProperty(null, "size", args.get("size"));
    return "commands.wedit:brush.size.set";
});
