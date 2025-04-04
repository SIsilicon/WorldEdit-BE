import { assertHistoryNotRecording } from "@modules/assert.js";
import { RawText } from "@notbeer-api";
import { registerCommand } from "../register_commands.js";

const registerInformation = {
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
