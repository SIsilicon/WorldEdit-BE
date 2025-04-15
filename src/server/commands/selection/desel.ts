import { selectionModes } from "@modules/selection.js";
import { registerCommand } from "../register_commands.js";
import { CommandInfo } from "@notbeer-api";

const registerInformation: CommandInfo = {
    name: "sel",
    description: "commands.wedit:sel.description",
    aliases: ["deselect", "desel"],
    usage: [
        { name: "mode", type: "enum", values: ["cuboid", "extend", "sphere", "cyl"], default: "" },
        { name: "makeDefault", type: "bool", default: false },
    ],
};

registerCommand(registerInformation, function (session, builder, args) {
    try {
        const mode = args.get("mode") as string;
        if (mode === "cuboid") {
            session.selection.mode = "cuboid";
            return "commands.wedit:sel.cuboid";
        } else if (mode === "extend") {
            session.selection.mode = "extend";
            return "commands.wedit:sel.extend";
        } else if (mode === "sphere") {
            session.selection.mode = "sphere";
            return "commands.wedit:sel.sphere";
        } else if (mode === "cyl") {
            session.selection.mode = "cylinder";
            return "commands.wedit:sel.cyl";
        } else {
            session.selection.clear();
            return "commands.wedit:sel.clear";
        }
    } finally {
        if (args.get("makeDefault")) {
            for (const mode of selectionModes) builder.removeTag(`wedit:defaultTag_${mode}`);
            builder.addTag(`wedit:defaultTag_${session.selection.mode}`);
        }
    }
});
