import { registerCommand } from "../register_commands.js";
import { CommandInfo, Vector } from "@notbeer-api";
import { LoftShape } from "server/shapes/loft.js";

const registerInformation: CommandInfo = {
    name: "loft",
    permission: "worldedit.generation.shape",
    description: "commands.wedit:loft.description",
    usage: [{ subName: "start" }, { subName: "fill", args: [{ name: "pattern", type: "Pattern" }] }, { subName: "clear" }],
};

registerCommand(registerInformation, function* (session, builder, args) {
    if (args.has("start")) {
        session.loft = new LoftShape([]);
    } else if (args.has("clear")) {
        session.loft = undefined;
    } else if (args.has("fill")) {
        if (!session.loft) throw "TODO Translate: No loft has been created yet!";
        const pattern = args.get("pattern");
        yield* session.loft.generate(Vector.ZERO, pattern, undefined, session);
    }

    return "";
});
