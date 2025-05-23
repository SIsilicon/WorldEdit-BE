import { registerCommand } from "../register_commands.js";
import { Jobs } from "@modules/jobs.js";
import { assertSelection } from "@modules/assert.js";
import { CommandInfo, RawText } from "@notbeer-api";

const registerInformation: CommandInfo = {
    name: "replace",
    permission: "worldedit.region.replace",
    description: "commands.wedit:replace.description",
    usage: [
        { name: "mask", type: "Mask" },
        { name: "pattern", type: "Pattern" },
    ],
};

registerCommand(registerInformation, function* (session, builder, args) {
    assertSelection(session);
    if (args.get("_using_item") && session.globalPattern.empty()) {
        throw RawText.translate("worldEdit.selectionFill.noPattern");
    }

    const mask = args.get("_using_item") ? session.globalMask : args.get("mask");
    const pattern = args.get("_using_item") ? session.globalPattern : args.get("pattern");

    const [shape, loc] = session.selection.getShape();
    const count = yield* Jobs.run(session, 2, shape.generate(loc, pattern, mask, session));
    return RawText.translate("commands.blocks.wedit:changed").with(`${count}`);
});
