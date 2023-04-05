import { Player } from "@minecraft/server";
import { Server } from "@notbeer-api";
import { PlayerSession } from "../../sessions.js";
import { registerCommand } from "../register_commands.js";
import { assertPermission } from "@modules/assert.js";
import { Mask } from "@modules/mask.js";
import { RawText } from "@notbeer-api";

const registerInformation = {
  name: "tool",
  description: "commands.wedit:tool.description",
  usage: [
    {
      subName: "none"
    },
    {
      subName: "stacker",
      permission: "worldedit.tool.stack",
      description: "commands.wedit:tool.description.stacker",
      args: [
        {
          name: "range",
          type: "int",
          range: [1, null] as [number, null],
          default: 1
        }, {
          name: "mask",
          type: "Mask",
          default: new Mask()
        }
      ]
    },
    {
      subName: "selwand",
      permission: "worldedit.setwand",
      description: "commands.wedit:tool.description.selwand"
    },
    {
      subName: "navwand",
      permission: "worldedit.setwand",
      description: "commands.wedit:tool.description.navwand"
    },
    {
      subName: "farwand",
      permission: "worldedit.farwand",
      description: "commands.wedit:tool.description.farwand"
    },
    {
      subName: "cmd",
      permission: "worldedit.tool.cmd",
      description: "commands.wedit:tool.description.cmd",
      args: [
        {
          name: "command",
          type: "string"
        }
      ]
    }
  ]
};

// TODO: Add floodfill tool
// TODO: Add delete tree tool

function heldItemName(player: Player) {
  const name = Server.player.getHeldItem(player).typeId;
  return name.replace("minecraft:", "");
}

const stack_command = (session: PlayerSession, builder: Player, args: Map<string, unknown>) => {
  assertPermission(builder, registerInformation.usage[1].permission);
  session.bindTool("stacker_wand", null, args.get("range"), args.get("mask"));
  return RawText.translate("commands.wedit:tool.bind.stacker").with(heldItemName(builder));
};

const selwand_command = (session: PlayerSession, builder: Player) => {
  assertPermission(builder, registerInformation.usage[2].permission);
  session.bindTool("selection_wand", null);
  return RawText.translate("commands.wedit:tool.bind.selwand").with(heldItemName(builder));
};

const navwand_command = (session: PlayerSession, builder: Player) => {
  assertPermission(builder, registerInformation.usage[3].permission);
  session.bindTool("navigation_wand", null);
  return RawText.translate("commands.wedit:tool.bind.navwand").with(heldItemName(builder));
};

const farwand_command = (session: PlayerSession, builder: Player) => {
  assertPermission(builder, registerInformation.usage[4].permission);
  session.bindTool("far_selection_wand", null);
  return RawText.translate("commands.wedit:tool.bind.farwand").with(heldItemName(builder));
};

const cmd_command = (session: PlayerSession, builder: Player, args: Map<string, unknown>) => {
  assertPermission(builder, registerInformation.usage[5].permission);
  session.bindTool("command_wand", null, args.get("command"));
  return RawText.translate("commands.wedit:tool.bind.stacker").with(heldItemName(builder));
};

registerCommand(registerInformation, function (session, builder, args) {
  let msg: RawText;
  if (args.has("stacker")) {
    msg = stack_command(session, builder, args);
  } else if (args.has("selwand")) {
    msg = selwand_command(session, builder);
  } else if (args.has("navwand")) {
    msg = navwand_command(session, builder);
  } else if (args.has("farwand")) {
    msg = farwand_command(session, builder);
  } else if (args.has("cmd")) {
    msg = cmd_command(session, builder, args);
  } else {
    session.unbindTool(null);
    return "commands.wedit:tool.unbind";
  }
  return msg.append("text", "\n").append("translate", "commands.generic.wedit:unbindInfo").with(";tool none");
});
