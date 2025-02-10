import { RawText } from "@notbeer-api";
import { getCommandFunc, registerCommand } from "../register_commands.js";

const registerInformation = {
    name: "hcyl",
    permission: "worldedit.generation.cylinder",
    description: "commands.wedit:hcyl.description",
    usage: [
        {
            flag: "r",
        },
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
            subName: "_x",
            args: [
                {
                    name: "radii",
                    type: "float",
                    range: [0.01, null] as [number, null],
                },
                {
                    name: "height",
                    type: "int",
                    default: 1,
                    range: [1, null] as [number, null],
                },
            ],
        },
        {
            subName: "_xz",
            args: [
                {
                    name: "radiiX",
                    type: "float",
                    range: [0.01, null] as [number, null],
                },
                {
                    name: "radiiZ",
                    type: "float",
                    range: [0.01, null] as [number, null],
                },
                {
                    name: "height",
                    type: "int",
                    default: 1,
                    range: [1, null] as [number, null],
                },
            ],
        },
    ],
};

registerCommand(registerInformation, function* (session, builder, args) {
    args.set("h", true);
    return yield* getCommandFunc("cyl")(session, builder, args) as Generator<unknown, RawText | string>;
});
