import { registerCommand } from "../register_commands.js";
import { CommandInfo } from "@notbeer-api";

const registerInformation: CommandInfo = {
    name: "clearclipboard",
    permission: "worldedit.clipboard.clear",
    description: "commands.wedit:clearclipboard.description",
};

registerCommand(registerInformation, function (session) {
    session.clipboard = undefined;
    return "commands.wedit:clearclipboard.explain";
});
