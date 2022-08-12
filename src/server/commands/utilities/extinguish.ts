import { Mask } from "@modules/mask.js";
import { RawText } from "@notbeer-api";
import { getCommandFunc, registerCommand } from "../register_commands.js";

const registerInformation = {
  name: "extinguish",
  permission: "worldedit.utility.extinguish",
  description: "commands.wedit:extinguish.description",
  usage: [
    {
      name: "radius",
      type: "int"
    }
  ],
  aliases: ["ext", "ex"]
};

registerCommand(registerInformation, function* (session, builder, args) {
  const removeNearArgs = new Map([
    ["mask", new Mask("fire")],
    ["size", args.get("radius")]
  ]);
  return yield* getCommandFunc("removenear")(session, builder, removeNearArgs) as Generator<unknown, RawText | string>;
});
