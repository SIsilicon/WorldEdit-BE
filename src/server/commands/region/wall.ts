import { assertSelection } from "@modules/assert.js";
import { Jobs } from "@modules/jobs.js";
import { CommandInfo, RawText } from "@notbeer-api";
import { registerCommand } from "../register_commands.js";

const registerInformation: CommandInfo = {
    name: "walls",
    permission: "worldedit.region.walls",
    description: "commands.wedit:wall.description",
    usage: [{ name: "pattern", type: "Pattern" }],
};

registerCommand(registerInformation, function* (session, builder, args) {
    assertSelection(session);
    if (args.get("_using_item") && session.globalPattern.empty()) {
        throw RawText.translate("worldEdit.selectionFill.noPattern");
    }

    const pattern = args.get("_using_item") ? session.globalPattern : args.get("pattern");

    const [shape, loc] = session.selection.getShape();
    const count = yield* Jobs.run(session, 2, shape.generate(loc, pattern, null, session, { wall: true, hollow: true }));
    return RawText.translate("commands.blocks.wedit:changed").with(`${count}`);
});
