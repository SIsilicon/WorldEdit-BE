import { Jobs } from "@modules/jobs.js";
import { CommandInfo, CommandPosition, RawText, Vector } from "@notbeer-api";
import { LoftShape } from "../../shapes/loft.js";
import { printLocation } from "../../util.js";
import { registerCommand } from "../register_commands.js";
import { getWorldHeightLimits } from "../../util.js";

const coordinateArgs = [
    {
        name: "coordinates",
        type: "xyz",
        default: new CommandPosition(),
    },
];

const setArgs = [
    { flag: "p" },
    { flag: "o" },
    { flag: "c" },
    { flag: "d" },
    { name: "pattern", type: "Pattern" },
    {
        name: "count",
        type: "int",
        default: 0,
        range: [0, null],
    },
];

const registerInformation: CommandInfo = {
    name: "loft",
    permission: "worldedit.generation.shape",
    description: "commands.wedit:loft.description",
    usage: [
        {
            subName: "frame",
            description: "commands.wedit:loft.description.frame",
            args: coordinateArgs,
        },
        {
            subName: "f",
            args: coordinateArgs,
        },
        {
            subName: "point",
            description: "commands.wedit:loft.description.point",
            args: coordinateArgs,
        },
        {
            subName: "p",
            args: coordinateArgs,
        },
        {
            subName: "set",
            description: "commands.wedit:loft.description.set",
            args: setArgs,
        },
        {
            subName: "s",
            args: setArgs,
        },
        {
            subName: "remove",
            description: "commands.wedit:loft.description.remove",
            args: [{ flag: "c" }],
        },
        {
            subName: "r",
        },
        {
            subName: "clear",
            description: "commands.wedit:loft.description.clear",
        },
        {
            subName: "c",
        },
    ],
};

registerCommand(registerInformation, function* (session, builder, args) {
    const coordinates = args.has("coordinates") ? Vector.from((args.get("coordinates") as CommandPosition).relativeTo(builder)).floor() : undefined;

    if (args.has("frame") || args.has("f")) {
        if (!session.loft) {
            session.loft = new LoftShape([[coordinates!]]);
        } else {
            session.loft.newCurve(coordinates!);
        }

        return RawText.translate("commands.wedit:loft.frame").with(printLocation(coordinates));
    }

    if (args.has("remove") || args.has("r")) {
        if (!session.loft) {
            throw "commands.wedit:loft.notStarted";
        }

        const hasPoints = args.has("c") ? session.loft.removeClosestPoint(builder.location) : session.loft.removeLastPoint();

        if (!hasPoints) {
            session.loft = undefined;
        }

        return session.loft ? "commands.wedit:loft.removed" : "commands.wedit:loft.removed.last";
    }

    if (args.has("set") || args.has("s")) {
        if (!session.loft) {
            throw "commands.wedit:loft.notStarted";
        }

        if (args.get("_using_item") && session.globalPattern.empty()) {
            throw RawText.translate("worldEdit.selectionFill.noPattern");
        }

        const pattern = args.get("_using_item") ? session.globalPattern : args.get("pattern");

        const countArg: number = args.get("count");

        const [minY] = getWorldHeightLimits(builder.dimension);

        session.loft.setGenerationOptions({
            lowPoly: args.has("p"),
            outlineOnly: args.has("o"),
            close: args.has("c"),
            drop: args.has("d"),

            count: countArg > 0 ? countArg : undefined,

            dropMinY: minY,
        });

        try {
            const count = yield* Jobs.run(session, 2, session.loft.generate(Vector.ZERO, pattern, undefined, session));

            return RawText.translate("commands.wedit:blocks.created").with(`${count}`);
        } finally {
            session.loft.resetGenerationOptions();
        }
    }

    if (args.has("point") || args.has("p")) {
        if (!session.loft) {
            session.loft = new LoftShape([[coordinates!]]);
        } else {
            session.loft.addPoint(coordinates!);
        }

        return RawText.translate("commands.wedit:loft.point").with(printLocation(coordinates));
    }

    if (args.has("clear") || args.has("c")) {
        session.loft = undefined;
        return "commands.wedit:loft.cleared";
    }

    return "";
});
