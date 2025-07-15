import { assertCuboidSelection } from "@modules/assert.js";
import { CommandInfo, Vector } from "@notbeer-api";
import { registerCommand } from "../register_commands.js";

const registerInformation: CommandInfo = {
    name: "inset",
    description: "commands.wedit:inset.description",
    permission: "worldedit.selection.inset",
    usage: [{ flag: "h" }, { flag: "v" }, { name: "amount", type: "int" }],
};

registerCommand(registerInformation, function (session, builder, args) {
    assertCuboidSelection(session);
    const points = session.selection.points.map((block) => Vector.from(block));
    const dir = points[1].sub(points[0]);
    dir.x = Math.sign(dir.x) * (args.has("v") ? 0 : 1);
    dir.y = Math.sign(dir.y) * (args.has("h") ? 0 : 1);
    dir.z = Math.sign(dir.z) * (args.has("v") ? 0 : 1);

    points[0] = points[0].add(dir.mul(args.get("amount")));
    points[1] = points[1].sub(dir.mul(args.get("amount")));

    session.selection.clear();
    session.selection.set(0, points[0].floor());
    session.selection.set(1, points[1].floor());

    return "commands.wedit:inset.explain";
});
