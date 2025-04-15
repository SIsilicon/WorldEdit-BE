import { EquipmentSlot, ItemStack } from "@minecraft/server";
import { Server } from "@notbeer-api";

Server.uiForms.register("$selectRegionMode", {
    title: "%worldedit.regionMode.selectOp",
    buttons: [
        {
            text: "%worldedit.regionMode.fill",
            action: (_, player) => {
                Server.player.getEquipment(player).setEquipment(EquipmentSlot.Mainhand, new ItemStack("wedit:selection_fill"));
            },
            icon: "textures/items/selection_fill",
        },
        {
            text: "%worldedit.regionMode.outline",
            action: (_, player) => {
                Server.player.getEquipment(player).setEquipment(EquipmentSlot.Mainhand, new ItemStack("wedit:selection_outline"));
            },
            icon: "textures/items/selection_outline",
        },
        {
            text: "%worldedit.regionMode.wall",
            action: (_, player) => {
                Server.player.getEquipment(player).setEquipment(EquipmentSlot.Mainhand, new ItemStack("wedit:selection_wall"));
            },
            icon: "textures/items/selection_wall",
        },
        {
            text: "%worldedit.regionMode.stack",
            action: (_, player) => {
                Server.player.getEquipment(player).setEquipment(EquipmentSlot.Mainhand, new ItemStack("wedit:selection_stack"));
            },
            icon: "textures/items/selection_stack",
        },
        {
            text: "%worldedit.regionMode.move",
            action: (_, player) => {
                Server.player.getEquipment(player).setEquipment(EquipmentSlot.Mainhand, new ItemStack("wedit:selection_move"));
            },
            icon: "textures/items/selection_move",
        },
        {
            text: "%worldedit.regionMode.hollow",
            action: (_, player) => {
                Server.player.getEquipment(player).setEquipment(EquipmentSlot.Mainhand, new ItemStack("wedit:selection_hollow"));
            },
            icon: "textures/items/selection_hollow",
        },
    ],
});

Server.uiForms.register("$stackAmount", {
    title: "%worldedit.stack.title",
    inputs: {
        $amount: {
            name: "%worldedit.config.amount",
            type: "slider",
            min: 1,
            max: 64,
            default: (_, player) => <number>player.getDynamicProperty("toolLastStackAmount") ?? 2,
        },
    },
    submit: (_, player, input) => {
        player.setDynamicProperty("toolLastStackAmount", input.$amount);
        Server.command.callCommand(player, "stack", [input.$amount.toString(), "-s"]); // FIXME
    },
});

Server.uiForms.register("$moveAmount", {
    title: "%worldedit.move.title",
    inputs: {
        $amount: {
            name: "%worldedit.config.amount",
            type: "slider",
            min: 1,
            max: 64,
            default: (_, player) => <number>player.getDynamicProperty("toolLastMoveAmount") ?? 2,
        },
    },
    submit: (_, player, input) => {
        player.setDynamicProperty("toolLastMoveAmount", input.$amount);
        Server.command.callCommand(player, "move", [input.$amount.toString(), "-s"]); // FIXME
    },
});
