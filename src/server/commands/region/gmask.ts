import { Mask } from "@modules/mask.js";
import { CommandInfo, RawText } from "@notbeer-api";
import { registerCommand } from "../register_commands.js";

const registerInformation: CommandInfo = {
    name: "gmask",
    permission: "worldedit.global-mask",
    description: "commands.wedit:gmask.description",
    usage: [{ name: "mask", type: "Mask", default: new Mask() }],
};

registerCommand(registerInformation, function (session, builder, args) {
    session.globalMask = args.get("mask");
    if (!args.get("mask").empty()) {
        return RawText.translate("commands.wedit:gmask.set");
    } else {
        return RawText.translate("commands.wedit:gmask.disabled");
    }
});
