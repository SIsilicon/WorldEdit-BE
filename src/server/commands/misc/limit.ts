import { registerCommand } from "../register_commands.js";
import { Server } from "@notbeer-api";
import { RawText } from "@notbeer-api";
import config from "@config.js";

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
  let changeLimit = args.get("limit") == -1 ? config.defaultChangeLimit : args.get("limit");
  if (changeLimit == -1) {
    changeLimit = Infinity;
  }
  if (!Server.player.hasPermission(builder, "worldedit.limit.unrestricted") && config.maxChangeLimit != -1 && changeLimit > config.maxChangeLimit) {
    throw RawText.translate("commands.wedit:limit.tooHigh").with(config.maxChangeLimit);
  }
  session.changeLimit = changeLimit;
  return RawText.translate("commands.wedit:limit.set").with(changeLimit);
});