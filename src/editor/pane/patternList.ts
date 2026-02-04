import { Pattern, patternsFromSelection } from "@modules/pattern";
import { PaneBuilder, UIPane } from "./builder";
import { PatternUIBuilder } from "./pattern";
import { EventEmitter } from "library/classes/eventEmitter";
import { Player } from "@minecraft/server";
import { getSession } from "server/sessions";

export class PatternListUIBuilder extends EventEmitter<{ changed: [] }> implements PaneBuilder {
    private builders: PatternUIBuilder[] = [];
    private panes = new Set<UIPane>();
    private player: Player;

    constructor(patterns: Pattern[], player: Player) {
        super();
        this.patterns = patterns;
        this.player = player;
    }

    get patterns() {
        return this.builders.map((builder) => builder.pattern);
    }

    set patterns(value: Pattern[]) {
        for (const builder of this.builders) builder.destroy();
        this.builders = value.map((pattern) => new PatternUIBuilder(pattern));
        this.panes.forEach((pane) => this.build(pane));
    }

    build(pane: UIPane) {
        this.panes.add(pane);
        const eachSubPane = (callback: (pane: UIPane, index: number) => void) => {
            Object.values(patternPane.getAllSubPanes()).forEach((pane, index) => callback(pane, index));
        };

        const updateSubPanes = () => {
            eachSubPane((pane, index) => {
                pane.setVisibility(1, this.builders.length > 1);
                pane.title = `Pattern ${index + 1}`;
            });
        };

        const addPatternUI = (pane: UIPane, index: number, builder: PatternUIBuilder) => {
            const subPane = pane.addSubPane({
                title: `Pattern ${index + 1}`,
                items: [
                    { type: "subpane", hasExpander: false, hasMargins: false, items: builder },
                    {
                        type: "button",
                        title: "Remove Pattern",
                        variant: 3,
                        visible: this.builders.length > 1,
                        pressed: () => {
                            pane.removeSubPane(subPane);
                            const [builder] = this.builders.splice(index, 1);
                            builder.destroy();
                            updateSubPanes();
                            this.emit("changed");
                        },
                    },
                ],
            });
        };

        pane.changeItems([
            { type: "subpane", hasExpander: false, hasMargins: false, items: [] },
            {
                type: "button",
                title: "Add Pattern",
                pressed: () => {
                    const builder = new PatternUIBuilder(new Pattern("stone"));
                    builder.on("changed", () => this.emit("changed"));
                    this.builders.push(builder);
                    addPatternUI(patternPane, this.builders.length - 1, builder);
                    updateSubPanes();
                    this.emit("changed");
                },
            },
            {
                type: "button",
                title: "Generate Patterns from Selection",
                pressed: () => {
                    const selection = getSession(this.player).selection;
                    if (!selection.isEmpty) this.patterns = patternsFromSelection(selection);
                },
            },
        ]);

        const patternPane = pane.getSubPane(0);
        for (let i = 0; i < this.builders.length; i++) addPatternUI(patternPane, i, this.builders[i]);
        updateSubPanes();
    }
}
