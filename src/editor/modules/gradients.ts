import { ButtonVariant, IPlayerUISession, makeObservable } from "@minecraft/server-editor";
import { UIPane } from "editor/pane/builder";
import { EditorModule } from "./base";
import { PatternListUIBuilder } from "editor/pane/patternList";
import { Pattern } from "@modules/pattern";

export class GradientsModule extends EditorModule {
    private readonly pane: UIPane;
    private readonly selectedGradientIdx = makeObservable(-1);

    private readonly editPane: UIPane;
    private readonly dithering = makeObservable(0);
    private readonly editPatternList: PatternListUIBuilder;

    private readonly createPane: string;
    private readonly createName = makeObservable("");
    private readonly createDithering = makeObservable(0);
    private readonly createPatternList: PatternListUIBuilder;

    constructor(session: IPlayerUISession) {
        super(session);
        this.editPatternList = new PatternListUIBuilder([], this.player);
        this.createPatternList = new PatternListUIBuilder([], this.player);
        const tool = session.toolRail.addTool("worldedit:gradients", { title: "WorldEdit Gradients", icon: "pack://textures/editor/gradients_tool.png" });
        this.pane = new UIPane(this.session, {
            title: "Gradients",
            items: [
                {
                    type: "dropdown",
                    title: "Select Gradient",
                    uniqueId: "gradient",
                    entries: [],
                    value: this.selectedGradientIdx,
                    onChange: () => this.updateGradientPanel(),
                },
                {
                    type: "button",
                    title: "Create New Gradient",
                    variant: ButtonVariant.Confirmation,
                    pressed: () => {
                        this.createName.set("");
                        this.createDithering.set(0);
                        this.createPatternList.patterns = [new Pattern("stone")];
                        this.pane.showModalPane(this.createPane);
                    },
                },
                {
                    type: "subpane",
                    uniqueId: "editGradient",
                    hasExpander: false,
                    hasMargins: false,

                    items: [
                        { type: "divider" },
                        {
                            type: "slider",
                            title: "Dither",
                            min: 0,
                            max: 1,
                            value: this.dithering,
                            onChange: () => this.saveSelectedGradient(),
                        },
                        {
                            type: "subpane",
                            title: "Patterns",
                            items: this.editPatternList,
                        },
                        { type: "divider" },
                        {
                            type: "button",
                            title: "Delete",
                            variant: ButtonVariant.Destructive,
                            pressed: () => {
                                if (!this.selectedGradientIdx) return;
                                const gradients = this.worldedit.getGradientNames();
                                const gradient = gradients[this.selectedGradientIdx.value];
                                this.worldedit.deleteGradient(gradient);
                            },
                        },
                    ],
                },
            ],
        });
        this.createPane = this.pane.createModalPane({
            items: [
                {
                    type: "text_area",
                    title: "Gradient ID",
                    value: this.createName,
                    onChange: (name) => {
                        this.pane.getSubPane(this.createPane).setEnabled("createGradient", name && !this.worldedit.getGradientNames().includes(name));
                    },
                },
                {
                    type: "slider",
                    title: "Dither",
                    min: 0,
                    max: 1,
                    value: this.createDithering,
                },
                {
                    type: "subpane",
                    title: "Patterns",
                    items: this.createPatternList,
                },
                { type: "divider" },
                {
                    type: "button",
                    title: "Create New Gradient",
                    uniqueId: "createGradient",
                    variant: ButtonVariant.Confirmation,
                    enable: false,
                    pressed: () => {
                        this.worldedit.createGradient(this.createName.value, this.createDithering.value, this.createPatternList.patterns);
                        this.pane.hideModalPane(this.createPane);
                    },
                },
                {
                    type: "button",
                    title: "Cancel",
                    variant: ButtonVariant.Destructive,
                    pressed: () => this.pane.hideModalPane(this.createPane),
                },
            ],
        });
        this.editPane = this.pane.getSubPane("editGradient");

        this.pane.bindToTool(tool);
        this.updateGradientsList();

        this.worldedit.on("gradientListUpdated", () => this.updateGradientsList());
    }

    private get selectedGradient() {
        if (this.selectedGradientIdx.value < 0) return;
        const gradients = this.worldedit.getGradientNames();
        const gradientId = gradients[this.selectedGradientIdx.value];
        return { name: gradientId, ...this.worldedit.getGradient(gradientId) };
    }

    private updateGradientsList() {
        const gradients = this.worldedit.getGradientNames();
        this.pane.updateEntries(
            "gradient",
            gradients.map((label, value) => ({ label, value }))
        );

        const oldGradient = this.selectedGradient?.name;
        this.selectedGradientIdx.set(Math.min(Math.max(this.selectedGradientIdx.value, 0), gradients.length - 1));
        if (oldGradient !== this.selectedGradient?.name) this.updateGradientPanel();
    }

    private updateGradientPanel() {
        const gradient = this.selectedGradient;
        this.editPane.visible = !!this.selectedGradient;
        if (!this.editPane.visible) return;

        this.dithering.set(gradient.dither);
        this.editPatternList.patterns = gradient.patterns;
    }

    private saveSelectedGradient() {
        if (this.selectedGradientIdx.value < 0) return;
        this.worldedit.createGradient(this.selectedGradient.name, this.dithering.value, this.editPatternList.patterns);
    }
}
