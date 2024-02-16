import { EquipmentSlot, ItemStack } from "@minecraft/server";
import { Server } from "@notbeer-api";

Server.uiForms.register("$selectGenMode", {
    title: "%worldedit.genMode.selectOp",
    buttons: [
        {
            text: "%worldedit.genMode.line",
            action: (_, player) => {
                Server.player.getEquipment(player).setEquipment(EquipmentSlot.Mainhand, new ItemStack("wedit:draw_line"));
            },
            icon: "textures/items/draw_line"
        },
        {
            text: "%worldedit.genMode.sphere",
            action: (_, player) => {
                Server.player.getEquipment(player).setEquipment(EquipmentSlot.Mainhand, new ItemStack("wedit:draw_sphere"));
            },
            icon: "textures/items/draw_sphere"
        },
        {
            text: "%worldedit.genMode.cylinder",
            action: (_, player) => {
                Server.player.getEquipment(player).setEquipment(EquipmentSlot.Mainhand, new ItemStack("wedit:draw_cylinder"));
            },
            icon: "textures/items/draw_cylinder"
        },
        {
            text: "%worldedit.genMode.pyramid",
            action: (_, player) => {
                Server.player.getEquipment(player).setEquipment(EquipmentSlot.Mainhand, new ItemStack("wedit:draw_pyramid"));
            },
            icon: "textures/items/draw_pyramid"
        }
    ]
});