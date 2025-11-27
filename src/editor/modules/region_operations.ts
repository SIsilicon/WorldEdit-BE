/* eslint-disable prefer-const */
import { IPlayerUISession } from "@minecraft/server-editor";
import { UIPane } from "editor/pane/builder";
import { EditorModule } from "./base";
import { Pattern } from "@modules/pattern";
import { Server } from "@notbeer-api";
import { PatternUIBuilder } from "editor/pane/pattern";
import { MaskUIBuilder } from "editor/pane/mask";
import { Mask } from "@modules/mask";

export class RegionOpModule extends EditorModule {
    private pane: UIPane;

    constructor(session: IPlayerUISession) {
        super(session);
        const tool = session.toolRail.addTool("worldedit:region_operations", { title: "WorldEdit Region Operations" });
        const patternUIBuilder = new PatternUIBuilder(new Pattern("stone"));
        const maskUIBuilder = new MaskUIBuilder(new Mask("air"));
        let enableMask = false;
        let mode = 0;

        this.pane = new UIPane(this.session, {
            title: "Region Operations",
            items: [
                {
                    type: "dropdown",
                    title: "Mode",
                    value: mode,
                    entries: [
                        { label: "Fill Selection", value: 0 },
                        { label: "Outline Selection", value: 1 },
                        { label: "Wall Selection", value: 2 },
                    ],
                    onChange: (value) => {
                        mode = value;
                        const usePatternAndMask = mode >= 0 && mode <= 2;
                        this.pane.getSubPane("pattern").visible = usePatternAndMask;
                        this.pane.getSubPane("mask").visible = usePatternAndMask;
                    },
                },
                {
                    type: "button",
                    title: "Execute Operation",
                    enable: this.canOperate(),
                    pressed: () => {
                        const mode = this.pane.getValue(0) as number;
                        if (mode >= 0 && mode <= 2) {
                            const args = new Map<string, any>([
                                ["pattern", patternUIBuilder.pattern],
                                ["mask", enableMask ? maskUIBuilder.mask : new Mask()],
                            ]);
                            const command = mode === 0 ? "replace" : mode === 1 ? "faces" : mode === 2 ? "walls" : "";
                            Server.command.getRegistration(command).callback(this.player, "editor-callback", args);
                        }
                    },
                },
                {
                    type: "subpane",
                    title: "Pattern",
                    uniqueId: "pattern",
                    items: patternUIBuilder,
                },
                {
                    type: "subpane",
                    title: "Mask",
                    uniqueId: "mask",
                    items: [
                        {
                            type: "toggle",
                            title: "Enable Mask",
                            value: enableMask,
                            onChange: (value) => {
                                enableMask = value;
                                const pane = this.pane.getSubPane("mask").getSubPane(1);
                                if (value) maskUIBuilder.build(pane);
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
    }

    private canOperate() {
        return !this.session.extensionContext.selectionManager.volume.isEmpty;
    }

    private onSelectionChange = () => {
        this.pane.setEnabled(1, this.canOperate());
    };
}
