import { axis, RawText, regionSize } from "@notbeer-api";
import { registerCommand } from "../register_commands.js";
import { assertCuboidSelection } from "@modules/assert.js";
import { Pattern } from "@modules/pattern.js";

const registerInformation = {
    name: "gradient",
    permission: "worldedit.generation.gradient",
    description: "commands.wedit:gradient.description",
    usage: [
        {
            subName: "create",
            args: [
                {
                    flag: "s",
                },
                {
                    flag: "f",
                    name: "fade",
                    type: "float",
                    range: [0, 1] as [number, number],
                },
                {
                    name: "id",
                    type: "string",
                },
                {
                    name: "patterns",
                    type: "Pattern...",
                    default: [new Pattern("stone")],
                },
            ],
        },
        {
            subName: "delete",
            args: [
                {
                    name: "id",
                    type: "string",
                },
            ],
        },
        {
            subName: "list",
        },
    ],
};

function truncateStringFromMiddle(str: string, length: number) {
    if (str.length <= length) return str;
    const halfLength = Math.floor((length - 3) / 2);
    const start = str.slice(0, halfLength);
    const end = str.slice(str.length - halfLength);
    return start + "..." + end;
}

registerCommand(registerInformation, function (session, builder, args) {
    if (args.has("create")) {
        const patterns = [];
        if (args.has("s")) {
            assertCuboidSelection(session);
            const [min, max] = session.selection.getRange();
            const size = regionSize(min, max);
            const dim = builder.dimension;
            let s: axis, t: axis, u: axis;
            if (size.x > size.y && size.x > size.z) (s = "y"), (t = "z"), (u = "x");
            else if (size.z > size.x && size.z > size.y) (s = "x"), (t = "y"), (u = "z");
            else (s = "x"), (t = "z"), (u = "y");

            for (let i = min[u]; i <= max[u]; i++) {
                const pattern = new Pattern();
                for (let j = min[s]; j <= max[s]; j++) {
                    for (let k = min[t]; k <= max[t]; k++) {
                        pattern.addBlock(dim.getBlock(<any>{ [s]: j, [t]: k, [u]: i }).permutation);
                    }
                }
                patterns.push(pattern);
            }
        } else {
            patterns.push(...args.get("patterns"));
        }

        session.createGradient(args.get("id"), args.get("f-fade") ?? 1.0, patterns);
        return RawText.translate("commands.wedit:gradient.create").with(args.get("id"));
    } else if (args.has("delete")) {
        if (session.getGradientNames().includes(args.get("id"))) {
            session.deleteGradient(args.get("id"));
            return RawText.translate("commands.wedit:gradient.delete").with(args.get("id"));
        } else {
            throw RawText.translate("commands.wedit:gradient.noExist").with(args.get("id"));
        }
    } else if (args.has("list")) {
        const gradients = session.getGradientNames();
        if (gradients.length)
            return gradients
                .map((id) => {
                    const patterns = session.getGradient(id).patterns;
                    const patternStr = patterns.map((p) => `"${p.toJSON()}"`).join(", ");
                    return `- ${id} (${truncateStringFromMiddle(patternStr, 100)})`;
                })
                .join("\n");
        else "commands.wedit:gradient.none";
    }
});
