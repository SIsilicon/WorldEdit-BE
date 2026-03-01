import { Vector3, system } from "@minecraft/server";
import {
    IObservable,
    ISubPanePropertyItem,
    IPlayerUISession,
    IModalTool,
    IRootPropertyPane,
    makeObservable,
    ActionTypes,
    KeyboardKey,
    InputModifier,
    NumberPropertyItemVariant,
    ImageResourceType,
} from "@minecraft/server-editor";
import { Easing } from "@modules/easing";
import easingsFunctions from "@modules/extern/easingFunctions";
import { Mask } from "@modules/mask";
import { Pattern } from "@modules/pattern";
import { Databases, Vector } from "@notbeer-api";
import config from "config";
import { SharedControl } from "editor/control";
import { PaneItem, UIPane } from "editor/pane/builder";
import { MaskUIBuilder } from "editor/pane/mask";
import { PatternUIBuilder } from "editor/pane/pattern";
import { Database } from "library/@types/classes/databaseBuilder";
import { Brush, brushTypes } from "server/brushes/base_brush";
import { ErosionType } from "server/brushes/erosion_brush";
import { getEditorBrushManager } from "./manager";
import { RelativeDirection, getRotationCorrectedDirectionVector } from "./util";

const PROPERTY_BRUSHPAINTCONTROL_NAME = "BrushPaintControl";
const PROPERTY_BRUSHPAINTCONTROL_LOCALIZATION_PREFIX = `resourcePack.editor.${PROPERTY_BRUSHPAINTCONTROL_NAME}`;

enum BrushPaintControlStringKeys {
    RootPaneTitle = "rootPane.title",
    RootPaneTooltip = "brushSettings.tooltip",
    BrushShapeSelectionTitle = "brush.title",
    BrushShapeSelectionTooltip = "brush.tooltip",
    OffsetTitle = "offset.title",
    OffsetTooltip = "offset.tooltip",
    BrushShapeSettingsTitle = "shapeSettings.title",
    BrushShapeSettingsTooltip = "shapeSettings.tooltip",
    FillConstraintsTitle = "fillConstraints.title",
    FillConstraintsTooltip = "fillConstraints.tooltip",
    MaskModeTitle = "fillConstraints.maskMode.title",
    MaskModeTooltip = "fillConstraints.maskMode.tooltip",
}

export class BrushPaintSharedControl extends SharedControl {
    static readonly MIN_OFFSET = { x: -100, y: -100, z: -100 };
    static readonly MAX_OFFSET = { x: 100, y: 100, z: 100 };

    private readonly brushTypes: string[];
    private readonly selectedBrushIndex: IObservable<number>;
    private readonly brushShapeOffset: IObservable<{ x: number; y: number; z: number }>;
    private readonly brushSettings: {
        radius: IObservable<number>;
        height: IObservable<number>;
        depth: IObservable<number>;
        iterations: IObservable<number>;
        erosionType: IObservable<number>;
        smoothness: IObservable<number>;
        growPercent: IObservable<number>;
        falloffAmount: IObservable<number>;
        falloffType: IObservable<string>;
        pattern: PatternUIBuilder;
        heightMask: MaskUIBuilder;
        surfaceMask: MaskUIBuilder;
    };

    private brushControlRootPane: ISubPanePropertyItem;
    private brushSettingsSubPane: UIPane;
    private mask: MaskUIBuilder;
    private brushSettingsUpdateHandler: number;
    private settingsDatabase: Database;

    private brush: Brush;

    constructor(session: IPlayerUISession, parentTool: IModalTool, parentPropertyPane: IRootPropertyPane, brushTypes: string[]) {
        super(session, parentTool, parentPropertyPane, PROPERTY_BRUSHPAINTCONTROL_NAME, PROPERTY_BRUSHPAINTCONTROL_LOCALIZATION_PREFIX);
        this.brushTypes = brushTypes;
        this.selectedBrushIndex = makeObservable(0);
        this.brushShapeOffset = makeObservable({ x: 0, y: 0, z: 0 });
        this.brushSettings = {
            radius: makeObservable(3),
            height: makeObservable(3),
            depth: makeObservable(1),
            iterations: makeObservable(1),
            erosionType: makeObservable(ErosionType.DEFAULT),
            smoothness: makeObservable(0),
            growPercent: makeObservable(50),
            falloffAmount: makeObservable(0),
            falloffType: makeObservable("linear"),
            pattern: new PatternUIBuilder(new Pattern("stone")),
            heightMask: new MaskUIBuilder(),
            surfaceMask: new MaskUIBuilder(),
        };
        this.mask = new MaskUIBuilder();
        this.settingsDatabase = Databases.load("editor_brush_settings", session.extensionContext.player);
        this.loadBrushSettings();
    }

    initialize() {
        super.initialize();
        if (!this.tool) throw new Error("SharedControl tool is not set");

        this.brushSettings.pattern.on("changed", () => this.updateBrushSettings());
        this.brushSettings.heightMask.on("changed", () => this.updateBrushSettings());
        this.brushSettings.surfaceMask.on("changed", () => this.updateBrushSettings());
        this.mask.on("changed", () => this.updateBrushMask());

        const offsetNudgeUpAction = this.session.actionManager.createAction({
            actionType: ActionTypes.NoArgsAction,
            onExecute: () => this.nudgeOffset({ x: 0, y: 1, z: 0 }),
        });
        const offsetNudgeDownAction = this.session.actionManager.createAction({
            actionType: ActionTypes.NoArgsAction,
            onExecute: () => this.nudgeOffset({ x: 0, y: -1, z: 0 }),
        });
        const offsetNudgeForwardAction = this.session.actionManager.createAction({
            actionType: ActionTypes.NoArgsAction,
            onExecute: () => this.nudgeOffset(this.getRelativeNudgeDirection(RelativeDirection.Forward)),
        });
        const offsetNudgeBackAction = this.session.actionManager.createAction({
            actionType: ActionTypes.NoArgsAction,
            onExecute: () => this.nudgeOffset(this.getRelativeNudgeDirection(RelativeDirection.Back)),
        });
        const offsetNudgeLeftAction = this.session.actionManager.createAction({
            actionType: ActionTypes.NoArgsAction,
            onExecute: () => this.nudgeOffset(this.getRelativeNudgeDirection(RelativeDirection.Left)),
        });
        const offsetNudgeRightAction = this.session.actionManager.createAction({
            actionType: ActionTypes.NoArgsAction,
            onExecute: () => this.nudgeOffset(this.getRelativeNudgeDirection(RelativeDirection.Right)),
        });
        this.registerToolKeyBinding(offsetNudgeUpAction, { key: KeyboardKey.PAGE_UP, modifier: InputModifier.Control | InputModifier.Shift }, "nudgeOffsetUp");
        this.registerToolKeyBinding(offsetNudgeDownAction, { key: KeyboardKey.PAGE_DOWN, modifier: InputModifier.Control | InputModifier.Shift }, "nudgeOffsetDown");
        this.registerToolKeyBinding(offsetNudgeForwardAction, { key: KeyboardKey.UP, modifier: InputModifier.Control | InputModifier.Shift }, "nudgeOffsetForward");
        this.registerToolKeyBinding(offsetNudgeBackAction, { key: KeyboardKey.DOWN, modifier: InputModifier.Control | InputModifier.Shift }, "nudgeOffsetBack");
        this.registerToolKeyBinding(offsetNudgeLeftAction, { key: KeyboardKey.LEFT, modifier: InputModifier.Control | InputModifier.Shift }, "nudgeOffsetLeft");
        this.registerToolKeyBinding(offsetNudgeRightAction, { key: KeyboardKey.RIGHT, modifier: InputModifier.Control | InputModifier.Shift }, "nudgeOffsetRight");
        const toggleMask = this.session.actionManager.createAction({
            actionType: ActionTypes.NoArgsAction,
            onExecute: () => {
                if (!this.mask.value) this.mask.enable();
                else this.mask.disable();
            },
        });
        this.registerToolKeyBinding(toggleMask, { key: KeyboardKey.KEY_M }, "toggleMask");
    }

    activateControl() {
        if (this.isActive) {
            this.session.log.error("Cannot activate already active Brush Control");
            return;
        }
        super.activateControl();
        this.brushShapeOffset.set(getEditorBrushManager(this.session).getBrushShapeOffset());
        this.constructControlUI();
        this.brushControlRootPane?.show();
        getEditorBrushManager(this.session).activateBrushTool();
        this.setBrushType();
        this.updateBrushMask();
    }

    deactivateControl() {
        if (!this.isActive) {
            this.session.log.error("Cannot deactivate inactive Brush Control");
            return;
        }
        super.deactivateControl();
        getEditorBrushManager(this.session).deactivateBrushTool();
        this.destroyControlUI();
        this.brushControlRootPane?.hide();
    }

    private destroyControlUI() {
        if (this.brushControlRootPane) {
            this.propertyPane.removeSubPane(this.brushControlRootPane);
            this.brushControlRootPane = undefined;
        }
    }

    private constructControlUI() {
        if (this.brushControlRootPane) this.destroyControlUI();

        this.brushShapeOffset.set(getEditorBrushManager(this.session).getBrushShapeOffset());
        const settingsPane = new UIPane(
            this.session,
            {
                items: [
                    {
                        type: "dropdown",
                        title: this.localize(BrushPaintControlStringKeys.BrushShapeSelectionTitle),
                        tooltip: this.localize(BrushPaintControlStringKeys.BrushShapeSelectionTooltip),
                        entries: this.getBrushShapeDropdownEntries(),
                        value: this.selectedBrushIndex,
                        onChange: () => this.setBrushType(),
                    },
                    {
                        type: "vector3",
                        title: this.localize(BrushPaintControlStringKeys.OffsetTitle),
                        tooltip: this.localize(BrushPaintControlStringKeys.OffsetTooltip),
                        value: this.brushShapeOffset,
                        isInteger: true,
                        min: BrushPaintSharedControl.MIN_OFFSET,
                        max: BrushPaintSharedControl.MAX_OFFSET,
                        onChange: (newValue) => getEditorBrushManager(this.session).setBrushShapeOffset(newValue),
                    },
                    {
                        type: "subpane",
                        uniqueId: "settings",
                        title: this.localize(BrushPaintControlStringKeys.BrushShapeSettingsTitle),
                        infoTooltip: {
                            title: this.localize(BrushPaintControlStringKeys.BrushShapeSettingsTitle),
                            description: [this.localize(BrushPaintControlStringKeys.BrushShapeSettingsTooltip)],
                        },
                        items: this.getBrushSettingsItems(),
                    },
                ],
            },
            (this.brushControlRootPane = this.propertyPane.createSubPane({
                title: this.localize(BrushPaintControlStringKeys.RootPaneTitle),
                infoTooltip: {
                    title: this.localize(BrushPaintControlStringKeys.RootPaneTitle),
                    description: [this.localize(BrushPaintControlStringKeys.RootPaneTooltip)],
                },
                hasMargins: false,
            }))
        );

        this.brushSettingsSubPane = settingsPane.getSubPane("settings");
        this.setBrushType();

        new UIPane(this.session, { items: this.mask }, this.brushControlRootPane.createSubPane({ title: "Mask" }));
    }

    private updateBrushMask() {
        getEditorBrushManager(this.session).setBrushMask(this.mask.value ?? new Mask());
    }

    private getSelectedBrushType() {
        const currentBrushIndex = this.selectedBrushIndex.value;
        if (currentBrushIndex < 0 || currentBrushIndex >= this.brushTypes.length) {
            throw new Error("Invalid brush index");
        }
        return this.brushTypes[currentBrushIndex];
    }

    private setBrushType() {
        const brushType = brushTypes.get(this.getSelectedBrushType());
        const settings = Object.fromEntries(Object.entries(this.brushSettings).map(([key, observable]) => [key, observable.value]));
        this.brush = new brushType(...brushType.parseJSON(JSON.parse(JSON.stringify(settings))));
        getEditorBrushManager(this.session).setBrush(this.brush);
        this.updateBrushSettings();
        this.updateSettingsSubPane();
    }

    private updateSettingsSubPane() {
        if (!this.brushSettingsSubPane) return;
        this.brushSettingsSubPane.setVisibility("radius", "radius" in this.brush);
        this.brushSettingsSubPane.setVisibility("height", "height" in this.brush);
        this.brushSettingsSubPane.setVisibility("depth", "depth" in this.brush);
        this.brushSettingsSubPane.setVisibility("iterations", "iterations" in this.brush);
        this.brushSettingsSubPane.setVisibility("erosionType", "erosionType" in this.brush);
        this.brushSettingsSubPane.setVisibility("smoothness", "smoothness" in this.brush);
        this.brushSettingsSubPane.setVisibility("growPercent", "growPercent" in this.brush);
        this.brushSettingsSubPane.setVisibility("falloffAmount", "falloffAmount" in this.brush);
        this.brushSettingsSubPane.setVisibility("falloffType", "falloffType" in this.brush);
        this.brushSettingsSubPane.getSubPane("pattern").visible = "pattern" in this.brush;
        this.brushSettingsSubPane.getSubPane("heightMask").visible = "heightMask" in this.brush;
        this.brushSettingsSubPane.getSubPane("surfaceMask").visible = "surfaceMask" in this.brush;
        this.updateBrushSettings();
    }

    private getRelativeNudgeDirection(direction: RelativeDirection) {
        const rotationY = this.session.extensionContext.player.getRotation().y;
        const rotationCorrectedVector = getRotationCorrectedDirectionVector(rotationY, direction);
        return rotationCorrectedVector;
    }

    private nudgeOffset(nudgeVector: Vector3) {
        let update = Vector.add(this.brushShapeOffset.value, nudgeVector);
        update = Vector.min(Vector.max(update, BrushPaintSharedControl.MIN_OFFSET), BrushPaintSharedControl.MAX_OFFSET);
        this.brushShapeOffset.set(update);
        getEditorBrushManager(this.session).setBrushShapeOffset(update);
    }

    private getBrushShapeDropdownEntries() {
        return this.brushTypes.map((brush, index) => {
            const item = {
                label: `worldedit.config.brush.${brush.replace("_brush", "")}`,
                value: index,
                imageData: {
                    path: `pack://textures/ui/${brush}.png`,
                    type: ImageResourceType.Icon,
                },
            };
            return item;
        });
    }

    private getBrushSettingsItems(): PaneItem[] {
        return [
            {
                type: "slider",
                uniqueId: "radius",
                title: "Radius",
                ...{ min: 1, max: config.maxBrushRadius },
                isInteger: true,
                value: this.brushSettings.radius,
                onChange: () => this.updateBrushSettings(),
            },
            {
                type: "slider",
                uniqueId: "height",
                title: "Height",
                isInteger: true,
                value: this.brushSettings.height,
                onChange: () => this.updateBrushSettings(),
            },
            {
                type: "slider",
                uniqueId: "depth",
                title: "Depth",
                isInteger: true,
                value: this.brushSettings.depth,
                onChange: () => this.updateBrushSettings(),
            },
            {
                type: "slider",
                uniqueId: "iterations",
                title: "Iterations",
                isInteger: true,
                value: this.brushSettings.iterations,
                onChange: () => this.updateBrushSettings(),
            },
            {
                type: "dropdown",
                uniqueId: "erosionType",
                title: "Erosion Type",
                value: this.brushSettings.erosionType,
                entries: [
                    { label: "Erode", value: ErosionType.DEFAULT },
                    { label: "Melt", value: ErosionType.MELT },
                    { label: "Fill", value: ErosionType.FILL },
                    { label: "Lift", value: ErosionType.LIFT },
                    { label: "Smooth", value: ErosionType.SMOOTH },
                ],
                onChange: () => this.updateBrushSettings(),
            },
            {
                type: "slider",
                uniqueId: "smoothness",
                title: "Smoothness",
                ...{ min: 0, max: 6 },
                isInteger: true,
                value: this.brushSettings.smoothness,
                onChange: () => this.updateBrushSettings(),
            },
            {
                type: "slider",
                uniqueId: "growPercent",
                title: "Growth Percent",
                ...{ min: 0, max: 100 },
                variant: NumberPropertyItemVariant.InputFieldAndSlider,
                value: this.brushSettings.growPercent,
                onChange: () => this.updateBrushSettings(),
            },
            {
                type: "slider",
                uniqueId: "falloffAmount",
                title: "Falloff Amount",
                ...{ min: 0, max: 1 },
                variant: NumberPropertyItemVariant.InputFieldAndSlider,
                value: this.brushSettings.falloffAmount,
                onChange: () => this.updateBrushSettings(),
            },
            {
                type: "combo_box",
                uniqueId: "falloffType",
                title: "Falloff Type",
                value: this.brushSettings.falloffType,
                entries: Object.keys(easingsFunctions).map((type) => ({ label: type, value: type })),
                onChange: () => this.updateBrushSettings(),
            },
            {
                type: "subpane",
                uniqueId: "pattern",
                title: "Pattern",
                items: this.brushSettings.pattern,
            },
            {
                type: "subpane",
                uniqueId: "heightMask",
                title: "Height Mask",
                items: this.brushSettings.heightMask,
            },
            {
                type: "subpane",
                uniqueId: "surfaceMask",
                title: "Surface Mask",
                items: this.brushSettings.surfaceMask,
            },
        ];
    }

    private updateBrushSettings() {
        if (this.brushSettingsUpdateHandler) system.clearRun(this.brushSettingsUpdateHandler);
        this.brushSettingsUpdateHandler = system.runTimeout(() => {
            for (const property in this.brushSettings) {
                if (!(property in this.brush)) continue;
                if (property === "falloffType") {
                    this.brush[property] = new Easing(this.brushSettings[property].value);
                } else {
                    this.brush[property] = this.brushSettings[property].value;
                }
            }
            getEditorBrushManager(this.session).setBrush(this.brush);
            this.settingsDatabase.data = this.brush.toJSON();
            this.settingsDatabase.save();
        }, 5);
    }

    private loadBrushSettings() {
        const savedSettings = this.settingsDatabase.data;
        const brushType = brushTypes.get(savedSettings.id);
        if (!brushType) return;

        this.brush = new brushType(...brushType.parseJSON(savedSettings));
        this.selectedBrushIndex.set(this.brushTypes.indexOf(savedSettings.id));
        for (const property in savedSettings) {
            if (!(property in this.brushSettings)) continue;
            if (property === "falloffType") {
                this.brushSettings[property].set((this.brush[property] as Easing).type);
            } else {
                this.brushSettings[property].set(this.brush[property]);
            }
        }
    }
}
