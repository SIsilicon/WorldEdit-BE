import { CommandInfo, RawText } from "@notbeer-api";
import { getCommandFunc, registerCommand } from "../register_commands.js";
import { Cardinal } from "@modules/directions.js";

const registerInformation: CommandInfo = {
    name: "htorus",
    permission: "worldedit.generation.torus",
    description: "commands.wedit:htorus.description",
    usage: [
        { name: "pattern", type: "Pattern" },
        { name: "outerRadius", type: "float", range: [0.01, null] },
        { name: "innerRadius", type: "float", range: [0.01, null] },
        { name: "direction", type: "Direction", default: new Cardinal(Cardinal.Dir.UP) },
    ],
};

registerCommand(registerInformation, function* (session, builder, args) {
    args.set("hollow", true);
    return yield* getCommandFunc("torus")(session, builder, args) as Generator<unknown, RawText | string>;
});
