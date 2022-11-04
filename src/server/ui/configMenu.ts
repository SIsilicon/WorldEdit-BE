import { Player } from "@minecraft/server";
import { HotbarUI } from "@modules/hotbar_ui.js";
import { Mask } from "@modules/mask.js";
import { Pattern } from "@modules/pattern.js";
import { contentLog, Server } from "@notbeer-api";
import { MenuContext, ModalForm } from "library/@types/build/classes/uiFormBuilder.js";
import { Brush } from "../brushes/base_brush.js";
import { SphereBrush } from "../brushes/sphere_brush.js";
import { CylinderBrush } from "../brushes/cylinder_brush.js";
import { SmoothBrush } from "../brushes/smooth_brush.js";
import { Tools } from "../tools/tool_manager.js";
import { ConfigContext, ToolTypes } from "./types.js";
import config from "config.js";

type MenuConfigCtx = MenuContext<ConfigContext>
type ModalFormInput = ModalForm<ConfigContext>["inputs"]

const toolsWithProperties: ToolTypes[] = [];

const usePickerInput: ModalFormInput = {
  $usePicker: {
    type: "toggle",
    name: "Use Block Picker",
    default: (ctx, player) => (getToolProperty(ctx, player, "mask") as Mask)?.getSource() == "(picked)"
  }
};

const brushSizeInput: ModalFormInput = {
  $size: {
    type: "slider",
    name: "Size",
    min: 1, max: config.maxBrushRadius,
    default: (ctx, player) => ctx.getData("creatingTool") ? 3 : (getToolProperty(ctx, player, "brush") as Brush).getSize()
  }
};

const brushMaskInput: ModalFormInput = {
  $mask: {
    type: "textField",
    name: "Mask",
    placeholder: "Blocks that can be affected (optional)",
    default: (ctx, player) => {
      if (ctx.getData("creatingTool")) return "";
      return (getToolProperty(ctx, player, "mask") as Mask)?.getSource() ?? "";
    }
  }
};

const brushPatternInput: ModalFormInput = {
  $pattern: {
    type: "textField",
    name: "Pattern",
    placeholder: "Blocks that will be created",
    default: (ctx, player) => {
      if (ctx.getData("creatingTool")) return "";
      return (getToolProperty(ctx, player, "brush") as SphereBrush | CylinderBrush).getPattern().getSource();
    }
  }
};

function displayItem(item: [string, number]) {
  let result = item[0];
  if (result.startsWith("minecraft:")) {
    result = result.slice("minecraft:".length);
  }
  if (item[1]) {
    result += ":" + Number;
  }
  return result;
}

function editToolTitle(ctx: MenuConfigCtx) {
  return "Editing: " + displayItem(ctx.getData("currentItem"));
}

function getToolProperty(ctx: MenuConfigCtx, player: Player, prop: string) {
  return Tools.getProperty(...ctx.getData("currentItem"), player, prop);
}

function getTools(player: Player, brushes: boolean) {
  return Tools.getBoundItems(player, brushes ? "brush" : /^.*(?<!brush)$/);
}

function getToolType(ctx: MenuConfigCtx, player: Player) {
  return ctx.getData("creatingTool") ?? Tools.getBindingType(...ctx.getData("currentItem"), player);
}

function finishToolEdit(ctx: MenuConfigCtx) {
  ctx.goto("$confirmToolBind");
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
    for (const tool of getTools(player, ctx.getData("editingBrush"))) {
      const toolType = Tools.getBindingType(...tool as [string, number], player) as ToolTypes;
      buttons.push({
        text: displayItem(tool),
        action: (ctx: MenuConfigCtx) => {
          ctx.setData("creatingTool", null);
          ctx.setData("currentItem", tool);
          if (toolsWithProperties.includes(toolType)) {
            ctx.goto(`$editTool_${toolType}`);
          } else if (toolType == "brush") {
            ctx.goto(`$editTool_${(Tools.getProperty(...tool, player, "brush") as Brush).id}`);
          } else {
            ctx.goto("$toolNoConfig");
          }
        }
      });
    }
    buttons.push({
      text: (ctx: MenuConfigCtx) => ctx.getData("editingBrush") ? "Create new brush" : "Create new tool",
      action: (ctx: MenuConfigCtx, player: Player) => {
        HotbarUI.goto("$chooseItem", player, ctx);
      }
    });
    if (buttons.length > 1) {
      buttons.push({
        text: "Delete tool(s)",
        action: (ctx: MenuConfigCtx) => {
          ctx.goto("$deleteTools");
        }
      });
    }
    return buttons;
  },
  cancel: ctx => ctx.returnto("$configMenu")
});

Server.uiForms.register<ConfigContext>("$toolNoConfig", {
  title: "No Tool Properties",
  message: "This tool has no properties to change." + "\n\n",
  buttons: [
    {
      text: "Ok",
      action: ctx => ctx.returnto("$tools")
    }
  ],
  cancel: ctx => ctx.returnto("$tools")
});

Server.uiForms.register<ConfigContext>("$editTool_stacker_wand", {
  title: editToolTitle,
  inputs: {
    $range: {
      type: "slider",
      name: "Range",
      min: 1, max: config.navWandDistance,
      default: (ctx, player) => ctx.getData("creatingTool") ? 5 : getToolProperty(ctx, player, "range") as number,
    },
    $mask: {
      type: "textField",
      name: "Mask",
      placeholder: "What kind of blocks can be stacked through",
      default: (ctx, player) => {
        if (ctx.getData("creatingTool")) {
          return "air,water";
        }
        return (getToolProperty(ctx, player, "mask") as Mask).getSource();
      }
    },
    $usePicker: {
      type: "toggle",
      name: "Use Block Picker",
      default: (ctx, player) => (getToolProperty(ctx, player, "mask") as Mask)?.getSource() == "(picked)"
    }
  },
  submit: (ctx, player, input) => {
    if (input.$usePicker) {
      ctx.setData("pickerData", {
        return: "$editTool_stacker_wand",
        onFinish: (ctx, _, mask) => {
          ctx.setData("toolData", [input.$range as number, mask]);
          finishToolEdit(ctx);
        }
      });
      HotbarUI.goto("$pickMask", player, ctx);
    } else {
      ctx.setData("toolData", [input.$range as number, new Mask(input.$mask as string)]);
      finishToolEdit(ctx);
    }
  },
  cancel: ctx => ctx.returnto("$tools")
});
toolsWithProperties.push("stacker_wand");

Server.uiForms.register<ConfigContext>("$editTool_sphere_brush", {
  title: editToolTitle,
  inputs: {
    ...brushSizeInput,
    ...brushPatternInput,
    ...brushMaskInput,
    $hollow: {
      type: "toggle",
      name: "Hollow",
      default: (ctx, player) => !ctx.getData("creatingTool") ?
        (getToolProperty(ctx, player, "brush") as SphereBrush).isHollow() :
        false
    },
    ...usePickerInput
  },
  submit: (ctx, player, input) => {
    if (input.$usePicker) {
      ctx.setData("pickerData", {
        return: "$editTool_sphere_brush",
        onFinish: (ctx, _, mask, pattern) => {
          ctx.setData("toolData", [
            new SphereBrush(input.$size as number, pattern, input.$hollow as boolean),
            mask, null, null
          ]);
          finishToolEdit(ctx);
        }
      });
      HotbarUI.goto("$pickPatternMask", player, ctx);
    } else {
      contentLog.debug(input.$size, input.$pattern, input.$hollow);
      ctx.setData("toolData", [
        new SphereBrush(input.$size as number, new Pattern(input.$pattern as string), input.$hollow as boolean),
        new Mask(input.$mask as string), null, null
      ]);
      finishToolEdit(ctx);
    }
  },
  cancel: ctx => ctx.returnto("$tools")
});

Server.uiForms.register<ConfigContext>("$editTool_cylinder_brush", {
  title: editToolTitle,
  inputs: {
    ...brushSizeInput,
    $height: {
      type: "slider",
      name: "Height",
      min: 1, max: config.maxBrushRadius * 2,
      default: (ctx, player) => ctx.getData("creatingTool") ? 1 : (getToolProperty(ctx, player, "brush") as CylinderBrush).getHeight()
    },
    ...brushPatternInput,
    ...brushMaskInput,
    $hollow: {
      type: "toggle",
      name: "Hollow",
      default: (ctx, player) => !ctx.getData("creatingTool") ?
        (getToolProperty(ctx, player, "brush") as CylinderBrush).isHollow() :
        false
    },
    ...usePickerInput
  },
  submit: (ctx, player, input) => {
    if (input.$usePicker) {
      ctx.setData("pickerData", {
        return: "$editTool_cylinder_brush",
        onFinish: (ctx, _, mask, pattern) => {
          ctx.setData("toolData", [
            new CylinderBrush(input.$size as number, input.$height as number, pattern, input.$hollow as boolean),
            mask, null, null
          ]);
          finishToolEdit(ctx);
        }
      });
      HotbarUI.goto("$pickPatternMask", player, ctx);
    } else {
      ctx.setData("toolData", [
        new CylinderBrush(input.$size as number, input.$height as number, new Pattern(input.$pattern as string), input.$hollow as boolean),
        new Mask(input.$mask as string), null, null
      ]);
      finishToolEdit(ctx);
    }
  },
  cancel: ctx => ctx.returnto("$tools")
});

Server.uiForms.register<ConfigContext>("$editTool_smooth_brush", {
  title: editToolTitle,
  inputs: {
    ...brushSizeInput,
    ...brushMaskInput,
    $iterations: {
      type: "slider",
      name: "Smoothness",
      min: 1, max: 6,
      default: (ctx, player) => ctx.getData("creatingTool") ? 1 : (getToolProperty(ctx, player, "brush") as SmoothBrush).getIterations()
    },
    $heightMask: {
      type: "textField",
      name: "Mask",
      placeholder: "Blocks that are part of height map",
      default: (ctx, player) => {
        if (ctx.getData("creatingTool")) return "";
        return (getToolProperty(ctx, player, "brush") as SmoothBrush).getHeightMask()?.getSource() ?? "";
      }
    },
    ...usePickerInput
  },
  submit: (ctx, player, input) => {
    if (input.$usePicker) {
      ctx.setData("pickerData", {
        return: "$editTool_smooth_brush",
        onFinish: (ctx, _, mask) => {
          ctx.setData("toolData", [
            new SmoothBrush(input.$size as number, input.$iterations as number, new Mask(input.$heightMask as string)),
            mask, null, null
          ]);
          finishToolEdit(ctx);
        }
      });
      HotbarUI.goto("$pickMask", player, ctx);
    } else {
      ctx.setData("toolData", [
        new SmoothBrush(input.$size as number, input.$iterations as number, new Mask(input.$heightMask as string)),
        new Mask(input.$mask as string), null, null
      ]);
      finishToolEdit(ctx);
    }
  },
  cancel: ctx => ctx.returnto("$tools")
});

Server.uiForms.register<ConfigContext>("$selectToolType", {
  title: "Select the type of tool to bind to,",
  buttons: [
    {
      text: "Selection Wand",
      icon: "textures/ui/selection_wand",
      action: ctx => {
        ctx.setData("creatingTool", "selection_wand");
        finishToolEdit(ctx);
      }
    },
    {
      text: "Far Selection Wand",
      icon: "textures/ui/far_selection_wand",
      action: ctx => {
        ctx.setData("creatingTool", "far_selection_wand");
        finishToolEdit(ctx);
      }
    },
    {
      text: "Navigation Wand",
      icon: "textures/ui/navigation_wand",
      action: ctx => {
        ctx.setData("creatingTool", "navigation_wand");
        finishToolEdit(ctx);
      }
    },
    {
      text: "Stacker Wand",
      icon: "textures/ui/stacker_wand",
      action: ctx => {
        ctx.setData("creatingTool", "stacker_wand");
        ctx.goto("$editTool_stacker_wand");
      }
    }
  ],
  cancel: ctx => ctx.returnto("$tools")
});

Server.uiForms.register<ConfigContext>("$selectBrushType", {
  title: "Select the type of brush to bind to,",
  buttons: [
    {
      text: "Sphere Brush",
      icon: "textures/ui/sphere_brush",
      action: ctx => {
        ctx.setData("creatingTool", "sphere_brush");
        ctx.goto("$editTool_sphere_brush");
      }
    },
    {
      text: "Cylinder Brush",
      icon: "textures/ui/cylinder_brush",
      action: ctx => {
        ctx.setData("creatingTool", "cylinder_brush");
        ctx.goto("$editTool_cylinder_brush");
      }
    },
    {
      text: "Smooth Brush",
      icon: "textures/ui/smooth_brush",
      action: ctx => {
        ctx.setData("creatingTool", "smooth_brush");
        ctx.goto("$editTool_smooth_brush");
      }
    }
  ],
  cancel: ctx => ctx.returnto("$tools")
});

Server.uiForms.register<ConfigContext>("$confirmToolBind", {
  title: "Bind tool?",
  message: (ctx, player) => `Are you sure you want to bind "${getToolType(ctx, player)}" to "${ctx.getData("currentItem")[0]}?"`,
  button1: {
    text: "Yes",
    action: (ctx, player) => {
      const session = ctx.getData("session");
      const toolType = getToolType(ctx, player);
      const item = ctx.getData("currentItem");
      const toolData = ctx.getData("toolData");

      if (toolType == "selection_wand") {
        session.bindTool("selection_wand", item);
      } else if (toolType == "far_selection_wand") {
        session.bindTool("far_selection_wand", item);
      } else if (toolType == "navigation_wand") {
        session.bindTool("selection_wand", item);
      } else if (toolType == "stacker_wand") {
        session.bindTool("stacker_wand", item, ...toolData);
      } else if (toolType.endsWith("brush")) {
        session.bindTool("brush", item, toolData[0], toolData[1]);
        Tools.setProperty(...item, player, "range", toolData[2]);
        Tools.setProperty(...item, player, "traceMask", toolData[3]);
      }
      ctx.returnto("$tools");
    }
  },
  button2: {
    text: "No",
    action: ctx => ctx.returnto("$tools")
  },
  cancel: ctx => ctx.returnto("$tools")
});

Server.uiForms.register<ConfigContext>("$confirmDelete", {
  title: "Delete tool(s)?",
  message: ctx => {
    const deleting = ctx.getData("deletingTools");
    let message = deleting.length == 1 ?
      "Are you sure you want to unbind this item?" :
      "Are you sure you want to unbind these items?";
    for (const item of deleting) {
      message += `\n${displayItem(item)}`;
    }
    return message;
  },
  button1: {
    text: "Yes",
    action: ctx => {
      const session = ctx.getData("session");
      for (const item of ctx.getData("deletingTools")) {
        session.unbindTool(item);
      }
      ctx.returnto("$tools");
    }
  },
  button2: {
    text: "No",
    action: ctx => ctx.returnto("$tools")
  },
  cancel: ctx => ctx.returnto("$tools")
});

Server.uiForms.register<ConfigContext>("$deleteTools", {
  title: "Select tools to delete.",
  inputs: (ctx, player) => {
    const toggles: ModalFormInput = {};
    for (const tool of getTools(player, ctx.getData("editingBrush"))) {
      toggles[`$${tool.join("--")}`] = {
        name: displayItem(tool),
        type: "toggle"
      };
    }
    return toggles;
  },
  submit: (ctx, _, input) => {
    const toDelete: [string, number][] = [];
    for (const [key, value] of Object.entries(input)) {
      const [id, dataString] = key.slice(1).split("--") as [string, string];
      const dataValue = Number.parseInt(dataString);
      if (value) {
        toDelete.push([id, dataValue]);
      }
    }
    if (toDelete.length) {
      ctx.setData("deletingTools", toDelete);
      ctx.goto("$confirmDelete");
    } else {
      ctx.returnto("$tools");
    }
  },
  cancel: ctx => ctx.returnto("$tools")
});