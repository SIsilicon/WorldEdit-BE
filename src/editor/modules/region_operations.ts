/* eslint-disable prefer-const */
import { IPlayerUISession, Widget, WidgetComponentClipboard, WidgetGroupSelectionMode } from "@minecraft/server-editor";
import { UIPane } from "editor/pane/builder";
import { EditorModule } from "./base";
import { Pattern } from "@modules/pattern";
import { regionSize, Server, Vector } from "@notbeer-api";
import { PatternUIBuilder } from "editor/pane/pattern";
import { MaskUIBuilder } from "editor/pane/mask";
import { Mask } from "@modules/mask";
import { Cardinal } from "@modules/directions";
import { getSession } from "server/sessions";
import { system } from "@minecraft/server";

enum RegionOperatorMode {
    Fill,
    Outline,
    Wall,
    Stack,
    Move,
}

const directions = Object.keys(Cardinal.Dir);
// Object.keys on an enum returns not just the enumerators, but there number equivalent.
// Removing those with splice()
directions.splice(0, directions.length / 2);

export class RegionOpModule extends EditorModule {
    private pane: UIPane;
    private widget: Widget;
    private widgetComponents: WidgetComponentClipboard[] = [];

    private tickId: number;

    private enableMask = false;
    private direction = Cardinal.Dir.FORWARD;
    private distance = 5;
    private stackCount = 1;
    private mode = RegionOperatorMode.Fill;

    private readonly patternUIBuilder = new PatternUIBuilder(new Pattern("stone"));
    private readonly maskUIBuilder = new MaskUIBuilder(new Mask("air"));

    constructor(session: IPlayerUISession) {
        super(session);
        const tool = session.toolRail.addTool("worldedit:region_operations", { title: "WorldEdit Region Operations" });
        const widgetGroup = session.extensionContext.widgetManager.createGroup({ groupSelectionMode: WidgetGroupSelectionMode.None, visible: true });

        this.widget = widgetGroup.createWidget(Vector.ZERO, { visible: true });

        this.pane = new UIPane(this.session, {
            title: "Region Operations",
            items: [
                {
                    type: "dropdown",
                    title: "Mode",
                    value: this.mode,
                    entries: [
                        { label: "Fill Selection", value: RegionOperatorMode.Fill },
                        { label: "Outline Selection", value: RegionOperatorMode.Outline },
                        { label: "Wall Selection", value: RegionOperatorMode.Wall },
                        { label: "Stack Selection", value: RegionOperatorMode.Stack },
                        { label: "Move Selection", value: RegionOperatorMode.Move },
                    ],
                    onChange: (value) => {
                        this.mode = value;
                        this.updatePane();
                    },
                },
                {
                    type: "button",
                    title: "Execute Operation",
                    enable: this.canOperate(),
                    pressed: () => {
                        if (this.usesPatternAndMask()) {
                            const args = new Map<string, any>([
                                ["pattern", this.patternUIBuilder.pattern],
                                ["mask", this.enableMask ? this.maskUIBuilder.mask : new Mask()],
                            ]);
                            const command = {
                                [RegionOperatorMode.Fill]: "replace",
                                [RegionOperatorMode.Outline]: "faces",
                                [RegionOperatorMode.Wall]: "walls",
                            }[this.mode];
                            Server.command.getRegistration(command).callback(this.player, "editor-callback", args);
                        } else if (this.mode === RegionOperatorMode.Stack) {
                            Server.command.getRegistration("stack").callback(
                                this.player,
                                "editor-callback",
                                new Map(
                                    Object.entries({
                                        a: true,
                                        count: this.stackCount,
                                        offset: new Cardinal(this.direction),
                                    })
                                )
                            );
                        } else if (this.mode === RegionOperatorMode.Move) {
                            Server.command.getRegistration("move").callback(
                                this.player,
                                "editor-callback",
                                new Map(
                                    Object.entries({
                                        a: true,
                                        amount: this.distance,
                                        offset: new Cardinal(this.direction),
                                    })
                                )
                            );
                        }
                    },
                },
                { type: "divider" },
                {
                    type: "dropdown",
                    title: "Direction",
                    uniqueId: "direction",
                    entries: directions.map((dir, index) => ({ label: dir, value: index })),
                    value: Cardinal.Dir.FORWARD,
                    onChange: (value) => {
                        this.direction = value;
                        this.updateWidgets();
                    },
                },
                {
                    type: "slider",
                    title: "Distance",
                    uniqueId: "distance",
                    min: 1,
                    value: 5,
                    onChange: (value) => {
                        this.distance = value;
                        this.updateWidgets();
                    },
                },
                {
                    type: "slider",
                    title: "Stack Count",
                    uniqueId: "stackCount",
                    min: 1,
                    value: 1,
                    onChange: (value) => {
                        this.stackCount = value;
                        this.updateWidgets();
                    },
                },
                {
                    type: "subpane",
                    title: "Pattern",
                    uniqueId: "pattern",
                    items: this.patternUIBuilder,
                },
                {
                    type: "subpane",
                    title: "Mask",
                    uniqueId: "mask",
                    items: [
                        {
                            type: "toggle",
                            title: "Enable Mask",
                            value: this.enableMask,
                            onChange: (value) => {
                                this.enableMask = value;
                                const pane = this.pane.getSubPane("mask").getSubPane(1);
                                if (value) this.maskUIBuilder.build(pane);
                                else pane.changeItems([]);
                            },
                        },
                        {
                            type: "subpane",
                            hasMargins: false,
                            hasExpander: false,
                            items: [],
                        },
                    ],
                },
            ],
        });
        this.pane.bindToTool(tool);
        this.session.extensionContext.afterEvents.SelectionChange.subscribe(this.onSelectionChange);
        this.updatePane();

        let lastCardinal = new Cardinal(this.direction).getDirection(this.player);
        this.tickId = system.runInterval(() => {
            const cardinal = new Cardinal(this.direction).getDirection(this.player);
            if (!lastCardinal.equals(cardinal)) {
                lastCardinal = cardinal;
                this.updateWidgets();
            }
        }, 2);
    }

    teardown() {
        system.clearRun(this.tickId);
    }

    private updatePane() {
        this.pane.getSubPane("pattern").visible = this.usesPatternAndMask();
        this.pane.getSubPane("mask").visible = this.usesPatternAndMask();
        this.pane.setVisibility("direction", this.mode === RegionOperatorMode.Stack || this.mode === RegionOperatorMode.Move);
        this.pane.setVisibility("distance", this.mode === RegionOperatorMode.Move);
        this.pane.setVisibility("stackCount", this.mode === RegionOperatorMode.Stack);
        this.updateWidgets();
    }

    private updateWidgets() {
        const relativeOffsets: Vector[] = [];
        const direction = new Cardinal(this.direction).getDirection(this.player);
        const selection = getSession(this.player).selection;

        if (selection) {
            if (this.mode === RegionOperatorMode.Move) {
                relativeOffsets.push(direction.mul(this.distance));
            } else if (this.mode === RegionOperatorMode.Stack) {
                const size = regionSize(...getSession(this.player).selection.getRange());
                for (let i = 0; i < this.stackCount; i++) {
                    relativeOffsets.push(direction.mul(i + 1).mul(size));
                }
            }
        }

        for (let i = 0; i < relativeOffsets.length; i++) {
            if (!this.widgetComponents[i]) {
                const selection = this.session.extensionContext.selectionManager.volume;
                const clipboard = this.session.extensionContext.clipboardManager.create();
                clipboard.readFromWorld(selection!.get());
                this.widgetComponents.push(
                    this.widget.addClipboardComponent("region-op-preview" + i, clipboard, {
                        normalizedOrigin: new Vector(-1, -1, -1),
                        showOutline: true,
                        visible: true,
                    })
                );
            }
            this.widgetComponents[i].offset = relativeOffsets[i].add(selection.getRange()[0]);
        }

        while (this.widgetComponents.length > relativeOffsets.length) {
            const component = this.widgetComponents.pop();
            component.delete();
        }

        this.widget.visible = !!this.widgetComponents.length;
    }

    private clearWidgets() {
        while (this.widgetComponents.length) {
            const component = this.widgetComponents.pop();
            component.delete();
        }
    }

    private usesPatternAndMask() {
        return this.mode === RegionOperatorMode.Fill || this.mode === RegionOperatorMode.Outline || this.mode === RegionOperatorMode.Wall;
    }

    private canOperate() {
        return !this.session.extensionContext.selectionManager.volume.isEmpty;
    }

    private onSelectionChange = () => {
        this.pane.setEnabled(1, this.canOperate());
        this.clearWidgets();
        this.updateWidgets();
    };
}
