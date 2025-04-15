import { RawText } from "@notbeer-api";
import { getCommandFunc, registerCommand } from "../register_commands.js";
import { commandArgList } from "library/@types/classes/CommandBuilder.js";

const suffixArguments: commandArgList = [
    {
        name: "hollow",
        type: "bool",
        default: false,
    },
    {
        name: "raised",
        type: "bool",
        default: false,
    },
    {
        name: "dome",
        type: "Direction",
        default: null,
    },
];

const registerInformation = {
    name: "hsphere",
    permission: "worldedit.generation.hsphere",
    description: "commands.wedit:hsphere.description",
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
                ...suffixArguments,
            ],
        },
        {
            subName: "_xy",
            args: [
                {
                    name: "radiiXZ",
                    type: "float",
                    range: [0.01, null] as [number, null],
                },
                {
                    name: "radiiY",
                    type: "float",
                    range: [0.01, null] as [number, null],
                },
                ...suffixArguments,
            ],
        },
        {
            subName: "_xyz",
            args: [
                {
                    name: "radiiX",
                    type: "float",
                    range: [0.01, null] as [number, null],
                },
                {
                    name: "radiiY",
                    type: "float",
                    range: [0.01, null] as [number, null],
                },
                {
                    name: "radiiZ",
                    type: "float",
                    range: [0.01, null] as [number, null],
                },
                ...suffixArguments,
            ],
        },
    ],
};

registerCommand(registerInformation, function* (session, builder, args) {
    args.set("hollow", true);
    return yield* getCommandFunc("sphere")(session, builder, args) as Generator<unknown, RawText | string>;
});
