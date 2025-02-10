import { RawText } from "@notbeer-api";
import { getCommandFunc, registerCommand } from "../register_commands.js";

const registerInformation = {
    name: "htorus",
    permission: "worldedit.generation.torus",
    description: "commands.wedit:htorus.description",
    usage: [
        {
            flag: "d",
            name: "direction",
            type: "Direction",
        },
        {
            name: "pattern",
            type: "Pattern",
        },
        {
            name: "outerRadius",
            type: "float",
            range: [0.01, null] as [number, null],
        },
        {
            name: "innerRadius",
            type: "float",
            range: [0.01, null] as [number, null],
        },
    ],
};

registerCommand(registerInformation, function* (session, builder, args) {
    args.set("h", true);
    return yield* getCommandFunc("torus")(session, builder, args) as Generator<unknown, RawText | string>;
});
