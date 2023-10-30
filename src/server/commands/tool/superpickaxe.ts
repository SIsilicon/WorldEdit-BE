import { registerCommand } from "../register_commands.js";

const registerInformation = {
  name: "superpickaxe",
  permission: "worldedit.superpickaxe",
  description: "commands.wedit:superpickaxe.description",
  aliases : ["sp"],
  usage: [
    {
      subName: "single",
    },
    {
      subName: "area",
      args: [
        {
          name: "range",
          type: "int",
          range: [0, 5] as [number, number]
        }
      ]
    },
    {
      subName: "recursive",
      args: [
        {
          name: "range",
          type: "int",
          range: [0, 5] as [number, number]
        }
      ]
    },
    {
      subName: "_default"
    }
  ]
};

registerCommand(registerInformation, function (session, builder, args) {
  if (args.has("single")) {
    session.superPickaxe.mode = "single";
  } else if (args.has("area")) {
    session.superPickaxe.mode = "area";
    session.superPickaxe.range = args.get("range");
  } else if (args.has("recursive")) {
    session.superPickaxe.mode = "recursive";
    session.superPickaxe.range = args.get("range");
  } else {
    const enabled = (session.superPickaxe.enabled = !session.superPickaxe.enabled);
    return "commands.wedit:superpickaxe." + (enabled ? "enabled" : "disabled");
  }
  session.superPickaxe.enabled = true;
  return "commands.wedit:superpickaxe." + session.superPickaxe.mode;
});
