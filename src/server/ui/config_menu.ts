import { ItemStack, Player, RawMessage } from "@minecraft/server";
import { HotbarUI } from "@modules/hotbar_ui.js";
import { Mask } from "@modules/mask.js";
import { Pattern, patternsFromSelection } from "@modules/pattern.js";
import { Server } from "@notbeer-api";
import { MenuContext, ModalForm } from "library/@types/classes/uiFormBuilder.js";
import { Tools } from "../tools/tool_manager.js";
import { selectionModes } from "@modules/selection.js";
import { ConfigContext, ToolTypes } from "./types.js";
import { getSession } from "server/sessions.js";
import { Brush } from "../brushes/base_brush.js";
import { StructureBrush } from "server/brushes/structure_brush.js";
import { SphereBrush } from "../brushes/sphere_brush.js";
import { CylinderBrush } from "../brushes/cylinder_brush.js";
import { SmoothBrush } from "../brushes/smooth_brush.js";
import { ErosionBrush } from "server/brushes/erosion_brush.js";
import { OverlayBrush } from "server/brushes/overlay_brush.js";
import { RaiseBrush } from "server/brushes/raise_brush.js";
import { Easing } from "@modules/easing.js";
import easingsFunctions from "@modules/extern/easingFunctions.js";
import config from "config.js";

type MenuConfigCtx = MenuContext<ConfigContext>;
type ModalFormInput = ModalForm<ConfigContext>["inputs"];

const toolsWithProperties: ToolTypes[] = [];

const usePickerInput: ModalFormInput = {
    $usePicker: {
        type: "toggle",
        name: "%worldedit.config.usePicker",
        default: (ctx, player) => (getToolProperty(ctx, player, "mask") as Mask)?.toJSON() == "(picked)",
    },
};

const brushSizeInput: ModalFormInput = {
    $size: {
        type: "slider",
        name: "%worldedit.config.radius",
        min: 1,
        max: config.maxBrushRadius,
        default: (ctx, player) => {
            if (ctx.getData("creatingTool")) return 3;
            const brush = getToolProperty(ctx, player, "brush") as Brush;
            return "radius" in brush ? (brush as Brush & { radius: number }).radius : 3;
        },
    },
};

const maskInput: ModalFormInput = {
    $mask: {
        type: "textField",
        name: "%worldedit.config.mask",
        placeholder: "Eg: air %gametest.optionalPrefix",
        default: (ctx, player) => {
            if (ctx.getData("creatingTool")) return "";
            return (getToolProperty(ctx, player, "mask") as Mask)?.toJSON() ?? "";
        },
    },
};

const brushPatternInput: ModalFormInput = {
    $pattern: {
        type: "textField",
        name: "%worldedit.config.pattern",
        placeholder: "Eg: stone,dirt",
        default: (ctx, player) => {
            if (ctx.getData("creatingTool")) return "";
            return (getToolProperty(ctx, player, "brush") as SphereBrush | CylinderBrush).pattern.toString();
        },
    },
};

function displayItem(item: string) {
    return { translate: new ItemStack(item).localizationKey };
}

function editToolTitle(ctx: MenuConfigCtx) {
    return { rawtext: [{ translate: "accessibility.textbox.editing" }, { text: ": " }, displayItem(ctx.getData("currentItem"))] };
}

function getToolProperty(ctx: MenuConfigCtx, player: Player, prop: string) {
    return Tools.getProperty(ctx.getData("currentItem"), player.id, prop);
}

function getTools(player: Player, brushes: boolean) {
    return Tools.getBoundItems(player.id, brushes ? "brush" : /^.*(?<!brush)$/);
}

function getToolType(ctx: MenuConfigCtx, player: Player) {
    return ctx.getData("creatingTool") ?? Tools.getBindingType(ctx.getData("currentItem"), player.id);
}

function finishToolEdit(ctx: MenuConfigCtx) {
    ctx.goto("$confirmToolBind");
}

function verifyPattern(input: string) {
    let pattern;
    try {
        if ((pattern = new Pattern(input)).empty()) return "worldedit.config.pattern.noPattern";
    } catch {
        return "worldedit.config.pattern.invalidPattern";
    }
    return pattern;
}

function verifyMask(input: string) {
    let mask;
    try {
        mask = new Mask(input);
    } catch {
        return "worldedit.config.mask.invalidMask";
    }
    return mask;
}

Server.uiForms.register<ConfigContext>("$configMenu", {
    title: "%worldedit.config.mainMenu",
    buttons: [
        {
            text: "%worldedit.config.general",
            icon: "textures/ui/gear",
            action: (ctx) => ctx.goto("$generalOptions"),
        },
        {
            text: "%worldedit.config.tools",
            icon: "textures/ui/tool_config",
            action: (ctx) => {
                ctx.setData("editingBrush", false);
                ctx.goto("$tools");
            },
        },
        {
            text: "%worldedit.config.brushes",
            icon: "textures/ui/brush_config",
            action: (ctx) => {
                ctx.setData("editingBrush", true);
                ctx.goto("$tools");
            },
        },
        {
            text: "%worldedit.config.gradients",
            icon: "textures/ui/gradient_config",
            action: (ctx) => ctx.goto("$gradients"),
        },
    ],
});

Server.uiForms.register<ConfigContext>("$generalOptions", {
    title: "%worldedit.config.general",
    inputs: {
        $includeEntities: {
            name: "%worldedit.config.general.includeEntities",
            type: "toggle",
            default: (ctx) => ctx.getData("session").includeEntities,
        },
        $includeAir: {
            name: "%worldedit.config.general.includeAir",
            type: "toggle",
            default: (ctx) => ctx.getData("session").includeAir,
        },
        $perfMode: {
            name: "%worldedit.config.general.perfMode",
            type: "toggle",
            default: (ctx) => ctx.getData("session").performanceMode || config.performanceMode,
        },
        $drawOutlines: {
            name: "%worldedit.config.general.drawOutlines",
            type: "dropdown",
            options: ["%worldedit.config.general.drawOutlines.off", "%worldedit.config.general.drawOutlines.self", "%worldedit.config.general.drawOutlines.all"],
            default: (ctx) => {
                const drawOutlines = ctx.getData("session").drawOutlines;
                if (!drawOutlines) return 0;
                else if (drawOutlines === "local") return 1;
                else return 2;
            },
        },
        $selectionMode: {
            name: "%worldedit.config.general.selectMode",
            type: "dropdown",
            options: ["%worldedit.selectionMode.cuboid", "%worldedit.selectionMode.extend", "%worldedit.selectionMode.sphere", "%worldedit.selectionMode.cylinder"],
            default: (ctx) => selectionModes.indexOf(ctx.getData("session").selection.mode),
        },
    },
    submit: (ctx, _, input) => {
        const session = ctx.getData("session");
        session.includeAir = input.$includeAir as boolean;
        session.includeEntities = input.$includeEntities as boolean;
        session.performanceMode = input.$perfMode as boolean;
        session.drawOutlines = <boolean | "local">[false, "local", true][input.$drawOutlines as number];
        session.selection.mode = selectionModes[input.$selectionMode as number];
        ctx.returnto("$configMenu");
    },
    cancel: (ctx) => ctx.returnto("$configMenu"),
});

Server.uiForms.register<ConfigContext>("$tools", {
    title: (ctx) => "%worldedit.config." + (ctx.getData("editingBrush") ? "brushes" : "tools"),
    buttons: (ctx, player) => {
        const buttons = [];
        buttons.push({
            text: (ctx: MenuConfigCtx) => "%worldedit.config.new" + (ctx.getData("editingBrush") ? "Brush" : "Tool"),
            action: (ctx: MenuConfigCtx, player: Player) => {
                HotbarUI.goto("$chooseItem", player, ctx);
            },
        });
        for (const tool of getTools(player, ctx.getData("editingBrush"))) {
            const toolType = Tools.getBindingType(tool, player.id) as ToolTypes;
            buttons.push({
                text: { rawtext: [{ text: "|-- " }, displayItem(tool), { text: " --|" }] },
                action: (ctx: MenuConfigCtx) => {
                    ctx.setData("creatingTool", null);
                    ctx.setData("currentItem", tool);
                    if (toolsWithProperties.includes(toolType)) {
                        ctx.goto(`$editTool_${toolType}`);
                    } else if (toolType == "brush") {
                        ctx.goto(`$editTool_${(Tools.getProperty(tool, player.id, "brush") as Brush).id}`);
                    } else {
                        ctx.goto("$toolNoConfig");
                    }
                },
            });
        }
        if (buttons.length > 1) {
            buttons.push({
                text: "Delete tool(s)",
                action: (ctx: MenuConfigCtx) => {
                    ctx.goto("$deleteTools");
                },
            });
        }
        return buttons;
    },
    cancel: (ctx) => ctx.returnto("$configMenu"),
});

Server.uiForms.register<ConfigContext>("$gradients", {
    title: "%worldedit.config.gradients",
    buttons: (_, player) => {
        const buttons = [];
        buttons.push({
            text: "%worldedit.config.newGradient",
            action: (ctx: MenuConfigCtx) => ctx.goto("$addGradient"),
        });
        for (const id of getSession(player).getGradientNames()) {
            buttons.push({
                text: id,
                action: (ctx: MenuConfigCtx) => {
                    ctx.setData("currentGradient", id);
                    ctx.goto("$gradientInfo");
                },
            });
        }
        return buttons;
    },
});

Server.uiForms.register<ConfigContext>("$gradientInfo", {
    title: (ctx) => ctx.getData("currentGradient"),
    buttons: [
        {
            text: "%worldedit.config.gradient.use",
            action: (ctx, player) => {
                const session = getSession(player);
                session.globalPattern = new Pattern(`$${ctx.getData("currentGradient")}`);
            },
        },
        {
            text: "%worldedit.config.gradient.remove",
            action: (ctx) =>
                ctx.confirm("$worldedit.config.confirm", "%worldedit.config.confirm.delete", (ctx, player) => {
                    getSession(player).deleteGradient(ctx.getData("currentGradient"));
                }),
        },
    ],
});

Server.uiForms.register<ConfigContext>("$addGradient", {
    title: "%worldedit.config.gradient.add",
    inputs: {
        $id: {
            type: "textField",
            name: "%worldedit.config.name",
            placeholder: "%worldedit.config.gradient.promptName",
        },
        $dither: {
            type: "slider",
            name: "%worldedit.config.blend",
            min: 0,
            max: 1,
            default: 1,
        },
    },
    submit: (ctx, player, input) => {
        const gradientId = <string>input.$id;
        if (!gradientId.length) return ctx.error("worldedit.config.gradient.noId");
        if (getSession(player).getGradient(gradientId)) return ctx.error("worldedit.config.gradient.dupeId");

        ctx.setData("pickerData", {
            return: "$gradients",
            onFinish: (ctx) => {
                ctx.setData("gradientData", [gradientId, input.$dither as number]);
                ctx.goto("$confirmGradientSelection");
            },
        });
        HotbarUI.goto("$selectBlocks", player, ctx);
    },
    cancel: (ctx) => ctx.returnto("$gradients"),
});

Server.uiForms.register<ConfigContext>("$confirmGradientSelection", {
    title: "%worldedit.config.confirm",
    message: "%worldedit.config.confirm.create",
    button1: {
        text: "%dr.button.ok",
        action: (ctx) => {
            const session = ctx.getData("session");
            const [id, dither] = ctx.getData("gradientData");
            const patterns = patternsFromSelection(session.selection);

            session.createGradient(id, dither, patterns);
            ctx.returnto("$gradients");
        },
    },
    button2: {
        text: "%gui.cancel",
        action: (ctx) => ctx.returnto("$gradients"),
    },
    cancel: (ctx) => ctx.returnto("$gradients"),
});

Server.uiForms.register<ConfigContext>("$toolNoConfig", {
    title: "%worldedit.config.tool.noProps",
    message: "%worldedit.config.tool.noProps.detail " + "\n\n\n",
    buttons: [
        {
            text: "%dr.button.ok",
            action: (ctx) => ctx.returnto("$tools"),
        },
    ],
    cancel: (ctx) => ctx.returnto("$tools"),
});

Server.uiForms.register<ConfigContext>("$editTool_stacker_wand", {
    title: editToolTitle,
    inputs: {
        $range: {
            type: "slider",
            name: "%worldedit.config.range",
            min: 1,
            max: config.traceDistance,
            default: (ctx, player) => (ctx.getData("creatingTool") ? 5 : (getToolProperty(ctx, player, "range") as number)),
        },
        ...maskInput,
        ...usePickerInput,
    },
    submit: (ctx, player, input) => {
        if (input.$usePicker) {
            ctx.setData("pickerData", {
                return: "$editTool_stacker_wand",
                onFinish: (ctx, _, mask) => {
                    ctx.setData("toolData", [input.$range as number, mask]);
                    finishToolEdit(ctx);
                },
            });
            HotbarUI.goto("$pickMask", player, ctx);
        } else {
            ctx.setData("toolData", [input.$range as number, new Mask(input.$mask as string)]);
            finishToolEdit(ctx);
        }
    },
    cancel: (ctx) => ctx.returnto("$tools"),
});
toolsWithProperties.push("stacker_wand");

Server.uiForms.register<ConfigContext>("$editTool_extruder_wand", {
    title: editToolTitle,
    inputs: {
        $range: {
            type: "slider",
            name: "%worldedit.config.range",
            min: 1,
            max: config.traceDistance,
            default: (ctx, player) => (ctx.getData("creatingTool") ? 5 : (getToolProperty(ctx, player, "range") as number)),
        },
        $mode: {
            type: "dropdown",
            name: "%worldedit.config.mode",
            options: ["%worldedit.extruderMode.pull", "%worldedit.extruderMode.dig"],
            default: (ctx, player) => (ctx.getData("creatingTool") ? 0 : (getToolProperty(ctx, player, "digging") as boolean) ? 1 : 0),
        },
    },
    submit: (ctx, player, input) => {
        ctx.setData("toolData", [input.$range as number, !!(input.$mode as number)]);
        finishToolEdit(ctx);
    },
    cancel: (ctx) => ctx.returnto("$tools"),
});
toolsWithProperties.push("extruder_wand");

Server.uiForms.register<ConfigContext>("$editTool_command_wand", {
    title: editToolTitle,
    inputs: {
        $command: {
            type: "textField",
            name: "%worldedit.config.command",
            placeholder: "Enter here (without ; or /)",
            default: (ctx, player) => (ctx.getData("creatingTool") ? "" : (getToolProperty(ctx, player, "command") as string)),
        },
        $worldeditCmd: {
            type: "toggle",
            name: "%worldedit.config.command.isWorldEdit",
            default: (ctx, player) => (ctx.getData("creatingTool") ? false : (getToolProperty(ctx, player, "isCustom") as boolean)),
        },
    },
    submit: (ctx, _, input) => {
        if (!(<string>input.$command).length) return ctx.error("worldedit.config.command.noCommand");
        ctx.setData("toolData", [((input.$worldeditCmd ? config.commandPrefix : "/") + input.$command) as string]);
        finishToolEdit(ctx);
    },
    cancel: (ctx) => ctx.returnto("$tools"),
});
toolsWithProperties.push("command_wand");

Server.uiForms.register<ConfigContext>("$editTool_replacer_wand", {
    title: editToolTitle,
    inputs: {
        $pattern: {
            type: "textField",
            name: "%worldedit.config.pattern",
            placeholder: "Eg: stone,dirt",
            default: (ctx, player) => {
                if (ctx.getData("creatingTool")) return "";
                return (getToolProperty(ctx, player, "pattern") as Pattern).toString();
            },
        },
        ...usePickerInput,
    },
    submit: (ctx, player, input) => {
        if (input.$usePicker) {
            ctx.setData("pickerData", {
                return: "$editTool_replacer_wand",
                onFinish: (ctx, _, _mask, pattern) => {
                    ctx.setData("toolData", [pattern]);
                    finishToolEdit(ctx);
                },
            });
            HotbarUI.goto("$pickPattern", player, ctx);
        } else {
            const pattern = verifyPattern(<string>input.$pattern);
            if (typeof pattern === "string") return ctx.error(pattern);
            ctx.setData("toolData", [pattern]);
            finishToolEdit(ctx);
        }
    },
    cancel: (ctx) => ctx.returnto("$tools"),
});
toolsWithProperties.push("replacer_wand");

Server.uiForms.register<ConfigContext>("$editTool_sphere_brush", {
    title: editToolTitle,
    inputs: {
        ...brushSizeInput,
        ...brushPatternInput,
        ...maskInput,
        $hollow: {
            type: "toggle",
            name: "%worldedit.config.hollow",
            default: (ctx, player) => (!ctx.getData("creatingTool") ? (getToolProperty(ctx, player, "brush") as SphereBrush).hollow : false),
        },
        ...usePickerInput,
    },
    submit: (ctx, player, input) => {
        if (input.$usePicker) {
            ctx.setData("pickerData", {
                return: "$editTool_sphere_brush",
                onFinish: (ctx, _, mask, pattern) => {
                    ctx.setData("toolData", [new SphereBrush(input.$size as number, pattern, input.$hollow as boolean), mask, null, null]);
                    finishToolEdit(ctx);
                },
            });
            HotbarUI.goto("$pickPatternMask", player, ctx);
        } else {
            const pattern = verifyPattern(<string>input.$pattern);
            if (typeof pattern === "string") return ctx.error(pattern);
            const mask = verifyMask(<string>input.$mask);
            if (typeof mask === "string") return ctx.error(mask);
            ctx.setData("toolData", [new SphereBrush(input.$size as number, pattern, input.$hollow as boolean), mask, null, null]);
            finishToolEdit(ctx);
        }
    },
    cancel: (ctx) => ctx.returnto("$tools"),
});

Server.uiForms.register<ConfigContext>("$editTool_cylinder_brush", {
    title: editToolTitle,
    inputs: {
        ...brushSizeInput,
        $height: {
            type: "slider",
            name: "%worldedit.config.height",
            min: 1,
            max: config.maxBrushRadius * 2,
            default: (ctx, player) => (ctx.getData("creatingTool") ? 1 : (getToolProperty(ctx, player, "brush") as CylinderBrush).height),
        },
        ...brushPatternInput,
        ...maskInput,
        $hollow: {
            type: "toggle",
            name: "%worldedit.config.hollow",
            default: (ctx, player) => (!ctx.getData("creatingTool") ? (getToolProperty(ctx, player, "brush") as CylinderBrush).hollow : false),
        },
        ...usePickerInput,
    },
    submit: (ctx, player, input) => {
        if (input.$usePicker) {
            ctx.setData("pickerData", {
                return: "$editTool_cylinder_brush",
                onFinish: (ctx, _, mask, pattern) => {
                    ctx.setData("toolData", [new CylinderBrush(input.$size as number, input.$height as number, pattern, input.$hollow as boolean), mask, null, null]);
                    finishToolEdit(ctx);
                },
            });
            HotbarUI.goto("$pickPatternMask", player, ctx);
        } else {
            const pattern = verifyPattern(<string>input.$pattern);
            if (typeof pattern === "string") return ctx.error(pattern);
            const mask = verifyMask(<string>input.$mask);
            if (typeof mask === "string") return ctx.error(mask);
            ctx.setData("toolData", [new CylinderBrush(input.$size as number, input.$height as number, pattern, input.$hollow as boolean), mask, null, null]);
            finishToolEdit(ctx);
        }
    },
    cancel: (ctx) => ctx.returnto("$tools"),
});

Server.uiForms.register<ConfigContext>("$editTool_smooth_brush", {
    title: editToolTitle,
    inputs: {
        ...brushSizeInput,
        ...maskInput,
        $iterations: {
            type: "slider",
            name: "%worldedit.config.smooth",
            min: 1,
            max: 6,
            default: (ctx, player) => (ctx.getData("creatingTool") ? 1 : (getToolProperty(ctx, player, "brush") as SmoothBrush).getIterations()),
        },
        $heightMask: {
            type: "textField",
            name: "%worldedit.config.mask.height",
            placeholder: "Eg: grass,stone %gametest.optionalPrefix",
            default: (ctx, player) => {
                if (ctx.getData("creatingTool")) return "";
                return (getToolProperty(ctx, player, "brush") as SmoothBrush).heightMask?.toJSON() ?? "";
            },
        },
        ...usePickerInput,
    },
    submit: (ctx, player, input) => {
        const heightMask = verifyMask(<string>input.$heightMask);
        if (typeof heightMask === "string") return ctx.error(heightMask);

        if (input.$usePicker) {
            ctx.setData("pickerData", {
                return: "$editTool_smooth_brush",
                onFinish: (ctx, _, mask) => {
                    ctx.setData("toolData", [new SmoothBrush(input.$size as number, input.$iterations as number, heightMask), mask, null, null]);
                    finishToolEdit(ctx);
                },
            });
            HotbarUI.goto("$pickMask", player, ctx);
        } else {
            const mask = verifyMask(<string>input.$mask);
            if (typeof mask === "string") return ctx.error(mask);
            ctx.setData("toolData", [new SmoothBrush(input.$size as number, input.$iterations as number, heightMask), mask, null, null]);
            finishToolEdit(ctx);
        }
    },
    cancel: (ctx) => ctx.returnto("$tools"),
});

Server.uiForms.register<ConfigContext>("$editTool_structure_brush", {
    title: editToolTitle,
    inputs: {
        $structs: {
            type: "textField",
            name: "%worldedit.config.structures",
            placeholder: "Leave blank for current clipboard",
            default: (ctx, player) => {
                if (ctx.getData("creatingTool")) return "";
                return (getToolProperty(ctx, player, "brush") as StructureBrush).imports?.join(" ") ?? "";
            },
        },
    },
    submit: (ctx, player, input) => {
        ctx.setData("toolData", [new StructureBrush(input.$structs ? (input.$structs as string).split(" ") : getSession(player).clipboard, null), null, null, null]);
        finishToolEdit(ctx);
    },
    cancel: (ctx) => ctx.returnto("$tools"),
});

Server.uiForms.register<ConfigContext>("$editTool_erosion_brush", {
    title: editToolTitle,
    inputs: {
        ...brushSizeInput,
        $erosion: {
            type: "dropdown",
            name: "%worldedit.config.erosion",
            options: ["Erode", "Lift", "Fill", "Melt", "Smooth"],
            default: (ctx, player) => {
                if (ctx.getData("creatingTool")) return 0;
                return (getToolProperty(ctx, player, "brush") as ErosionBrush).erosionType;
            },
        },
        ...maskInput,
        ...usePickerInput,
    },
    submit: (ctx, player, input) => {
        if (input.$usePicker) {
            ctx.setData("pickerData", {
                return: "$editTool_erosion_brush",
                onFinish: (ctx, _, mask) => {
                    ctx.setData("toolData", [new ErosionBrush(input.$size as number, input.$erosion as number), mask, null, null]);
                    finishToolEdit(ctx);
                },
            });
            HotbarUI.goto("$pickMask", player, ctx);
        } else {
            const mask = verifyMask(<string>input.$mask);
            if (typeof mask === "string") return ctx.error(mask);
            ctx.setData("toolData", [new ErosionBrush(input.$size as number, input.$erosion as number), mask, null, null]);
            finishToolEdit(ctx);
        }
    },
    cancel: (ctx) => ctx.returnto("$tools"),
});

Server.uiForms.register<ConfigContext>("$editTool_overlay_brush", {
    title: editToolTitle,
    inputs: {
        ...brushSizeInput,
        ...brushPatternInput,
        $depth: {
            type: "slider",
            name: "%worldedit.config.depth",
            min: -10,
            max: 10,
            default: (ctx, player) => {
                if (ctx.getData("creatingTool")) return 1;
                return (getToolProperty(ctx, player, "brush") as OverlayBrush).depth;
            },
        },
        ...maskInput,
        ...usePickerInput,
    },
    submit: (ctx, player, input) => {
        if (input.$usePicker) {
            ctx.setData("pickerData", {
                return: "$editTool_overlay_brush",
                onFinish: (ctx, _, mask, pattern) => {
                    ctx.setData("toolData", [new OverlayBrush(input.$size as number, input.$depth as number, pattern, null), mask, null, null]);
                    finishToolEdit(ctx);
                },
            });
            HotbarUI.goto("$pickPatternMask", player, ctx);
        } else {
            const pattern = verifyPattern(<string>input.$pattern);
            if (typeof pattern === "string") return ctx.error(pattern);
            const mask = verifyMask(<string>input.$mask);
            if (typeof mask === "string") return ctx.error(mask);
            ctx.setData("toolData", [new OverlayBrush(input.$size as number, input.$depth as number, pattern, null), mask, null, null]);
            finishToolEdit(ctx);
        }
    },
    cancel: (ctx) => ctx.returnto("$tools"),
});

Server.uiForms.register<ConfigContext>("$editTool_raise_brush", {
    title: editToolTitle,
    inputs: {
        ...brushSizeInput,
        ...maskInput,
        $height: {
            type: "slider",
            name: "%worldedit.config.height",
            min: -6,
            max: 6,
            default: (ctx, player) => (ctx.getData("creatingTool") ? 1 : (getToolProperty(ctx, player, "brush") as RaiseBrush).height),
        },
        $heightMask: {
            type: "textField",
            name: "%worldedit.config.mask.height",
            placeholder: "Eg: grass,stone %gametest.optionalPrefix",
            default: (ctx, player) => {
                if (ctx.getData("creatingTool")) return "";
                return (getToolProperty(ctx, player, "brush") as RaiseBrush).heightMask?.toJSON() ?? "";
            },
        },
        $falloffAmount: {
            type: "slider",
            name: "%worldedit.config.falloff.amount",
            min: 0,
            max: 100,
            default: (ctx, player) => (ctx.getData("creatingTool") ? 0 : (getToolProperty(ctx, player, "brush") as RaiseBrush).falloffAmount * 100),
        },
        $falloffType: {
            type: "dropdown",
            name: "%worldedit.config.falloff.type",
            options: [
                "%worldedit.config.falloff.type.linear",
                "%worldedit.config.falloff.type.in_quad",
                "%worldedit.config.falloff.type.out_quad",
                "%worldedit.config.falloff.type.in_out_quad",
                "%worldedit.config.falloff.type.in_cubic",
                "%worldedit.config.falloff.type.out_cubic",
                "%worldedit.config.falloff.type.in_out_cubic",
                "%worldedit.config.falloff.type.in_quart",
                "%worldedit.config.falloff.type.out_quart",
                "%worldedit.config.falloff.type.in_out_quart",
                "%worldedit.config.falloff.type.in_quint",
                "%worldedit.config.falloff.type.out_quint",
                "%worldedit.config.falloff.type.in_out_quint",
                "%worldedit.config.falloff.type.in_sine",
                "%worldedit.config.falloff.type.out_sine",
                "%worldedit.config.falloff.type.in_out_sine",
                "%worldedit.config.falloff.type.in_expo",
                "%worldedit.config.falloff.type.out_expo",
                "%worldedit.config.falloff.type.in_out_expo",
                "%worldedit.config.falloff.type.in_circ",
                "%worldedit.config.falloff.type.out_circ",
                "%worldedit.config.falloff.type.in_out_circ",
                "%worldedit.config.falloff.type.in_back",
                "%worldedit.config.falloff.type.out_back",
                "%worldedit.config.falloff.type.in_out_back",
                "%worldedit.config.falloff.type.in_elastic",
                "%worldedit.config.falloff.type.out_elastic",
                "%worldedit.config.falloff.type.in_out_elastic",
                "%worldedit.config.falloff.type.in_bounce",
                "%worldedit.config.falloff.type.out_bounce",
                "%worldedit.config.falloff.type.in_out_bounce",
            ],
            default: (ctx, player) => (ctx.getData("creatingTool") ? 0 : Object.keys(easingsFunctions).indexOf((getToolProperty(ctx, player, "brush") as RaiseBrush).falloffType.type)),
        },
        ...usePickerInput,
    },
    submit: (ctx, player, input) => {
        const heightMask = verifyMask(<string>input.$heightMask);
        if (typeof heightMask === "string") return ctx.error(heightMask);

        const brush = new RaiseBrush(
            input.$size as number,
            input.$height as number,
            heightMask,
            new Easing(Object.keys(easingsFunctions)[input.$falloffType as number]),
            (input.$falloffAmount as number) / 100
        );

        if (input.$usePicker) {
            ctx.setData("pickerData", {
                return: "$editTool_raise_brush",
                onFinish: (ctx, _, mask) => {
                    ctx.setData("toolData", [brush, mask, null, null]);
                    finishToolEdit(ctx);
                },
            });
            HotbarUI.goto("$pickMask", player, ctx);
        } else {
            const mask = verifyMask(<string>input.$mask);
            if (typeof mask === "string") return ctx.error(mask);
            ctx.setData("toolData", [brush, mask, null, null]);
            finishToolEdit(ctx);
        }
    },
    cancel: (ctx) => ctx.returnto("$tools"),
});

Server.uiForms.register<ConfigContext>("$selectToolType", {
    title: "%worldedit.config.choose.tool",
    buttons: [
        {
            text: "%worldedit.config.tool.selection",
            icon: "textures/ui/selection_wand",
            action: (ctx) => {
                ctx.setData("creatingTool", "selection_wand");
                finishToolEdit(ctx);
            },
        },
        {
            text: "%worldedit.config.tool.far_selection",
            icon: "textures/ui/far_selection_wand",
            action: (ctx) => {
                ctx.setData("creatingTool", "far_selection_wand");
                finishToolEdit(ctx);
            },
        },
        {
            text: "%worldedit.config.tool.navigation",
            icon: "textures/ui/navigation_wand",
            action: (ctx) => {
                ctx.setData("creatingTool", "navigation_wand");
                finishToolEdit(ctx);
            },
        },
        {
            text: "%worldedit.config.tool.stacker",
            icon: "textures/ui/stacker_wand",
            action: (ctx) => {
                ctx.setData("creatingTool", "stacker_wand");
                ctx.goto("$editTool_stacker_wand");
            },
        },
        {
            text: "%worldedit.config.tool.extruder",
            icon: "textures/ui/extruder_wand",
            action: (ctx) => {
                ctx.setData("creatingTool", "extruder_wand");
                ctx.goto("$editTool_extruder_wand");
            },
        },
        {
            text: "%worldedit.config.tool.cmd",
            icon: "textures/ui/command_wand",
            action: (ctx) => {
                ctx.setData("creatingTool", "command_wand");
                ctx.goto("$editTool_command_wand");
            },
        },
        {
            text: "%worldedit.config.tool.repl",
            icon: "textures/ui/replacer_wand",
            action: (ctx) => {
                ctx.setData("creatingTool", "replacer_wand");
                ctx.goto("$editTool_replacer_wand");
            },
        },
        {
            text: "%worldedit.config.tool.cycle",
            icon: "textures/ui/cycler_wand",
            action: (ctx) => {
                ctx.setData("creatingTool", "cycler_wand");
                finishToolEdit(ctx);
            },
        },
    ],
    cancel: (ctx) => ctx.returnto("$tools"),
});

Server.uiForms.register<ConfigContext>("$selectBrushType", {
    title: "%worldedit.config.choose.brush",
    buttons: [
        {
            text: "%worldedit.config.brush.sphere",
            icon: "textures/ui/sphere_brush",
            action: (ctx) => {
                ctx.setData("creatingTool", "sphere_brush");
                ctx.goto("$editTool_sphere_brush");
            },
        },
        {
            text: "%worldedit.config.brush.cylinder",
            icon: "textures/ui/cylinder_brush",
            action: (ctx) => {
                ctx.setData("creatingTool", "cylinder_brush");
                ctx.goto("$editTool_cylinder_brush");
            },
        },
        {
            text: "%worldedit.config.brush.smooth",
            icon: "textures/ui/smooth_brush",
            action: (ctx) => {
                ctx.setData("creatingTool", "smooth_brush");
                ctx.goto("$editTool_smooth_brush");
            },
        },
        {
            text: "%worldedit.config.brush.struct",
            icon: "textures/ui/structure_brush",
            action: (ctx) => {
                ctx.setData("creatingTool", "structure_brush");
                ctx.goto("$editTool_structure_brush");
            },
        },
        {
            text: "%worldedit.config.brush.erode",
            icon: "textures/ui/erosion_brush",
            action: (ctx) => {
                ctx.setData("creatingTool", "erosion_brush");
                ctx.goto("$editTool_erosion_brush");
            },
        },
        {
            text: "%worldedit.config.brush.overlay",
            icon: "textures/ui/overlay_brush",
            action: (ctx) => {
                ctx.setData("creatingTool", "overlay_brush");
                ctx.goto("$editTool_overlay_brush");
            },
        },
        {
            text: "%worldedit.config.brush.raise",
            icon: "textures/ui/raise_brush",
            action: (ctx) => {
                ctx.setData("creatingTool", "raise_brush");
                ctx.goto("$editTool_raise_brush");
            },
        },
    ],
    cancel: (ctx) => ctx.returnto("$tools"),
});

Server.uiForms.register<ConfigContext>("$confirmToolBind", {
    title: "%worldedit.config.confirm",
    message: "%worldedit.config.confirm.create",
    button1: {
        text: "%dr.button.ok",
        action: (ctx, player) => {
            const session = ctx.getData("session");
            const toolType = getToolType(ctx, player);
            const item = ctx.getData("currentItem");
            const toolData = ctx.getData("toolData") ?? [];

            if (toolType.endsWith("brush")) {
                session.bindTool("brush", item, toolData[0], toolData[1]);
                Tools.setProperty(item, player.id, "range", toolData[2]);
                Tools.setProperty(item, player.id, "traceMask", toolData[3]);
            } else {
                session.bindTool(toolType, item, ...toolData);
            }
            ctx.returnto("$tools");
        },
    },
    button2: {
        text: "%gui.cancel",
        action: (ctx) => ctx.returnto("$tools"),
    },
    cancel: (ctx) => ctx.returnto("$tools"),
});

Server.uiForms.register<ConfigContext>("$confirmDelete", {
    title: "%worldedit.config.confirm",
    message: (ctx) => {
        const deleting = ctx.getData("deletingTools");
        const message: RawMessage[] = [{ translate: "worldedit.config.confirm.delete" }];
        for (const item of deleting) message.push({ text: "\n" }, displayItem(item));
        return { rawtext: message };
    },
    button1: {
        text: "%dr.button.ok",
        action: (ctx) => {
            const session = ctx.getData("session");
            for (const item of ctx.getData("deletingTools")) {
                session.unbindTool(item);
            }
            ctx.returnto("$tools");
        },
    },
    button2: {
        text: "%gui.cancel",
        action: (ctx) => ctx.returnto("$tools"),
    },
    cancel: (ctx) => ctx.returnto("$tools"),
});

Server.uiForms.register<ConfigContext>("$deleteTools", {
    title: "%gui.delete",
    inputs: (ctx, player) => {
        const toggles: ModalFormInput = {};
        for (const tool of getTools(player, ctx.getData("editingBrush"))) {
            toggles[`$${tool}`] = {
                name: displayItem(tool),
                type: "toggle",
            };
        }
        return toggles;
    },
    submit: (ctx, _, input) => {
        const toDelete: string[] = [];
        for (const [key, value] of Object.entries(input)) {
            if (value) {
                const id = key.slice(1);
                toDelete.push(id);
            }
        }
        if (toDelete.length) {
            ctx.setData("deletingTools", toDelete);
            ctx.goto("$confirmDelete");
        } else {
            ctx.returnto("$tools");
        }
    },
    cancel: (ctx) => ctx.returnto("$tools"),
});
