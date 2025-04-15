import { assertHistoryNotRecording } from "@modules/assert.js";
import { CommandInfo, RawText } from "@notbeer-api";
import { registerCommand } from "../register_commands.js";

const registerInformation: CommandInfo = {
    name: "clearhistory",
    permission: "worldedit.history.clear",
    description: "commands.wedit:clearhistory.description",
};

registerCommand(registerInformation, function (session) {
    const history = session.history;
    assertHistoryNotRecording(history);
    history.clear();
    return RawText.translate("commands.wedit:clearhistory.explain");
});
