import { Player } from "@minecraft/server";
import { PlayerSession } from "../../sessions.js";
import { SphereBrush } from "../../brushes/sphere_brush.js";
import { CylinderBrush } from "../../brushes/cylinder_brush.js";
import { SmoothBrush } from "../../brushes/smooth_brush.js";
import { assertClipboard, assertPermission } from "@modules/assert.js";
import { Mask } from "@modules/mask.js";
import { Pattern } from "@modules/pattern.js";
import { CommandInfo, RawText } from "@notbeer-api";
import { registerCommand } from "../register_commands.js";
import { StructureBrush } from "server/brushes/structure_brush.js";
import { ErosionBrush, ErosionType } from "server/brushes/erosion_brush.js";
import { OverlayBrush } from "server/brushes/overlay_brush.js";
import { BlobBrush } from "server/brushes/blob_brush.js";
import { commandSubDef } from "library/@types/classes/CommandBuilder.js";
import { RaiseBrush } from "server/brushes/raise_brush.js";
import { Easing } from "@modules/easing.js";

const registerInformation: CommandInfo = {
    name: "brush",
    description: "commands.wedit:brush.description",
    aliases: ["br"],
    usage: [
        { subName: "none" },
        {
            subName: "sphere",
            permission: "worldedit.brush.sphere",
            description: "commands.wedit:brush.description.sphere",
            args: [{ flag: "h" }, { name: "pattern", type: "Pattern" }, { name: "radius", type: "float", default: 3 }],
        },
        {
            subName: "cyl",
            permission: "worldedit.brush.cylinder",
            description: "commands.wedit:brush.description.cylinder",
            args: [{ flag: "h" }, { name: "pattern", type: "Pattern" }, { name: "radius", type: "float", default: 3 }, { name: "height", type: "int", default: 3 }],
        },
        {
            subName: "smooth",
            permission: "worldedit.brush.smooth",
            description: "commands.wedit:brush.description.smooth",
            args: [
                { name: "radius", type: "float", default: 2 },
                { name: "iterations", type: "int", default: 4 },
                { name: "mask", type: "Mask", default: new Mask() },
            ],
        },
        {
            subName: "raise",
            permission: "worldedit.brush.raise",
            description: "commands.wedit:brush.description.raise",
            args: [
                { name: "radius", type: "float", default: 3 },
                { name: "height", type: "int", default: 1 },
                {
                    subName: "falloff",
                    args: [
                        { name: "falloffAmount", type: "float", range: [0, 1] },
                        { name: "falloffType", type: "Easing", default: new Easing() },
                    ],
                },
                {
                    subName: "_",
                    args: [],
                },
                { flag: "m", name: "mask", type: "Mask" },
            ],
        },
        {
            subName: "struct",
            permission: "worldedit.brush.struct",
            description: "commands.wedit:brush.description.struct",
            args: [
                {
                    subName: "clipboard",
                    args: [{ name: "mask", type: "Mask", default: new Mask() }],
                },
                {
                    subName: "_",
                    args: [{ name: "structureName", type: "string..." }],
                },
            ],
        },
        {
            subName: "erode",
            permission: "worldedit.brush.erode",
            description: "commands.wedit:brush.description.erode",
            args: [
                {
                    subName: "_",
                    args: [{ name: "radius", type: "float", default: 3 }],
                },
                {
                    subName: "lift",
                    args: [{ name: "radius", type: "float", default: 3 }],
                },
                {
                    subName: "fill",
                    args: [{ name: "radius", type: "float", default: 3 }],
                },
                {
                    subName: "melt",
                    args: [{ name: "radius", type: "float", default: 3 }],
                },
                {
                    subName: "smooth",
                    args: [{ name: "radius", type: "float", default: 3 }],
                },
            ],
        },
        {
            subName: "overlay",
            permission: "worldedit.brush.overlay",
            description: "commands.wedit:brush.description.overlay",
            args: [
                { name: "pattern", type: "Pattern" },
                { name: "radius", type: "float", default: 3 },
                { name: "depth", type: "int", default: 1 },
                { name: "mask", type: "Mask", default: new Mask() },
            ],
        },
        {
            subName: "blob",
            permission: "worldedit.brush.blob",
            description: "commands.wedit:brush.description.blob",
            args: [
                { name: "pattern", type: "Pattern" },
                { name: "radius", type: "float", default: 3 },
                { name: "growPercent", type: "int", default: 50, range: [1, 99] },
                { name: "smoothness", type: "int", default: 0, range: [0, 6] },
            ],
        },
    ],
};

export function createDefaultBrush() {
    return new SphereBrush(1, new Pattern("cobblestone"), false);
}

const sphereSubCommand = (session: PlayerSession, builder: Player, args: Map<string, any>) => {
    assertPermission(builder, (<commandSubDef>registerInformation.usage[1]).permission!);
    session.bindTool("brush", null, new SphereBrush(args.get("radius"), args.get("pattern"), args.get("h")));
    return RawText.translate("commands.wedit:brush.bind.sphere").with(args.get("radius"));
};

const cylinderSubCommand = (session: PlayerSession, builder: Player, args: Map<string, any>) => {
    assertPermission(builder, (<commandSubDef>registerInformation.usage[2]).permission);
    session.bindTool("brush", null, new CylinderBrush(args.get("radius"), args.get("height"), args.get("pattern"), args.get("h")));
    return RawText.translate("commands.wedit:brush.bind.cylinder").with(args.get("radius")).with(args.get("height"));
};

const smoothSubCommand = (session: PlayerSession, builder: Player, args: Map<string, any>) => {
    assertPermission(builder, (<commandSubDef>registerInformation.usage[3]).permission);
    session.bindTool("brush", null, new SmoothBrush(args.get("radius"), args.get("iterations"), args.get("mask")));

    const msg = "commands.wedit:brush.bind.smooth." + ((args.get("mask") as Mask).empty() ? "noFilter" : "filter");
    return RawText.translate(msg).with(args.get("radius")).with(args.get("iterations"));
};

const raiseSubCommand = (session: PlayerSession, builder: Player, args: Map<string, any>) => {
    assertPermission(builder, (<commandSubDef>registerInformation.usage[4]).permission);
    const heightMask = args.get("m-mask") ?? new Mask();
    const falloffType = args.get("falloffType") ?? new Easing();
    const falloffAmount = args.get("falloffAmount") ?? 0;
    session.bindTool("brush", null, new RaiseBrush(args.get("radius"), args.get("height"), heightMask, falloffType, falloffAmount));

    const msg = "commands.wedit:brush.bind.raise." + (heightMask.empty() ? "noFilter" : "filter");
    return RawText.translate(msg).with(args.get("radius"));
};

const structSubCommand = (session: PlayerSession, builder: Player, args: Map<string, any>) => {
    assertPermission(builder, (<commandSubDef>registerInformation.usage[5]).permission);
    const clipboard = args.has("clipboard");
    if (clipboard) assertClipboard(session);

    session.bindTool("brush", null, new StructureBrush(clipboard ? session.clipboard : (args.get("structureName") as string[]), args.get("mask")));
    const msg = "commands.wedit:brush.bind." + (clipboard ? "clipboard" : "struct");
    return RawText.translate(msg).with(args.get("structureName"));
};

const erodeSubCommand = (session: PlayerSession, builder: Player, args: Map<string, any>) => {
    assertPermission(builder, (<commandSubDef>registerInformation.usage[6]).permission);

    let type = ErosionType.DEFAULT;
    if (args.has("lift")) type = ErosionType.LIFT;
    else if (args.has("fill")) type = ErosionType.FILL;
    else if (args.has("melt")) type = ErosionType.MELT;
    else if (args.has("smooth")) type = ErosionType.SMOOTH;

    session.bindTool("brush", null, new ErosionBrush(args.get("radius"), type));
    session.setToolProperty(null, "traceMask", new Mask("!water,air,lava"));
    return RawText.translate("commands.wedit:brush.bind.erode").with(args.get("radius"));
};

const overlaySubCommand = (session: PlayerSession, builder: Player, args: Map<string, any>) => {
    assertPermission(builder, (<commandSubDef>registerInformation.usage[7]).permission);
    session.bindTool("brush", null, new OverlayBrush(args.get("radius"), args.get("depth"), args.get("pattern"), args.get("mask")));
    session.setToolProperty(null, "traceMask", new Mask("!water,air,lava"));
    return RawText.translate("commands.wedit:brush.bind.overlay").with(args.get("radius"));
};

const blobSubCommand = (session: PlayerSession, builder: Player, args: Map<string, any>) => {
    assertPermission(builder, (<commandSubDef>registerInformation.usage[8]).permission);
    session.bindTool("brush", null, new BlobBrush(args.get("radius"), args.get("pattern"), args.get("growPercent"), args.get("smoothness")));
    session.setToolProperty(null, "traceMask", new Mask("!water,air,lava"));
    return RawText.translate("commands.wedit:brush.bind.blob").with(args.get("radius"));
};

registerCommand(registerInformation, function (session, builder, args) {
    let msg: RawText;
    if (args.has("erode")) {
        msg = erodeSubCommand(session, builder, args);
    } else if (args.has("sphere")) {
        msg = sphereSubCommand(session, builder, args);
    } else if (args.has("cyl")) {
        msg = cylinderSubCommand(session, builder, args);
    } else if (args.has("smooth")) {
        msg = smoothSubCommand(session, builder, args);
    } else if (args.has("raise")) {
        msg = raiseSubCommand(session, builder, args);
    } else if (args.has("struct")) {
        msg = structSubCommand(session, builder, args);
    } else if (args.has("overlay")) {
        msg = overlaySubCommand(session, builder, args);
    } else if (args.has("blob")) {
        msg = blobSubCommand(session, builder, args);
    } else {
        session.unbindTool(null);
        return "commands.wedit:brush.unbind";
    }
    return msg.append("text", "\n").append("translate", "commands.generic.wedit:unbindInfo").with(";brush none");
});
