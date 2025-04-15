import { CommandInfo, RawText } from "@notbeer-api";
import { registerCommand } from "../register_commands.js";

const registerInformation: CommandInfo = {
    name: "drawsel",
    permission: "worldedit.drawsel",
    description: "commands.wedit:drawsel.description",
};

registerCommand(registerInformation, function (session) {
    session.drawOutlines = !session.drawOutlines;
    return RawText.translate(session.drawOutlines ? "commands.wedit:drawsel.enabled" : "commands.wedit:drawsel.disabled");
});
