import { assertSelection } from "@modules/assert.js";
import { JobFunction, Jobs } from "@modules/jobs.js";
import { Mask } from "@modules/mask.js";
import { Pattern } from "@modules/pattern.js";
import { RawText } from "@notbeer-api";
import { PlayerSession } from "../../sessions.js";
import { registerCommand } from "../register_commands.js";

const registerInformation = {
    name: "set",
    permission: "worldedit.region.set",
    description: "commands.wedit:set.description",
    usage: [
        {
            name: "pattern",
            type: "Pattern"
        }
    ]
};

/**
 * Set a region of blocks regardless of the current global mask
 * @return number of blocks set
 */
export function* set(session: PlayerSession, pattern: Pattern, mask?: Mask, recordHistory = false): Generator<JobFunction | Promise<unknown>, number> {
    const [shape, loc] = session.selection.getShape();
    const changed = yield* shape.generate(loc, pattern, mask, session, {recordHistory, ignoreGlobalMask: true});
    return changed;
}

registerCommand(registerInformation, function* (session, builder, args) {
    assertSelection(session);
    if (args.get("_using_item") && session.globalPattern.empty()) {
        throw RawText.translate("worldEdit.selectionFill.noPattern");
    }

    const pattern = args.get("_using_item") ? session.globalPattern : args.get("pattern");

    const count = yield* Jobs.run(session, 2, set(session, pattern, null, true));
    return RawText.translate("commands.blocks.wedit:changed").with(`${count}`);
});
