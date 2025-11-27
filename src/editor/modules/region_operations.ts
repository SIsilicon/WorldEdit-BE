/* eslint-disable prefer-const */
import { IPlayerUISession } from "@minecraft/server-editor";
import { UIPane } from "editor/pane/builder";
import { EditorModule } from "./base";
import { Pattern } from "@modules/pattern";
import { Server } from "@notbeer-api";
import { PatternUIBuilder } from "editor/pane/pattern";
import { MaskUIBuilder } from "editor/pane/mask";
import { Mask } from "@modules/mask";
import { Cardinal } from "@modules/directions";

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
    private readonly patternUIBuilder = new PatternUIBuilder(new Pattern("stone"));
    private readonly maskUIBuilder = new MaskUIBuilder(new Mask("air"));
    private enableMask = false;
    private direction = Cardinal.Dir.FORWARD;
    private distance = 5;
    private stackCount = 1;
    private mode = 0;

    constructor(session: IPlayerUISession) {
        super(session);
        const tool = session.toolRail.addTool("worldedit:region_operations", { title: "WorldEdit Region Operations" });

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
                    onChange: (value) => (this.direction = value),
                },
                {
                    type: "slider",
                    title: "Distance",
                    uniqueId: "distance",
                    min: 1,
                    value: 5,
                    onChange: (value) => (this.distance = value),
                },
                {
                    type: "slider",
                    title: "Stack Count",
                    uniqueId: "stackCount",
                    min: 1,
                    value: 1,
                    onChange: (value) => (this.stackCount = value),
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
    }

    private updatePane() {
        this.pane.getSubPane("pattern").visible = this.usesPatternAndMask();
        this.pane.getSubPane("mask").visible = this.usesPatternAndMask();
        this.pane.setVisibility("direction", this.mode === RegionOperatorMode.Stack || this.mode === RegionOperatorMode.Move);
        this.pane.setVisibility("distance", this.mode === RegionOperatorMode.Move);
        this.pane.setVisibility("stackCount", this.mode === RegionOperatorMode.Stack);
    }

    private usesPatternAndMask() {
        return this.mode === RegionOperatorMode.Fill || this.mode === RegionOperatorMode.Outline || this.mode === RegionOperatorMode.Wall;
    }

    private canOperate() {
        return !this.session.extensionContext.selectionManager.volume.isEmpty;
    }

    private onSelectionChange = () => {
        this.pane.setEnabled(1, this.canOperate());
    };
}
