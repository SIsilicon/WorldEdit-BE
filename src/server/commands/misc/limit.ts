import { registerCommand } from "../register_commands.js";
import { DEFAULT_CHANGE_LIMIT, MAX_CHANGE_LIMIT } from "@config.js";
import { Server } from "@notbeer-api";
import { RawText } from "@notbeer-api";

const registerInformation = {
  name: "limit",
  permission: "worldedit.limit",
  description: "commands.wedit:limit.description",
  usage: [
    {
      name: "limit",
      type: "int",
      range: [1, null] as [number, null],
      default: -1
    }
  ]
};

registerCommand(registerInformation, function (session, builder, args) {
  let changeLimit = args.get("limit") == -1 ? DEFAULT_CHANGE_LIMIT : args.get("limit");
  if (changeLimit == -1) {
    changeLimit = Infinity;
  }
  if (!Server.player.hasPermission(builder, "worldedit.limit.unrestricted") && MAX_CHANGE_LIMIT != -1 && changeLimit > MAX_CHANGE_LIMIT) {
    throw RawText.translate("commands.wedit:limit.tooHigh").with(MAX_CHANGE_LIMIT);
  }
  session.changeLimit = changeLimit;
  return RawText.translate("commands.wedit:limit.set").with(changeLimit);
});