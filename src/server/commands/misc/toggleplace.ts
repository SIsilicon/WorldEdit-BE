import { registerCommand } from "../register_commands.js";
import { RawText } from "@notbeer-api";

const registerInformation = {
  name: "toggleplace",
  description: "commands.wedit:toggleplace.description"
};

registerCommand(registerInformation, function (session) {
  session.togglePlacementPosition();
  return RawText.translate("commands.wedit:toggleplace.complete");
});
