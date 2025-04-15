import { Mask } from "@modules/mask.js";
import { Pattern } from "@modules/pattern.js";
import { CommandInfo, RawText } from "@notbeer-api";
import { getCommandFunc, registerCommand } from "../register_commands.js";

const registerInformation: CommandInfo = {
    name: "green",
    permission: "worldedit.utility.green",
    description: "commands.wedit:green.description",
    usage: [
        { name: "radius", type: "int" },
        { name: "strictDirt", type: "bool", default: false },
    ],
};

registerCommand(registerInformation, function* (session, builder, args) {
    const replaceNearArgs = new Map([
        ["size", args.get("radius")],
        ["mask", new Mask(`dirt${args.get("strictDirt") ? "[dirt_type=normal]" : ""} <air`)],
        ["pattern", new Pattern("grass")],
    ]);
    return yield* getCommandFunc("replacenear")(session, builder, replaceNearArgs) as Generator<unknown, RawText | string>;
});
