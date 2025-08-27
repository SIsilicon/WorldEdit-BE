import { Jobs } from "@modules/jobs.js";
import { registerCommand } from "../register_commands.js";
import { CommandInfo, RawText, Vector } from "@notbeer-api";
import { LoftShape } from "server/shapes/loft.js";

const registerInformation: CommandInfo = {
    name: "loft",
    permission: "worldedit.generation.shape",
    description: "commands.wedit:loft.description",
    usage: [{ subName: "start" }, { subName: "set", args: [{ name: "pattern", type: "Pattern" }] }, { subName: "remove" }, { subName: "clear" }],
};

registerCommand(registerInformation, function* (session, builder, args) {
    if (args.has("start")) {
        session.loft = new LoftShape([]);
        return "commands.wedit:loft.started";
    } else if (args.has("clear")) {
        session.loft = undefined;
        return "commands.wedit:loft.cleared";
    } else if (args.has("remove")) {
        if (!session.loft.removeLastPoint()) session.loft = undefined;
        return session.loft ? "commands.wedit:loft.removed" : "commands.wedit:loft.removed.last";
    } else if (args.has("set")) {
        if (!session.loft) throw "commands.wedit:loft.notStarted";
        if (args.get("_using_item") && session.globalPattern.empty()) {
            throw RawText.translate("worldEdit.selectionFill.noPattern");
        }
        const pattern = args.get("_using_item") ? session.globalPattern : args.get("pattern");
        const count = yield* Jobs.run(session, 2, session.loft.generate(Vector.ZERO, pattern, undefined, session));
        return RawText.translate("commands.blocks.wedit:created").with(`${count}`);
    }

    return "";
});
