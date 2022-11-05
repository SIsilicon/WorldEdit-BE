import { selectionModes } from "@modules/selection.js";
import { registerCommand } from "../register_commands.js";

const registerInformation = {
  name: "sel",
  description: "commands.wedit:sel.description",
  aliases: ["deselect", "desel"],
  usage: [
    {
      flag: "d"
    },
    {
      subName: "cuboid"
    },
    {
      subName: "extend"
    },
    {
      subName: "sphere"
    },
    {
      subName: "_nothing"
    }
  ]
};

registerCommand(registerInformation, function (session, builder, args) {
  try {
    if (args.has("cuboid")) {
      session.selection.mode = "cuboid";
      return "commands.wedit:sel.cuboid";
    } else if (args.has("extend")) {
      session.selection.mode = "extend";
      return "commands.wedit:sel.extend";
    } else if (args.has("sphere")) {
      session.selection.mode = "sphere";
      return "commands.wedit:sel.sphere";
    } else {
      session.selection.clear();
      return "commands.wedit:sel.clear";
    }
  } finally {
    if (args.has("d")) {
      for (const mode of selectionModes) {
        builder.removeTag(`wedit:defaultTag_${mode}`);
      }
      builder.addTag(`wedit:defaultTag_${session.selection.mode}`);
    }
  }
});
