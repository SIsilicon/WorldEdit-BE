import { printLocation } from "../../util.js";
import { registerCommand } from "../register_commands.js";
import { RawText, CommandPosition, Vector } from "@notbeer-api";
import { Selection } from "@modules/selection.js";
import { Vector3 } from "@minecraft/server";

const registerInformation = {
    name: "pos1",
    permission: "worldedit.selection.pos",
    description: "commands.wedit:pos1.description",
    usage: [
        {
            name: "coordinates",
            type: "xyz",
            default: new CommandPosition(),
        },
    ],
    aliases: ["1"],
};

export function setPos1(selection: Selection, loc: Vector3) {
    const prevPoints = selection.points;
    selection.set(0, Vector.from(loc));

    if (selection.points.some((loc, idx) => !loc || !prevPoints[idx] || !loc.equals(prevPoints[idx]))) {
        let translate: string;
        const blockCount = selection.getBlockCount();
        if (!blockCount || !selection.isCuboid()) {
            translate = `worldedit.selection.${selection.mode}.primary`;
        } else {
            translate = `worldedit.selection.${selection.mode}.primaryArea`;
        }
        let sub = printLocation(selection.points[0]);
        if (selection.mode == "sphere") {
            sub = `${Math.round(Vector.sub(selection.points[1], selection.points[0]).length)}`;
        }

        return RawText.translate(translate).with(sub).with(`${blockCount}`);
    }
    return "";
}

registerCommand(registerInformation, function (session, builder, args) {
    return setPos1(session.selection, args.get("coordinates").relativeTo(builder, true));
});
