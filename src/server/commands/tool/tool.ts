import { Player } from "@minecraft/server";
import { Server } from "@notbeer-api";
import { PlayerSession } from "../../sessions.js";
import { registerCommand } from "../register_commands.js";
import { assertPermission } from "@modules/assert.js";
import { Mask } from "@modules/mask.js";
import { RawText } from "@notbeer-api";
import { Cardinal } from "@modules/directions.js";

const registerInformation = {
    name: "tool",
    description: "commands.wedit:tool.description",
    usage: [
        {
            subName: "none",
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
                    default: 1,
                },
                {
                    name: "mask",
                    type: "Mask",
                    default: new Mask(),
                },
            ],
        },
        {
            subName: "extruder",
            permission: "worldedit.tool.extruder",
            description: "commands.wedit:tool.description.extruder",
            args: [
                {
                    name: "range",
                    type: "int",
                    range: [1, null] as [number, null],
                    default: 1,
                },
                {
                    name: "digging",
                    type: "bool",
                    default: false,
                },
            ],
        },
        {
            subName: "selwand",
            permission: "worldedit.setwand",
            description: "commands.wedit:tool.description.selwand",
        },
        {
            subName: "navwand",
            permission: "worldedit.setwand",
            description: "commands.wedit:tool.description.navwand",
        },
        {
            subName: "farwand",
            permission: "worldedit.farwand",
            description: "commands.wedit:tool.description.farwand",
        },
        {
            subName: "cmd",
            permission: "worldedit.tool.cmd",
            description: "commands.wedit:tool.description.cmd",
            args: [
                {
                    name: "command",
                    type: "string...",
                },
            ],
        },
        {
            subName: "fill",
            permission: "worldedit.utility.fill",
            description: "commands.wedit:tool.description.fill",
            args: [
                {
                    name: "pattern",
                    type: "Pattern",
                },
                {
                    name: "radius",
                    type: "float",
                },
                {
                    name: "depth",
                    type: "int",
                    range: [1, null] as [number, null],
                    default: -1,
                },
                {
                    name: "direction",
                    type: "Direction",
                    default: new Cardinal(Cardinal.Dir.DOWN),
                },
            ],
        },
        {
            subName: "repl",
            permission: "worldedit.repl",
            description: "commands.wedit:tool.description.repl",
            args: [
                {
                    name: "pattern",
                    type: "Pattern",
                },
            ],
        },
        {
            subName: "cycler",
            permission: "worldedit.cycler",
            description: "commands.wedit:tool.description.cycler",
        },
    ],
};

function heldItemName(player: Player) {
    const name = Server.player.getHeldItem(player).typeId;
    return name.replace("minecraft:", "");
}

const stack_command = (session: PlayerSession, builder: Player, args: Map<string, unknown>) => {
    assertPermission(builder, registerInformation.usage[1].permission);
    session.bindTool("stacker_wand", null, args.get("range"), args.get("mask"));
    return RawText.translate("commands.wedit:tool.bind.stacker").with(heldItemName(builder));
};

const extruder_command = (session: PlayerSession, builder: Player, args: Map<string, unknown>) => {
    assertPermission(builder, registerInformation.usage[1].permission);
    session.bindTool("extruder_wand", null, args.get("range"), args.get("digging"));
    return RawText.translate("commands.wedit:tool.bind.extruder").with(heldItemName(builder));
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
    session.bindTool("command_wand", null, (args.get("command") as string[]).join(" "));
    return RawText.translate("commands.wedit:tool.bind.cmd").with(heldItemName(builder));
};

const fill_command = (session: PlayerSession, builder: Player, args: Map<string, unknown>) => {
    assertPermission(builder, registerInformation.usage[6].permission);
    session.bindTool("fill_wand", null, args.get("pattern"), args.get("radius"), args.get("depth"), args.get("direction"));
    return RawText.translate("commands.wedit:tool.bind.fill").with(heldItemName(builder));
};

const repl_command = (session: PlayerSession, builder: Player, args: Map<string, unknown>) => {
    assertPermission(builder, registerInformation.usage[7].permission);
    session.bindTool("replacer_wand", null, args.get("pattern"));
    return RawText.translate("commands.wedit:tool.bind.repl").with(heldItemName(builder));
};

const cycler_command = (session: PlayerSession, builder: Player) => {
    assertPermission(builder, registerInformation.usage[8].permission);
    session.bindTool("cycler_wand", null);
    return RawText.translate("commands.wedit:tool.bind.cycler").with(heldItemName(builder));
};

registerCommand(registerInformation, function (session, builder, args) {
    let msg: RawText;
    if (args.has("stacker")) {
        msg = stack_command(session, builder, args);
    } else if (args.has("extruder")) {
        msg = extruder_command(session, builder, args);
    } else if (args.has("selwand")) {
        msg = selwand_command(session, builder);
    } else if (args.has("navwand")) {
        msg = navwand_command(session, builder);
    } else if (args.has("farwand")) {
        msg = farwand_command(session, builder);
    } else if (args.has("cmd")) {
        msg = cmd_command(session, builder, args);
    } else if (args.has("fill")) {
        msg = fill_command(session, builder, args);
    } else if (args.has("repl")) {
        msg = repl_command(session, builder, args);
    } else if (args.has("cycler")) {
        msg = cycler_command(session, builder);
    } else {
        session.unbindTool(null);
        return "commands.wedit:tool.unbind";
    }
    return msg.append("text", "\n").append("translate", "commands.generic.wedit:unbindInfo").with(";tool none");
});
