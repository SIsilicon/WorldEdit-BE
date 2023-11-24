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
      icon: "textures/items/selection_fill"
    },
    {
      text: "%worldedit.regionMode.outline",
      action: (_, player) => {
        Server.player.getEquipment(player).setEquipment(EquipmentSlot.Mainhand, new ItemStack("wedit:selection_outline"));
      },
      icon: "textures/items/selection_outline"
    },
    {
      text: "%worldedit.regionMode.wall",
      action: (_, player) => {
        Server.player.getEquipment(player).setEquipment(EquipmentSlot.Mainhand, new ItemStack("wedit:selection_wall"));
      },
      icon: "textures/items/selection_wall"
    },
    {
      text: "%worldedit.regionMode.hollow",
      action: (_, player) => {
        Server.player.getEquipment(player).setEquipment(EquipmentSlot.Mainhand, new ItemStack("wedit:selection_hollow"));
      },
      icon: "textures/items/selection_hollow"
    },
  ]
});