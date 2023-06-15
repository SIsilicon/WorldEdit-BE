import { Player } from "@minecraft/server";
import { PlayerSession } from "../../sessions.js";
import { SphereBrush } from "../../brushes/sphere_brush.js";
import { CylinderBrush } from "../../brushes/cylinder_brush.js";
import { SmoothBrush } from "../../brushes/smooth_brush.js";
import { assertClipboard, assertPermission } from "@modules/assert.js";
import { Mask } from "@modules/mask.js";
import { Pattern } from "@modules/pattern.js";
import { RawText } from "@notbeer-api";
import { registerCommand } from "../register_commands.js";
import { StructureBrush } from "server/brushes/structure_brush.js";
import { ErosionBrush, ErosionType } from "server/brushes/erosion_brush.js";
import { OverlayBrush } from "server/brushes/overlay_brush.js";

const registerInformation = {
  name: "brush",
  description: "commands.wedit:brush.description",
  aliases: ["br"],
  usage: [
    {
      subName: "none"
    },
    {
      subName: "sphere",
      permission: "worldedit.brush.sphere",
      description: "commands.wedit:brush.description.sphere",
      args: [
        {
          flag: "h"
        },
        {
          name: "pattern",
          type: "Pattern"
        },
        {
          name: "radius",
          type: "float",
          default: 3
        }
      ]
    },
    {
      subName: "cyl",
      permission: "worldedit.brush.cylinder",
      description: "commands.wedit:brush.description.cylinder",
      args: [
        {
          flag: "h"
        },
        {
          name: "pattern",
          type: "Pattern"
        },
        {
          name: "radius",
          type: "float",
          default: 3
        },
        {
          name: "height",
          type: "int",
          default: 3
        }
      ]
    },
    {
      subName: "smooth",
      permission: "worldedit.brush.smooth",
      description: "commands.wedit:brush.description.smooth",
      args: [
        {
          name: "radius",
          type: "float",
          default: 2
        },
        {
          name: "iterations",
          type: "int",
          default: 4
        },
        {
          name: "mask",
          type: "Mask",
          default: new Mask()
        }
      ]
    },
    {
      subName: "struct",
      permission: "worldedit.brush.struct",
      description: "commands.wedit:brush.description.struct",
      args: [
        {
          subName: "clipboard",
          args: [
            {
              name: "mask",
              type: "Mask",
              default: new Mask()
            }
          ]
        },
        {
          subName: "_default",
          args: [
            {
              name: "structureName",
              type: "string..."
            }
          ]
        }
      ]
    },
    {
      subName: "erode",
      permission: "worldedit.brush.erode",
      description: "commands.wedit:brush.description.erode",
      args: [
        {
          subName: "_",
          args: [{ name: "radius", type: "float", default: 3 }]
        },
        {
          subName: "lift",
          args: [{ name: "radius", type: "float", default: 3 }]
        },
        {
          subName: "fill",
          args: [{ name: "radius", type: "float", default: 3 }]
        },
        {
          subName: "melt",
          args: [{ name: "radius", type: "float", default: 3 }]
        },
        {
          subName: "smooth",
          args: [{ name: "radius", type: "float", default: 3 }]
        }
      ]
    },
    {
      subName: "overlay",
      permission: "worldedit.brush.overlay",
      description: "commands.wedit:brush.description.overlay",
      args: [
        {
          name: "pattern",
          type: "Pattern"
        },
        {
          name: "radius",
          type: "float",
          default: 3
        },
        {
          name: "depth",
          type: "int",
          default: 1
        },
        {
          name: "mask",
          type: "Mask",
          default: new Mask()
        }
      ]
    }
  ]
};

export function createDefaultBrush() {
  return new SphereBrush(1, new Pattern("cobblestone"), false);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sphere_command = (session: PlayerSession, builder: Player, args: Map<string, any>) => {
  assertPermission(builder, registerInformation.usage[1].permission);
  session.bindTool("brush", null, new SphereBrush(
    args.get("radius"),
    args.get("pattern"),
    args.has("h")
  ));
  return RawText.translate("commands.wedit:brush.bind.sphere").with(args.get("radius"));
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const cylinder_command = (session: PlayerSession, builder: Player, args: Map<string, any>) => {
  assertPermission(builder, registerInformation.usage[2].permission);
  session.bindTool("brush", null, new CylinderBrush(
    args.get("radius"),
    args.get("height"),
    args.get("pattern"),
    args.has("h")
  ));
  return RawText.translate("commands.wedit:brush.bind.cylinder").with(args.get("radius")).with(args.get("height"));
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const smooth_command = (session: PlayerSession, builder: Player, args: Map<string, any>) => {
  assertPermission(builder, registerInformation.usage[3].permission);
  session.bindTool("brush", null, new SmoothBrush(
    args.get("radius"),
    args.get("iterations"),
    args.get("mask")
  ));

  const msg = "commands.wedit:brush.bind.smooth." + ((args.get("mask") as Mask).empty() ? "noFilter" : "filter");
  return RawText.translate(msg).with(args.get("radius")).with(args.get("iterations"));
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const struct_command = (session: PlayerSession, builder: Player, args: Map<string, any>) => {
  assertPermission(builder, registerInformation.usage[4].permission);
  const clipboard = args.has("clipboard");
  if (clipboard) {
    assertClipboard(session);
  }

  session.bindTool("brush", null, new StructureBrush(clipboard ? session.clipboard : args.get("structureName") as string[], args.get("mask")));
  const msg = "commands.wedit:brush.bind." + (clipboard ? "clipboard" : "struct");
  return RawText.translate(msg).with(args.get("structureName"));
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const erode_command = (session: PlayerSession, builder: Player, args: Map<string, any>) => {
  assertPermission(builder, registerInformation.usage[5].permission);

  let type = ErosionType.DEFAULT;
  if (args.has("lift")) type = ErosionType.LIFT;
  else if (args.has("fill")) type = ErosionType.FILL;
  else if (args.has("melt")) type = ErosionType.MELT;
  else if (args.has("smooth")) type = ErosionType.SMOOTH;

  session.bindTool("brush", null, new ErosionBrush(args.get("radius"), type));
  session.setToolProperty(null, "traceMask", new Mask("!water,air,lava"));
  return RawText.translate("commands.wedit:brush.bind.erode").with(args.get("radius"));
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const overlay_command = (session: PlayerSession, builder: Player, args: Map<string, any>) => {
  assertPermission(builder, registerInformation.usage[1].permission);
  session.bindTool("brush", null, new OverlayBrush(
    args.get("radius"),
    args.get("depth"),
    args.get("pattern"),
    args.get("mask"),
  ));
  session.setToolProperty(null, "traceMask", new Mask("!water,air,lava"));
  return RawText.translate("commands.wedit:brush.bind.overlay").with(args.get("radius"));
};

registerCommand(registerInformation, function (session, builder, args) {
  let msg: RawText;
  if (args.has("erode")) {
    msg = erode_command(session, builder, args);
  } else if (args.has("sphere")) {
    msg = sphere_command(session, builder, args);
  } else if (args.has("cyl")) {
    msg = cylinder_command(session, builder, args);
  } else if (args.has("smooth")) {
    msg = smooth_command(session, builder, args);
  } else if (args.has("struct")) {
    msg = struct_command(session, builder, args);
  } else if (args.has("overlay")) {
    msg = overlay_command(session, builder, args);
  } else {
    session.unbindTool(null);
    return "commands.wedit:brush.unbind";
  }
  return msg.append("text", "\n").append("translate", "commands.generic.wedit:unbindInfo").with(";brush none");
});
