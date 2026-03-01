/* eslint-disable prefer-const */
import { IPlayerUISession, ProgressIndicatorPropertyItemVariant, Widget, WidgetComponentClipboard, WidgetGroupSelectionMode } from "@minecraft/server-editor";
import { UIPane } from "editor/pane/builder";
import { EditorModule } from "./base";
import { Pattern } from "@modules/pattern";
import { regionSize, Server, Thread, Vector } from "@notbeer-api";
import { PatternUIBuilder } from "editor/pane/pattern";
import { MaskUIBuilder } from "editor/pane/mask";
import { Mask } from "@modules/mask";
import { Cardinal, CardinalDirection } from "@modules/directions";
import { getSession } from "server/sessions";
import { system } from "@minecraft/server";
import { Jobs } from "@modules/jobs";

enum RegionOperatorMode {
    Fill,
    Outline,
    Wall,
    Stack,
    Move,
    Smooth,
}

const directions = Object.values(CardinalDirection);

export class RegionOpModule extends EditorModule {
    private pane: UIPane;
    private widget: Widget;
    private widgetComponents: WidgetComponentClipboard[] = [];

    private tickId: number;
    private thread?: Thread;

    private direction = CardinalDirection.Forward;
    private distance = 5;
    private stackCount = 1;
    private iterations = 1;
    private mode = RegionOperatorMode.Fill;

    private readonly patternUIBuilder = new PatternUIBuilder(new Pattern("stone"));
    private readonly maskUIBuilder = new MaskUIBuilder(new Mask("air"));
    private readonly heightMaskUIBuilder = new MaskUIBuilder(new Mask("#surface"));

    constructor(session: IPlayerUISession) {
        super(session);
        const tool = session.toolRail.addTool("worldedit:region_operations", { title: "WorldEdit Region Operations", icon: "pack://textures/editor/region_operations_tool.png" });
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
                        { label: "Smooth Selection", value: RegionOperatorMode.Smooth },
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
                    pressed: this.performOperation.bind(this),
                },
                { type: "progress", uniqueId: "operationProgress", variant: ProgressIndicatorPropertyItemVariant.ProgressBar, visible: false },
                { type: "divider" },
                {
                    type: "dropdown",
                    title: "Direction",
                    uniqueId: "direction",
                    entries: directions.map((dir, index) => ({ label: dir, value: index })),
                    value: directions.indexOf(CardinalDirection.Forward),
                    onChange: (value) => {
                        this.direction = directions[value];
                        this.updateWidgets();
                    },
                },
                {
                    type: "slider",
                    title: "Distance",
                    uniqueId: "distance",
                    min: 1,
                    value: 5,
                    isInteger: true,
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
                    isInteger: true,
                    onChange: (value) => {
                        this.stackCount = value;
                        this.updateWidgets();
                    },
                },
                {
                    type: "slider",
                    title: "Iterations",
                    uniqueId: "iterations",
                    min: 1,
                    value: 1,
                    isInteger: true,
                    onChange: (value) => {
                        this.iterations = value;
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
                    items: this.maskUIBuilder,
                },
                {
                    type: "subpane",
                    title: "Height Mask",
                    uniqueId: "heightMask",
                    items: this.heightMaskUIBuilder,
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

            if (this.thread && !this.thread.isActive) this.thread = undefined;
            const job = this.thread ? Jobs.getJobsForThread(this.thread)[0] : undefined;
            if (job) {
                this.pane.setVisibility("operationProgress", true);
                this.pane.setValue("operationProgress", Jobs.getProgress(job));
            } else {
                this.pane.setVisibility("operationProgress", false);
            }
        }, 2);
    }

    teardown() {
        system.clearRun(this.tickId);
    }

    private performOperation() {
        if (this.usesPatternAndMask()) {
            const args = new Map<string, any>([
                ["pattern", this.patternUIBuilder.value],
                ["mask", this.maskUIBuilder.value],
            ]);
            const command = {
                [RegionOperatorMode.Fill]: "replace",
                [RegionOperatorMode.Outline]: "faces",
                [RegionOperatorMode.Wall]: "walls",
            }[this.mode];
            this.thread = Server.command.getRegistration(command).callback(this.player, "editor-callback", args);
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
            this.thread = Server.command.getRegistration("move").callback(
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
        } else if (this.mode === RegionOperatorMode.Smooth) {
            this.thread = Server.command.getRegistration("smooth").callback(
                this.player,
                "editor-callback",
                new Map(
                    Object.entries({
                        iterations: this.iterations,
                        mask: this.heightMaskUIBuilder.value,
                    })
                )
            );
        }
    }

    private updatePane() {
        this.pane.setVisibility("direction", this.mode === RegionOperatorMode.Stack || this.mode === RegionOperatorMode.Move);
        this.pane.setVisibility("distance", this.mode === RegionOperatorMode.Move);
        this.pane.setVisibility("stackCount", this.mode === RegionOperatorMode.Stack);
        this.pane.setVisibility("iterations", this.mode === RegionOperatorMode.Smooth);
        this.pane.getSubPane("pattern").visible = this.usesPatternAndMask();
        this.pane.getSubPane("mask").visible = this.usesPatternAndMask();
        this.pane.getSubPane("heightMask").visible = this.mode === RegionOperatorMode.Smooth;
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
