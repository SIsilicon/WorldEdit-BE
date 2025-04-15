import { assertClipboard } from "@modules/assert";
import { Jobs } from "@modules/jobs.js";
import { RawText, Vector } from "@notbeer-api";
import { registerCommand } from "../register_commands.js";
import { RegionLoadOptions } from "@modules/region_buffer.js";
import { CommandInfo } from "@notbeer-api";
import { Mask } from "@modules/mask.js";

const registerInformation: CommandInfo = {
    name: "paste",
    permission: "worldedit.clipboard.paste",
    description: "commands.wedit:paste.description",
    usage: [
        { name: "mask", type: "Mask", default: new Mask() },
        { name: "originalLocation", type: "bool", default: false },
        { name: "pasteContent", type: "bool", default: true },
    ],
};

registerCommand(registerInformation, function* (session, builder, args) {
    assertClipboard(session);

    const pasteOriginal = args.get("originalLocation");
    const pasteContent = args.get("pasteContent");

    let pasteFrom = Vector.from(builder.location).floor().add(0.5);
    let transform: RegionLoadOptions = session.clipboardTransform;
    if (pasteOriginal) {
        if (session.clipboardTransform.originalDim != builder.dimension.id || !session.clipboardTransform.originalLoc) throw "commands.wedit:paste.noOriginal";
        pasteFrom = session.clipboardTransform.originalLoc;
        transform = {};
    }
    const [pasteStart, pasteEnd] = session.clipboard.getBounds(pasteFrom, transform);

    const history = session.history;
    const record = history.record();
    yield* Jobs.run(session, 1, function* () {
        try {
            if (pasteContent) {
                yield* history.trackRegion(record, pasteStart, pasteEnd);
                yield Jobs.nextStep("Pasting blocks...");
                yield* session.clipboard.load(pasteFrom, builder.dimension, { ...transform, mask: args.get("mask")?.withContext(session) });
            }

            history.trackSelection(record);
            session.selection.mode = session.selection.mode == "extend" ? "extend" : "cuboid";
            session.selection.set(0, pasteStart);
            session.selection.set(1, pasteEnd);

            yield* history.commit(record);
        } catch (e) {
            history.cancel(record);
            throw e;
        }
    });
    if (pasteContent) {
        return RawText.translate("commands.wedit:paste.explain").with(`${session.clipboard.getVolume()}`);
    }
    return "";
});
