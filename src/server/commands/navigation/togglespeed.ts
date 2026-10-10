import { CommandInfo, RawText } from "@notbeer-api";
import { registerCommand } from "../register_commands.js";

const registerInformation: CommandInfo = {
    name: "togglespeed",
    aliases: ["ts"],
    permission: "worldedit.navigation.togglespeed",
    description: "commands.wedit:togglespeed.description",
};

registerCommand(registerInformation, function (session) {
    const enabled = session.toggleSpeed();

    return RawText.translate(enabled ? "commands.wedit:togglespeed.enabled" : "commands.wedit:togglespeed.disabled");
});
