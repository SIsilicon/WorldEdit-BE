import { assertSelection } from "@modules/assert.js";
import { Cardinal, CardinalDirection } from "@modules/directions.js";
import { CommandInfo, Vector } from "@notbeer-api";
import { registerCommand } from "../register_commands.js";

const registerInformation: CommandInfo = {
    name: "shift",
    description: "commands.wedit:shift.description",
    permission: "worldedit.selection.shift",
    usage: [
        { name: "amount", type: "int" },
        { name: "direction", type: "Direction", default: new Cardinal(CardinalDirection.Forward) },
    ],
};

registerCommand(registerInformation, function (session, builder, args) {
    assertSelection(session);
    const points = session.selection.points.map((block) => Vector.from(block));
    const dir = (args.get("direction") as Cardinal).getDirection(builder).mul(args.get("amount"));

    session.selection.clear();
    points.forEach((point, idx) => session.selection.set(idx ? 1 : 0, point.add(dir).floor()));

    return "commands.wedit:shift.explain";
});
