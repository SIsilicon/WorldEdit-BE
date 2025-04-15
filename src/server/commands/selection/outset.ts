import { assertCuboidSelection } from "@modules/assert.js";
import { Vector } from "@notbeer-api";
import { registerCommand } from "../register_commands.js";

const registerInformation = {
    name: "outset",
    description: "commands.wedit:outset.description",
    permission: "worldedit.selection.outset",
    usage: [
        {
            name: "amount",
            type: "int",
        },
        {
            name: "horizontal",
            type: "bool",
            default: false,
        },
        {
            name: "vertical",
            type: "bool",
            default: false,
        },
    ],
};

registerCommand(registerInformation, function (session, builder, args) {
    assertCuboidSelection(session);
    const points = session.selection.points.map((block) => Vector.from(block));
    const dir = points[1].sub(points[0]);
    dir.x = Math.sign(dir.x) * (args.has("vertical") ? 0 : 1);
    dir.y = Math.sign(dir.y) * (args.has("horizontal") ? 0 : 1);
    dir.z = Math.sign(dir.z) * (args.has("vertical") ? 0 : 1);

    points[0] = points[0].sub(dir.mul(args.get("amount")));
    points[1] = points[1].add(dir.mul(args.get("amount")));

    session.selection.clear();
    session.selection.set(0, points[0].floor());
    session.selection.set(1, points[1].floor());

    return "commands.wedit:outset.explain";
});
