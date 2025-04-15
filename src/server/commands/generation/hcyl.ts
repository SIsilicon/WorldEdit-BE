import { CommandInfo, RawText } from "@notbeer-api";
import { getCommandFunc, registerCommand } from "../register_commands.js";
import { commandArgList } from "library/@types/classes/CommandBuilder.js";
import { Cardinal } from "@modules/directions.js";

const suffixArguments: commandArgList = [
    { name: "raised", type: "bool", default: false },
    { name: "direction", type: "Direction", default: new Cardinal(Cardinal.Dir.UP) },
];

const registerInformation: CommandInfo = {
    name: "hcyl",
    permission: "worldedit.generation.hcylinder",
    description: "commands.wedit:hcyl.description",
    usage: [
        { name: "pattern", type: "Pattern" },
        {
            subName: "_",
            args: [{ name: "radii", type: "float", range: [0.01, null] }, { name: "height", type: "int", default: 1, range: [1, null] }, ...suffixArguments],
        },
        {
            subName: "_xz",
            args: [
                { name: "radiiX", type: "float", range: [0.01, null] },
                { name: "radiiZ", type: "float", range: [0.01, null] },
                { name: "height", type: "int", default: 1, range: [1, null] },
                ...suffixArguments,
            ],
        },
    ],
};

registerCommand(registerInformation, function* (session, builder, args) {
    args.set("hollow", true);
    return yield* getCommandFunc("cyl")(session, builder, args) as Generator<unknown, RawText | string>;
});
