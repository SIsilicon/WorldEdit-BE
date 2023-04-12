import { registerCommand } from "../register_commands.js";

const registerInformation = {
  name: "clearclipboard",
  permission: "worldedit.clipboard.clear",
  description: "commands.wedit:clearclipboard.description"
};

registerCommand(registerInformation, function (session) {
  if (!session.clipboard) {
    throw "commands.generic.wedit:commandFail";
  }
  session.deleteRegion(session.clipboard);
  session.clipboard = null;
  return "commands.wedit:clearclipboard.explain";
});
