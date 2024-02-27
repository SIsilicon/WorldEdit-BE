import { Mask } from "@modules/mask.js";
import { registerCommand } from "../register_commands.js";
import { createDefaultBrush } from "./brush.js";

const registerInformation = {
    name: "mask",
    permission: "worldedit.brush.options.mask",
    description: "commands.wedit:mask.description",
    usage: [
        {
            name: "mask",
            type: "Mask",
            default: new Mask(),
        },
    ],
};

registerCommand(registerInformation, function (session, builder, args) {
    if (!session.hasToolProperty(null, "brush")) {
        session.bindTool("brush", null, createDefaultBrush());
    }

    session.setToolProperty(null, "mask", args.get("mask"));
    return "commands.wedit:brush.mask." + (args.get("mask").empty() ? "disabled" : "set");
});
