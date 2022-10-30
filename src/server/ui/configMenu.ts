import { Server } from "@notbeer-api";
import { MenuContext } from "library/@types/build/classes/uiFormBuilder.js";
import { Tools } from "../tools/tool_manager.js";
import { ConfigContext } from "./types.js";

function displayItem(item: string) {
  if (item.startsWith("minecraft:")) {
    item = item.slice("minecraft:".length);
  }
  return item;
}

Server.uiForms.register<ConfigContext>("$configMenu", {
  title: "%worldedit.config.mainMenu",
  buttons: [
    {
      text: "%worldedit.config.clipboard",
      icon: "textures/items/paste",
      action: ctx => ctx.goto("$clipboardOptions")
    },
    {
      text: "%worldedit.config.tools",
      icon: "textures/ui/tool_config",
      action: ctx => {
        ctx.setData("editingBrush", false);
        ctx.goto("$tools");
      }
    },
    {
      text: "%worldedit.config.brushes",
      icon: "textures/ui/brush_config",
      action: ctx => {
        ctx.setData("editingBrush", true);
        ctx.goto("$tools");
      }
    }
  ],
  cancel: () => null
});

Server.uiForms.register<ConfigContext>("$clipboardOptions", {
  title: "%worldedit.config.clipboard",
  inputs: {
    $includeEntities: {
      name: "Copy Entities",
      type: "toggle",
      default: ctx => ctx.getData("session").includeEntities
    },
    $includeAir: {
      name: "Copy Air",
      type: "toggle",
      default: ctx => ctx.getData("session").includeAir
    }
  },
  submit: (ctx, _, input) => {
    const session = ctx.getData("session");
    session.includeAir = input.$includeAir as boolean;
    session.includeEntities = input.$includeEntities as boolean;
    ctx.returnto("$configMenu");
  },
  cancel: ctx => ctx.returnto("$configMenu")
});

Server.uiForms.register<ConfigContext>("$tools", {
  title: ctx => "%worldedit.config." + (ctx.getData("editingBrush") ? "brushes" : "tools"),
  buttons: (ctx, player) => {
    const buttons = [];
    for (const tool of Tools.getBoundItems(player, ctx.getData("editingBrush") ? "brush" : /^.*(?<!brush)$/)) {
      buttons.push({
        text: displayItem(tool[0]),
        action: (ctx: MenuContext<ConfigContext>) => {
          ctx.setData("currentTool", tool);
          ctx.goto("$editTool");
        }
      });
    }
    buttons.push({
      text: "Create new tool",
      action: () => null as null
    });
    return buttons;
  },
  cancel: ctx => ctx.returnto("$configMenu")
});

Server.uiForms.register<ConfigContext>("$editTool", {
  title: ctx => "Editing: " + ctx.getData("currentTool")[0],
  buttons: [
    {
      text: "Delete tool",
      action: (ctx, player) => {
        const tool = ctx.getData("currentTool");
        Tools.unbind(...tool, player);
        player.tell("Deleted " + displayItem(tool[0]));
        ctx.returnto("$tools");
      }
    }
  ],
  cancel: ctx => ctx.returnto("$tools")
});

Server.uiForms.register<ConfigContext>("$chooseItem", {
  title: "Hold an item to use a tool.",
  items: {
    0: { item: "nothing", action: null }, 1: { item: "nothing", action: null },
    2: { item: "nothing", action: null }, 3: { item: "nothing", action: null },
    4: { item: "nothing", action: null }, 5: { item: "nothing", action: null },
    6: { item: "nothing", action: null }, 7: { item: "nothing", action: null },
  },
  tick: (ctx, player) => {
    const item = Server.player.getHeldItem(player);
    if (player.selectedSlot != 8 && item) {
      // something context... this.currBindItem = [item.typeId, item.data];
      ctx.returnto("$configMenu");
    }
  },
  cancel: ctx => ctx.returnto("$tools")
});