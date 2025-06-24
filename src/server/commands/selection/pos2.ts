import { printLocation } from "../../util.js";
import { registerCommand } from "../register_commands.js";
import { RawText, CommandPosition, Vector, CommandInfo } from "@notbeer-api";
import { Vector3 } from "@minecraft/server";
import { PlayerSession } from "server/sessions.js";

const registerInformation: CommandInfo = {
    name: "pos2",
    permission: "worldedit.selection.pos",
    description: "commands.wedit:pos2.description",
    usage: [{ name: "coordinates", type: "xyz", default: new CommandPosition() }],
    aliases: ["2"],
};

export function setPos2(session: PlayerSession, loc: Vector3) {
    if (session.loft) {
        session.loft.addPoint(loc);
        return "";
    }

    const selection = session.selection;
    const prevPoints = selection.points;
    selection.set(1, Vector.from(loc));

    if (selection.points.some((loc, idx) => !loc || !prevPoints[idx] || !loc.equals(prevPoints[idx]))) {
        const blockCount = selection.getBlockCount();
        const translate = !blockCount && selection.isCuboid ? `worldedit.selection.${selection.mode}.secondary` : `worldedit.selection.${selection.mode}.secondaryArea`;
        let sub = [printLocation(selection.points[1])];
        if (selection.mode == "sphere") {
            sub = [`${Math.round(Vector.sub(selection.points[1], selection.points[0]).length)}`];
        } else if (selection.mode == "cylinder") {
            const vec = Vector.sub(selection.points[1], selection.points[0]);
            sub = [`${Math.round(vec.mul([1, 0, 1]).length)}`, `${Math.abs(vec.y) + 1}`];
        }

        let result = RawText.translate(translate);
        for (const s of sub) result = result.with(s);
        return result.with(`${blockCount}`);
    }
    return "";
}

registerCommand(registerInformation, function (session, builder, args) {
    return setPos2(session, args.get("coordinates").relativeTo(builder, true));
});
