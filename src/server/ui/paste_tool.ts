import { Server } from "@notbeer-api";

Server.uiForms.register("$clipboardOptions", {
    title: "worldedit.clipboard.options",
    buttons: [
        {
            text: "item.wedit:flip_button",
            action: (_, player) => Server.command.callCommand(player, "flip"),
            icon: "textures/items/flip",
        },
        {
            text: "item.wedit:rotate_cw_button",
            action: (_, player) => Server.command.callCommand(player, "rotate", ["90"]),
            icon: "textures/items/rotate_cw",
        },
        {
            text: "item.wedit:rotate_ccw_button",
            action: (_, player) => Server.command.callCommand(player, "rotate", ["-90"]),
            icon: "textures/items/rotate_ccw",
        },
    ],
});
