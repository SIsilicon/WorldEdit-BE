import { Jobs } from "@modules/jobs.js";
import { Pattern } from "@modules/pattern.js";
import { RawText } from "@notbeer-api";
import { SphereShape } from "../../shapes/sphere.js";
import { registerCommand } from "../register_commands.js";
import { Cardinal } from "@modules/directions.js";
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
    name: "sphere",
    permission: "worldedit.generation.sphere",
    description: "commands.wedit:sphere.description",
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
    const pattern: Pattern = args.get("pattern");
    let radii: [number, number, number];
    const isHollow = args.get("hollow");
    const isRaised = args.get("raised");

    if (args.has("_x")) radii = [args.get("radii"), args.get("radii"), args.get("radii")];
    else if (args.has("_xy")) radii = [args.get("radiiXZ"), args.get("radiiY"), args.get("radiiXZ")];
    else radii = [args.get("radiiX"), args.get("radiiY"), args.get("radiiZ")];

    const loc = session.getPlacementPosition().offset(0, isRaised ? radii[1] : 0, 0);

    const sphereShape = new SphereShape(...radii, (<Cardinal>args.get("dome"))?.getDirection(builder));
    const count = yield* Jobs.run(session, 2, sphereShape.generate(loc, pattern, null, session, { hollow: isHollow }));
    return RawText.translate("commands.blocks.wedit:created").with(`${count}`);
});
