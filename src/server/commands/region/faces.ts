import { assertSelection } from "@modules/assert.js";
import { Jobs } from "@modules/jobs.js";
import { CommandInfo, RawText } from "@notbeer-api";
import { registerCommand } from "../register_commands.js";
import { Mask } from "@modules/mask.js";

const registerInformation: CommandInfo = {
    name: "faces",
    permission: "worldedit.region.faces",
    description: "commands.wedit:faces.description",
    usage: [
        { name: "pattern", type: "Pattern" },
        { name: "mask", type: "Mask", default: new Mask() },
    ],
};

registerCommand(registerInformation, function* (session, builder, args) {
    assertSelection(session);
    if (args.get("_using_item") && session.globalPattern.empty()) {
        throw RawText.translate("worldEdit.selectionFill.noPattern");
    }

    const pattern = args.get("_using_item") ? session.globalPattern : args.get("pattern");
    const mask = args.get("_using_item") ? undefined : args.get("mask");

    const [shape, loc] = session.selection.getShape();
    const count = yield* Jobs.run(session, 2, shape.generate(loc, pattern, mask, session, { hollow: true }));
    return RawText.translate("commands.blocks.wedit:changed").with(`${count}`);
});
