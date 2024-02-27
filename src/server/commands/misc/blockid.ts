import { Server } from "@notbeer-api";
import { registerCommand } from "../register_commands.js";

const registerInformation = {
    name: "blockid",
    aliases: ["id"],
    permission: "worldedit.blockid",
    description: "commands.wedit:blockid.description",
    usage: [
        {
            flag: "d",
        },
    ],
};

registerCommand(registerInformation, function (session, builder, args) {
    const block = builder.getBlockFromViewDirection({ includePassableBlocks: true })?.block;
    if (block) {
        let id = block.typeId;
        if (id.startsWith("minecraft:")) id = id.slice("minecraft:".length);
        if (args.has("d")) return `${id}:${Server.block.statesToDataValue(block.permutation.getAllStates())}`;
        const states = Object.entries(block.permutation.getAllStates());
        if (states.length) id += `[${states.map(([key, value]) => `${key}=${value}`).join(",")}]`;
        return id;
    } else {
        return "commands.wedit:blockid.noBlock";
    }
});
