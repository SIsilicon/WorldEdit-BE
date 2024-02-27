import { assertHistoryNotRecording } from "@modules/assert.js";
import { RawText } from "@notbeer-api";
import { registerCommand } from "../register_commands.js";
import { Jobs } from "@modules/jobs.js";

const registerInformation = {
    name: "redo",
    permission: "worldedit.history.redo",
    description: "commands.wedit:redo.description",
    usage: [
        {
            name: "times",
            type: "int",
            range: [1, null] as [number, null],
            default: 1
        }
    ]
};

registerCommand(registerInformation, function* (session, builder, args) {
    const history = session.getHistory();
    assertHistoryNotRecording(history);
    let i: number;
    yield* Jobs.run(session, 1, function* () {
        const times = args.get("times") as number;
        for(i = 0; i < times; i++) {
            if (yield history.redo(session)) {
                break;
            }
        }
    });
    return RawText.translate(i == 0 ? "commands.wedit:redo.none" : "commands.wedit:redo.explain").with(`${i}`);
});
