import { Mask } from "@modules/mask.js";
import { RawText } from "@notbeer-api";
import { registerCommand } from "../register_commands.js";

const registerInformation = {
    name: "gmask",
    permission: "worldedit.global-mask",
    description: "commands.wedit:gmask.description",
    usage: [
        {
            name: "mask",
            type: "Mask",
            default: new Mask(),
        },
    ],
};

registerCommand(registerInformation, function (session, builder, args) {
    session.globalMask = Mask.clone(args.get("mask"));
    if (!args.get("mask").empty()) {
        return RawText.translate("commands.wedit:gmask.set");
    } else {
        return RawText.translate("commands.wedit:gmask.disabled");
    }
});
