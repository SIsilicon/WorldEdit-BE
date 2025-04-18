import { registerCommand } from "../register_commands.js";
import { createDefaultBrush } from "./brush.js";
import { CommandInfo } from "@notbeer-api";

const registerInformation: CommandInfo = {
    name: "range",
    permission: "worldedit.brush.options.range",
    description: "commands.wedit:range.description",
    usage: [{ name: "range", type: "int", range: [1, null], default: -1 }],
};

registerCommand(registerInformation, function (session, builder, args) {
    if (!session.hasToolProperty(null, "brush")) session.bindTool("brush", null, createDefaultBrush());
    session.setToolProperty(null, "range", args.get("range"));
    return "commands.wedit:brush.range.set";
});
