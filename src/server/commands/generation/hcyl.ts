import { RawText } from "@notbeer-api";
import { getCommandFunc, registerCommand } from "../register_commands.js";
import { commandArgList } from "library/@types/classes/CommandBuilder.js";

const suffixArguments: commandArgList = [
    {
        name: "raised",
        type: "bool",
        default: false,
    },
    {
        name: "direction",
        type: "Direction",
        default: null,
    },
];

const registerInformation = {
    name: "hcyl",
    permission: "worldedit.generation.hcylinder",
    description: "commands.wedit:hcyl.description",
    usage: [
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
                ...suffixArguments,
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
                ...suffixArguments,
            ],
        },
    ],
};

registerCommand(registerInformation, function* (session, builder, args) {
    args.set("hollow", true);
    return yield* getCommandFunc("cyl")(session, builder, args) as Generator<unknown, RawText | string>;
});
