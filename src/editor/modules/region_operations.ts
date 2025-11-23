/* eslint-disable prefer-const */
import { IPlayerUISession } from "@minecraft/server-editor";
import { UIPane } from "editor/pane/builder";
import { EditorModule } from "./base";
import { Pattern } from "@modules/pattern";
import { Server } from "@notbeer-api";
import { PatternUIBuilder } from "editor/pane/pattern";

export class RegionOpModule extends EditorModule {
    private pane: UIPane;

    constructor(session: IPlayerUISession) {
        super(session);
        const tool = session.toolRail.addTool("worldedit:region_operations", { title: "WorldEdit Region Operations" });
        const patternUIBuilder = new PatternUIBuilder(new Pattern("stone"));
        this.pane = new UIPane(this.session, {
            title: "Region Operations",
            items: [
                {
                    type: "dropdown",
                    title: "Mode",
                    value: 0,
                    entries: [
                        { label: "Fill Selection", value: 0 },
                        { label: "Outline Selection", value: 1 },
                        { label: "Wall Selection", value: 2 },
                    ],
                },
                {
                    type: "button",
                    title: "Execute Operation",
                    enable: this.canOperate(),
                    pressed: () => {
                        const mode = this.pane.getValue(0);
                        if (mode === 0) Server.command.getRegistration("set").callback(this.player, "editor-pattern", new Map([["pattern", patternUIBuilder.pattern]]));
                        else if (mode === 1) Server.command.getRegistration("faces").callback(this.player, "editor-pattern", new Map([["pattern", patternUIBuilder.pattern]]));
                        else if (mode === 2) Server.command.getRegistration("walls").callback(this.player, "editor-pattern", new Map([["pattern", patternUIBuilder.pattern]]));
                    },
                },
                {
                    type: "subpane",
                    title: "Pattern",
                    items: patternUIBuilder,
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
