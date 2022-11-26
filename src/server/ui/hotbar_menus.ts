import { HotbarUI } from "@modules/hotbar_ui.js";
import { Mask } from "@modules/mask.js";
import { Pattern } from "@modules/pattern";
import { Server } from "@notbeer-api";
import { ConfigContext } from "./types";

HotbarUI.register<ConfigContext>("$chooseItem", {
  title: "%worldedit.config.chooseItem",
  items: {
    0: { item: "minecraft:air", action: null }, 1: { item: "minecraft:air", action: null },
    2: { item: "minecraft:air", action: null }, 3: { item: "minecraft:air", action: null },
    4: { item: "minecraft:air", action: null }, 5: { item: "minecraft:air", action: null },
    6: { item: "minecraft:air", action: null }, 7: { item: "minecraft:air", action: null },
  },
  tick: (ctx, player) => {
    const item = Server.player.getHeldItem(player);
    if (player.selectedSlot != 8 && item) {
      ctx.setData("currentItem", [item.typeId, item.data]);
      ctx.goto(ctx.getData("editingBrush") ? "$selectBrushType" : "$selectToolType");
    }
  },
  cancel: ctx => ctx.returnto("$tools")
});

HotbarUI.register<ConfigContext>("$pickMask", {
  title: ctx => "worldedit.config.mask." + (ctx.getData("editingBrush") ? "brush" : "tool"),
  items: {
    4: {
      item: "wedit:mask_picker",
      action: () => { /**/ }
    },
    7: {
      item: "wedit:confirm_button",
      action: (ctx, player) => {
        const mask = ctx.getData("session").globalMask;
        ctx.getData("pickerData").onFinish(ctx, player, mask, null);
      }
    }
  },
  entered: ctx => {
    const session = ctx.getData("session");
    ctx.setData("stashedMask", session.globalMask);
    session.globalMask = new Mask();
  },
  exiting: ctx => {
    const session = ctx.getData("session");
    session.globalMask = ctx.getData("stashedMask");
  },
  cancel: ctx => ctx.returnto(ctx.getData("pickerData").return)
});

HotbarUI.register<ConfigContext>("$pickPatternMask", {
  title: ctx => "%worldedit.config.patternMask." + (ctx.getData("editingBrush") ? "brush" : "tool"),
  items: {
    3: {
      item: "wedit:pattern_picker",
      action: () => { /**/ }
    },
    5: {
      item: "wedit:mask_picker",
      action: () => { /**/ }
    },
    7: {
      item: "wedit:confirm_button",
      action: (ctx, player) => {
        const session = ctx.getData("session");
        ctx.getData("pickerData").onFinish(ctx, player, session.globalMask, session.globalPattern);
      }
    }
  },
  entered: ctx => {
    const session = ctx.getData("session");
    ctx.setData("stashedMask", session.globalMask);
    ctx.setData("stashedPattern", session.globalPattern);
    session.globalMask = new Mask();
    session.globalPattern = new Pattern();
  },
  exiting: ctx => {
    const session = ctx.getData("session");
    session.globalMask = ctx.getData("stashedMask");
    session.globalPattern = ctx.getData("stashedPattern");
  },
  cancel: ctx => ctx.returnto(ctx.getData("pickerData").return)
});