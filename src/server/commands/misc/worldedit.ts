import { registerCommand } from "../register_commands.js";
import { VERSION } from "@config.js";
import { RawText } from "@notbeer-api";

const registerInformation = {
  name: "worldedit",
  description: "commands.wedit:worldedit.description",
  usage: [
    {
      subName: "version"
    },
    {
      subName: "perf"
    }
  ],
  aliases: ["we"]
};

registerCommand(registerInformation, function (session, builder, args) {
  if (args.has("version")) {
    return RawText.translate("commands.wedit:worldedit.version").with(VERSION);
  } else if (args.has("perf")) {
    session.performanceMode = !session.performanceMode;
    return RawText.translate(`commands.wedit:worldedit.perf.${session.performanceMode ? "enabled" : "disabled"}`);
  }
  return "";
});