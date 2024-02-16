import { RawText } from "@notbeer-api";
import { registerCommand } from "../register_commands.js";

const registerInformation = {
    name: "drawsel",
    permission: "worldedit.drawsel",
    description: "commands.wedit:drawsel.description"
};

registerCommand(registerInformation, function (session) {
    session.drawOutlines = !session.drawOutlines;
    if (session.drawOutlines) {
        return RawText.translate("commands.wedit:drawsel.enabled");
    } else {
        return RawText.translate("commands.wedit:drawsel.disabled");
    }
});
