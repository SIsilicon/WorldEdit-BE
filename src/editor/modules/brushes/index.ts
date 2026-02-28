import { system, Vector3 } from "@minecraft/server";
import {
    CursorControlMode,
    CursorTargetMode,
    ActionTypes,
    EditorInputContext,
    KeyboardKey,
    InputModifier,
    MouseActionType,
    MouseInputType,
    LogChannel,
    PaintCompletionState,
    ContinuousActionState,
    NumberPropertyItemVariant,
    makeObservable,
    ImageResourceType,
    IPlayerUISession,
    IModalTool,
    IRootPropertyPane,
    CursorProperties,
    ISubPanePropertyItem,
    IObservable,
    INumberPropertyItem,
    IBoolPropertyItem,
    CursorPropertiesChangeAfterEvent,
} from "@minecraft/server-editor";
import { Databases, Vector } from "@notbeer-api";
import { EditorModule } from "../base";
import { PersistenceManager, getInputMarkup, getRotationCorrectedDirectionVector, RelativeDirection } from "./util";
import { getEditorBrushManager } from "./manager";
import { Mask } from "@modules/mask";
import { UIPane } from "editor/pane/builder";
import { MaskUIBuilder } from "editor/pane/mask";
import { Brush, brushTypes } from "server/brushes/base_brush";
import { PatternUIBuilder } from "editor/pane/pattern";
import { Pattern } from "@modules/pattern";
import config from "config";
import { ErosionType } from "server/brushes/erosion_brush";
import easingsFunctions from "@modules/extern/easingFunctions";
import { Database } from "library/@types/classes/databaseBuilder";
import { Easing } from "@modules/easing";
import { SharedControl } from "editor/control";
import { newLineMarkup } from "editor/util";

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

class BrushPaintSharedControl extends SharedControl {
    private readonly brushTypes: string[];
    private readonly selectedBrushIndex: IObservable<number>;
    private readonly brushShapeOffset: IObservable<{ x: number; y: number; z: number }>;
    private brush: Brush;

    private brushControlRootPane: ISubPanePropertyItem;
    private brushSettingsSubPane: UIPane;
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
    private mask: MaskUIBuilder;
    private brushSettingsUpdateHandler: number;
    private settingsDatabase: Database;

    static readonly DEFAULT_NUMBER_MIN = 1;
    static readonly DEFAULT_NUMBER_MAX = 6;
    static readonly MIN_OFFSET = {
        x: -100,
        y: -100,
        z: -100,
    };
    static readonly MAX_OFFSET = {
        x: 100,
        y: 100,
        z: 100,
    };

    constructor(session: IPlayerUISession, parentTool: IModalTool, parentPropertyPane: IRootPropertyPane, brushTypes: string[]) {
        super(session, parentTool, parentPropertyPane, PROPERTY_BRUSHPAINTCONTROL_NAME, PROPERTY_BRUSHPAINTCONTROL_LOCALIZATION_PREFIX);
        this.settingsDatabase = Databases.load("editor_brush_settings", session.extensionContext.player);
        this.brushTypes = brushTypes;
        this.selectedBrushIndex = makeObservable(0);
        this.brushShapeOffset = makeObservable({ x: 0, y: 0, z: 0 });
        this.brushControlRootPane = undefined;
        this.brushSettingsSubPane = undefined;
        this.brushSettings = {
            radius: makeObservable(3),
            height: makeObservable(3),
            depth: makeObservable(1),
            iterations: makeObservable(1),
            erosionType: makeObservable(ErosionType.DEFAULT),
            smoothness: makeObservable(0.5),
            growPercent: makeObservable(0.5),
            falloffAmount: makeObservable(0),
            falloffType: makeObservable("linear"),
            pattern: new PatternUIBuilder(new Pattern("stone")),
            heightMask: new MaskUIBuilder(),
            surfaceMask: new MaskUIBuilder(),
        };
        this.mask = new MaskUIBuilder();
        this.loadBrushSettings();
    }

    initialize() {
        super.initialize();
        if (!this.tool) throw new Error("SharedControl tool is not set");

        const offsetNudgeUpAction = this.session.actionManager.createAction({
            actionType: ActionTypes.NoArgsAction,
            onExecute: () => {
                this.nudgeOffset({ x: 0, y: 1, z: 0 });
            },
        });
        const offsetNudgeDownAction = this.session.actionManager.createAction({
            actionType: ActionTypes.NoArgsAction,
            onExecute: () => {
                this.nudgeOffset({ x: 0, y: -1, z: 0 });
            },
        });
        const offsetNudgeForwardAction = this.session.actionManager.createAction({
            actionType: ActionTypes.NoArgsAction,
            onExecute: () => {
                const nudgeVector = this.getRelativeNudgeDirection(RelativeDirection.Forward);
                this.nudgeOffset(nudgeVector);
            },
        });
        const offsetNudgeBackAction = this.session.actionManager.createAction({
            actionType: ActionTypes.NoArgsAction,
            onExecute: () => {
                const nudgeVector = this.getRelativeNudgeDirection(RelativeDirection.Back);
                this.nudgeOffset(nudgeVector);
            },
        });
        const offsetNudgeLeftAction = this.session.actionManager.createAction({
            actionType: ActionTypes.NoArgsAction,
            onExecute: () => {
                const nudgeVector = this.getRelativeNudgeDirection(RelativeDirection.Left);
                this.nudgeOffset(nudgeVector);
            },
        });
        const offsetNudgeRightAction = this.session.actionManager.createAction({
            actionType: ActionTypes.NoArgsAction,
            onExecute: () => {
                const nudgeVector = this.getRelativeNudgeDirection(RelativeDirection.Right);
                this.nudgeOffset(nudgeVector);
            },
        });
        this.registerToolKeyBinding(
            offsetNudgeUpAction,
            {
                key: KeyboardKey.PAGE_UP,
                modifier: InputModifier.Control | InputModifier.Shift,
            },
            "nudgeOffsetUp"
        );
        this.registerToolKeyBinding(
            offsetNudgeDownAction,
            {
                key: KeyboardKey.PAGE_DOWN,
                modifier: InputModifier.Control | InputModifier.Shift,
            },
            "nudgeOffsetDown"
        );
        this.registerToolKeyBinding(
            offsetNudgeForwardAction,
            {
                key: KeyboardKey.UP,
                modifier: InputModifier.Control | InputModifier.Shift,
            },
            "nudgeOffsetForward"
        );
        this.registerToolKeyBinding(
            offsetNudgeBackAction,
            {
                key: KeyboardKey.DOWN,
                modifier: InputModifier.Control | InputModifier.Shift,
            },
            "nudgeOffsetBack"
        );
        this.registerToolKeyBinding(
            offsetNudgeLeftAction,
            {
                key: KeyboardKey.LEFT,
                modifier: InputModifier.Control | InputModifier.Shift,
            },
            "nudgeOffsetLeft"
        );
        this.registerToolKeyBinding(
            offsetNudgeRightAction,
            {
                key: KeyboardKey.RIGHT,
                modifier: InputModifier.Control | InputModifier.Shift,
            },
            "nudgeOffsetRight"
        );
        const toggleMask = this.session.actionManager.createAction({
            actionType: ActionTypes.NoArgsAction,
            onExecute: () => {
                if (!this.mask.value) this.mask.enable();
                else this.mask.disable();
            },
        });
        this.registerToolKeyBinding(
            toggleMask,
            {
                key: KeyboardKey.KEY_M,
            },
            "toggleMask"
        );
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
        this.brushControlRootPane?.hide();
    }

    private constructControlUI() {
        if (this.brushControlRootPane) return;

        this.brushControlRootPane = this.propertyPane.createSubPane({
            title: this.localize(BrushPaintControlStringKeys.RootPaneTitle),
            infoTooltip: {
                title: this.localize(BrushPaintControlStringKeys.RootPaneTitle),
                description: [this.localize(BrushPaintControlStringKeys.RootPaneTooltip)],
            },
            hasMargins: false,
        });
        this.brushControlRootPane.addDropdown(this.selectedBrushIndex, {
            title: this.localize(BrushPaintControlStringKeys.BrushShapeSelectionTitle),
            tooltip: this.localize(BrushPaintControlStringKeys.BrushShapeSelectionTooltip),
            entries: this.getBrushShapeDropdownEntries(),
            onChange: () => this.setBrushType(),
        });
        this.brushShapeOffset.set(getEditorBrushManager(this.session).getBrushShapeOffset());
        this.brushControlRootPane.addVector3(this.brushShapeOffset, {
            title: this.localize(BrushPaintControlStringKeys.OffsetTitle),
            tooltip: this.localize(BrushPaintControlStringKeys.OffsetTooltip),
            isInteger: true,
            min: BrushPaintSharedControl.MIN_OFFSET,
            max: BrushPaintSharedControl.MAX_OFFSET,
            onChange: (newValue) => {
                getEditorBrushManager(this.session).setBrushShapeOffset(newValue);
            },
        });

        this.brushSettingsSubPane = new UIPane(
            this.session,
            {
                items: [
                    {
                        type: "slider",
                        uniqueId: "radius",
                        title: "Radius",
                        ...{ min: 1, max: config.maxBrushRadius },
                        value: this.brushSettings.radius,
                        onChange: () => this.updateBrushSettings(),
                    },
                    {
                        type: "slider",
                        uniqueId: "height",
                        title: "Height",
                        value: this.brushSettings.height,
                        onChange: () => this.updateBrushSettings(),
                    },
                    {
                        type: "slider",
                        uniqueId: "depth",
                        title: "Depth",
                        value: this.brushSettings.depth,
                        onChange: () => this.updateBrushSettings(),
                    },
                    {
                        type: "slider",
                        uniqueId: "iterations",
                        title: "Iterations",
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
                        ...{ min: 0, max: 1, step: 0.1 },
                        variant: NumberPropertyItemVariant.InputFieldAndSlider,
                        value: this.brushSettings.smoothness,
                        onChange: () => this.updateBrushSettings(),
                    },
                    {
                        type: "slider",
                        uniqueId: "growPercent",
                        title: "Growth Percent",
                        ...{ min: 0, max: 1 },
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
                        items: this.brushSettings.pattern.on("changed", () => this.updateBrushSettings()),
                    },
                    {
                        type: "subpane",
                        uniqueId: "heightMask",
                        title: "Height Mask",
                        items: this.brushSettings.heightMask.on("changed", () => this.updateBrushSettings()),
                    },
                    {
                        type: "subpane",
                        uniqueId: "surfaceMask",
                        title: "Surface Mask",
                        items: this.brushSettings.surfaceMask.on("changed", () => this.updateBrushSettings()),
                    },
                ],
            },
            this.brushControlRootPane.createSubPane({
                title: this.localize(BrushPaintControlStringKeys.BrushShapeSettingsTitle),
                infoTooltip: {
                    title: this.localize(BrushPaintControlStringKeys.BrushShapeSettingsTitle),
                    description: [this.localize(BrushPaintControlStringKeys.BrushShapeSettingsTooltip)],
                },
            })
        );
        this.setBrushType();

        this.mask.on("changed", () => this.updateBrushMask());
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

const CursorModeControl_PERSISTENCE_GROUP_NAME = "worldedit:cursor";
const PERSISTENCE_GROUPITEM_NAME = "cursor_settings";
const PROPERTY_CURSORMODECONTROL_NAME = "CursorModeControl";
const PROPERTY_CURSORMODECONTROL_LOCALIZATION_PREFIX = `resourcePack.editor.${PROPERTY_CURSORMODECONTROL_NAME}`;
const KEY_REPEAT_DELAY = 5;
const KEY_REPEAT_INTERVAL = 1;

class CursorModeControl extends SharedControl {
    private _overrideCursorProperties: CursorProperties;
    private _controlRootPane: ISubPanePropertyItem;
    private _mouseControlMode: IObservable<CursorControlMode>;
    private _cursorTargetMode: IObservable<CursorTargetMode>;
    private _projectThroughWater: IObservable<boolean>;
    private _fixedDistanceCursor: IObservable<number>;
    private _canMoveManually: () => boolean;
    private _updateCursorProperties: (
        session: IPlayerUISession,
        isActivationUpdate: boolean,
        cursorControlMode: CursorControlMode,
        cursorTargetMode: CursorTargetMode,
        fixedDistanceValue: number,
        fixedDistanceSliderControl: INumberPropertyItem,
        isSaveSettings?: boolean
    ) => void;
    private _persistenceManager: PersistenceManager;
    private _bindManualInput: boolean;
    private _cachedCursorProperties: CursorProperties;
    private _moveForward?: () => void;
    private _moveBack?: () => void;
    private _moveLeft?: () => void;
    private _moveRight?: () => void;
    private _moveUp?: () => void;
    private _moveDown?: () => void;
    private _fixedDistanceSliderControl: INumberPropertyItem;
    private _projectThroughWaterCheckbox: IBoolPropertyItem;
    private _cursorPropertyEventSub: (ev: CursorPropertiesChangeAfterEvent) => void;

    public static readonly MIN_FIXED_DISTANCE = 1;
    public static readonly MAX_FIXED_DISTANCE = 128;

    get cursorProperties() {
        const props: CursorProperties = {
            ...this._overrideCursorProperties,
            controlMode: this._mouseControlMode.value,
            targetMode: this._cursorTargetMode.value,
            fixedModeDistance: this._fixedDistanceCursor.value,
        };
        return props;
    }

    constructor(session: IPlayerUISession, parentTool: IModalTool, parentPropertyPane: IRootPropertyPane, bindManualInput: boolean, overrideCursorProperties: CursorProperties) {
        super(session, parentTool, parentPropertyPane, PROPERTY_CURSORMODECONTROL_NAME, PROPERTY_CURSORMODECONTROL_LOCALIZATION_PREFIX);
        this._controlRootPane = undefined;
        this._mouseControlMode = makeObservable(CursorControlMode.KeyboardAndMouse);
        this._cursorTargetMode = makeObservable(CursorTargetMode.Block);
        this._projectThroughWater = makeObservable(true);
        this._fixedDistanceCursor = makeObservable(5);
        this._canMoveManually = () => true;
        this._updateCursorProperties = (session, isActivationUpdate, cursorControlMode, cursorTargetMode, fixedDistanceValue, fixedDistanceSliderControl, isSaveSettings = true) => {
            const cursorProperties = {
                ...this._overrideCursorProperties,
                controlMode: cursorControlMode,
                targetMode: cursorTargetMode,
                fixedModeDistance: fixedDistanceValue,
            };
            if (fixedDistanceSliderControl) {
                fixedDistanceSliderControl.visible = cursorControlMode === CursorControlMode.Fixed;
            }
            if (cursorControlMode === CursorControlMode.Keyboard) {
                this.session.toolRail.focusToolInputContext();
            }
            if (this._projectThroughWaterCheckbox) {
                this._projectThroughWaterCheckbox.visible = cursorControlMode === CursorControlMode.Mouse || cursorControlMode === CursorControlMode.KeyboardAndMouse;
            }
            if (isActivationUpdate) {
                session.extensionContext.cursor.pushPropertiesById(cursorProperties, this.tool.id);
            } else {
                session.extensionContext.cursor.updatePropertiesById(cursorProperties, this.tool.id);
            }
            this._cachedCursorProperties = cursorProperties;
            if (isSaveSettings) {
                this._saveSettings(cursorProperties);
            }
        };
        this._persistenceManager = new PersistenceManager(session.extensionContext.player);
        this._bindManualInput = bindManualInput ?? true;
        const savedCursorProperties = this._loadSettings();
        this._overrideCursorProperties = {
            ...overrideCursorProperties,
        };
        this._cachedCursorProperties = this._overrideCursorProperties;
        if (savedCursorProperties) {
            delete savedCursorProperties.projectThroughLiquid;
            this._cachedCursorProperties = savedCursorProperties;
        }
        const currentCursorProperties = overrideCursorProperties ?? this.session.extensionContext.cursor.getDefaultProperties();
        this._projectThroughWater.set(currentCursorProperties.projectThroughLiquid ?? true);
        this._mouseControlMode.set(this._cachedCursorProperties.controlMode ?? CursorControlMode.KeyboardAndMouse);
        this._cursorTargetMode.set(this._cachedCursorProperties.targetMode ?? CursorTargetMode.Block);
        this._fixedDistanceCursor.set(this._cachedCursorProperties.fixedModeDistance ?? 5);
        currentCursorProperties.visible = true;
    }
    bindMovementFunctions(canMove: (() => boolean) | undefined, moveForward: () => void, moveBack: () => void, moveLeft: () => void, moveRight: () => void, moveUp: () => void, moveDown: () => void) {
        this._canMoveManually = canMove ?? this._canMoveManually;
        this._moveForward = moveForward;
        this._moveBack = moveBack;
        this._moveLeft = moveLeft;
        this._moveRight = moveRight;
        this._moveUp = moveUp;
        this._moveDown = moveDown;
    }
    initialize() {
        super.initialize();
        this.tool.onModalToolActivation.subscribe((eventData) => {
            if (eventData.isActiveTool) {
                const savedCursorProperties = this._cachedCursorProperties;
                if (savedCursorProperties) {
                    if (savedCursorProperties.controlMode) {
                        this._mouseControlMode.set(savedCursorProperties.controlMode);
                    }
                    if (savedCursorProperties.targetMode) {
                        this._cursorTargetMode.set(savedCursorProperties.targetMode);
                    }
                    if (savedCursorProperties.fixedModeDistance) {
                        this._fixedDistanceCursor.set(savedCursorProperties.fixedModeDistance);
                    }
                }
                this._updateCursorProperties(this.session, true, this._mouseControlMode.value, this._cursorTargetMode.value, this._fixedDistanceCursor.value, this._fixedDistanceSliderControl, false);
            } else {
                this.session.extensionContext.cursor.popPropertiesById(this.tool.id);
            }
        });
        if (this._bindManualInput) {
            const _moveBlockCursorManually = (_session, _direction) => {
                const rotationY = _session.extensionContext.player.getRotation().y;
                const rotationCorrectedVector = getRotationCorrectedDirectionVector(rotationY, _direction);
                _session.extensionContext.cursor.moveBy(rotationCorrectedVector);
            };
            const keyUpAction = this.session.actionManager.createAction({
                actionType: ActionTypes.ContinuousAction,
                onExecute: (_state) => {
                    if (_state === ContinuousActionState.End) {
                        return;
                    }
                    if (this._canMoveManually()) {
                        this.session.extensionContext.cursor.moveBy({ x: 0, y: 1, z: 0 });
                        if (this._moveUp) {
                            this._moveUp();
                        }
                    }
                },
                repeatInterval: KEY_REPEAT_INTERVAL,
                repeatDelay: KEY_REPEAT_DELAY,
            });
            const keyDownAction = this.session.actionManager.createAction({
                actionType: ActionTypes.ContinuousAction,
                onExecute: (_state) => {
                    if (_state === ContinuousActionState.End) {
                        return;
                    }
                    if (this._canMoveManually()) {
                        this.session.extensionContext.cursor.moveBy({ x: 0, y: -1, z: 0 });
                        if (this._moveDown) {
                            this._moveDown();
                        }
                    }
                },
                repeatInterval: KEY_REPEAT_INTERVAL,
                repeatDelay: KEY_REPEAT_DELAY,
            });
            const keyLeftAction = this.session.actionManager.createAction({
                actionType: ActionTypes.ContinuousAction,
                onExecute: (_state) => {
                    if (_state === ContinuousActionState.End) {
                        return;
                    }
                    if (this._canMoveManually()) {
                        _moveBlockCursorManually(this.session, RelativeDirection.Left);
                        if (this._moveLeft) {
                            this._moveLeft();
                        }
                    }
                },
                repeatInterval: KEY_REPEAT_INTERVAL,
                repeatDelay: KEY_REPEAT_DELAY,
            });
            const keyRightAction = this.session.actionManager.createAction({
                actionType: ActionTypes.ContinuousAction,
                onExecute: (_state) => {
                    if (_state === ContinuousActionState.End) {
                        return;
                    }
                    if (this._canMoveManually()) {
                        _moveBlockCursorManually(this.session, RelativeDirection.Right);
                        if (this._moveRight) {
                            this._moveRight();
                        }
                    }
                },
                repeatInterval: KEY_REPEAT_INTERVAL,
                repeatDelay: KEY_REPEAT_DELAY,
            });
            const keyForwardAction = this.session.actionManager.createAction({
                actionType: ActionTypes.ContinuousAction,
                onExecute: (_state) => {
                    if (_state === ContinuousActionState.End) {
                        return;
                    }
                    if (this._canMoveManually()) {
                        _moveBlockCursorManually(this.session, RelativeDirection.Forward);
                        if (this._moveForward) {
                            this._moveForward();
                        }
                    }
                },
                repeatInterval: KEY_REPEAT_INTERVAL,
                repeatDelay: KEY_REPEAT_DELAY,
            });
            const keyBackAction = this.session.actionManager.createAction({
                actionType: ActionTypes.ContinuousAction,
                onExecute: (_state) => {
                    if (_state === ContinuousActionState.End) {
                        return;
                    }
                    if (this._canMoveManually()) {
                        _moveBlockCursorManually(this.session, RelativeDirection.Back);
                        if (this._moveBack) {
                            this._moveBack();
                        }
                    }
                },
                repeatInterval: KEY_REPEAT_INTERVAL,
                repeatDelay: KEY_REPEAT_DELAY,
            });
            this.registerToolKeyBinding(
                keyForwardAction,
                {
                    key: KeyboardKey.UP,
                },
                "moveCursorForward"
            );
            this.registerToolKeyBinding(
                keyBackAction,
                {
                    key: KeyboardKey.DOWN,
                },
                "moveCursorBack"
            );
            this.registerToolKeyBinding(
                keyLeftAction,
                {
                    key: KeyboardKey.LEFT,
                },
                "moveCursorLeft"
            );
            this.registerToolKeyBinding(
                keyRightAction,
                {
                    key: KeyboardKey.RIGHT,
                },
                "moveCursorRight"
            );
            this.registerToolKeyBinding(
                keyUpAction,
                {
                    key: KeyboardKey.PAGE_UP,
                },
                "moveCursorUp"
            );
            this.registerToolKeyBinding(
                keyDownAction,
                {
                    key: KeyboardKey.PAGE_DOWN,
                },
                "moveCursorDown"
            );
            {
                const keyToggleMouseControlModeAction = this.session.actionManager.createAction({
                    actionType: ActionTypes.NoArgsAction,
                    onExecute: () => {
                        const currentMode = this._mouseControlMode.value;
                        let newMode = CursorControlMode.Fixed;
                        switch (currentMode) {
                            case CursorControlMode.KeyboardAndMouse:
                                newMode = CursorControlMode.Fixed;
                                break;

                            case CursorControlMode.Fixed:
                                newMode = CursorControlMode.Keyboard;
                                break;

                            case CursorControlMode.Keyboard:
                            default:
                                newMode = CursorControlMode.KeyboardAndMouse;
                        }
                        this._mouseControlMode.set(newMode);
                        this._updateCursorProperties(
                            this.session,
                            false,
                            this._mouseControlMode.value,
                            this._cursorTargetMode.value,
                            this._fixedDistanceCursor.value,
                            this._fixedDistanceSliderControl
                        );
                    },
                });
                this.registerToolKeyBinding(
                    keyToggleMouseControlModeAction,
                    {
                        key: KeyboardKey.KEY_T,
                    },
                    "toggleMouseTracking"
                );
            }
            const mouseWheelAction = this.session.actionManager.createAction({
                actionType: ActionTypes.MouseRayCastAction,
                onExecute: (mouseRay, mouseProps) => {
                    if (mouseProps.inputType === MouseInputType.WheelOut && mouseProps.modifiers.shift) {
                        if (this._mouseControlMode.value === CursorControlMode.Fixed) {
                            let currentDistance = this._fixedDistanceCursor.value;
                            if (mouseProps.modifiers.shift) {
                                currentDistance += 5;
                            } else {
                                currentDistance += 1;
                            }
                            if (currentDistance > CursorModeControl.MAX_FIXED_DISTANCE) {
                                currentDistance = CursorModeControl.MAX_FIXED_DISTANCE;
                            }
                            this._fixedDistanceCursor.set(currentDistance);
                            this._updateCursorProperties(
                                this.session,
                                false,
                                this._mouseControlMode.value,
                                this._cursorTargetMode.value,
                                this._fixedDistanceCursor.value,
                                this._fixedDistanceSliderControl
                            );
                        }
                    } else if (mouseProps.inputType === MouseInputType.WheelIn && mouseProps.modifiers.shift) {
                        if (this._mouseControlMode.value === CursorControlMode.Fixed) {
                            let currentDistance = this._fixedDistanceCursor.value;
                            if (mouseProps.modifiers.shift) {
                                currentDistance -= 5;
                            } else {
                                currentDistance -= 1;
                            }
                            if (currentDistance < CursorModeControl.MIN_FIXED_DISTANCE) {
                                currentDistance = CursorModeControl.MIN_FIXED_DISTANCE;
                            }
                            this._fixedDistanceCursor.set(currentDistance);
                            this._updateCursorProperties(
                                this.session,
                                false,
                                this._mouseControlMode.value,
                                this._cursorTargetMode.value,
                                this._fixedDistanceCursor.value,
                                this._fixedDistanceSliderControl
                            );
                        }
                    }
                },
            });
            this.tool.registerMouseWheelBinding(mouseWheelAction);
        }
        {
            const keyToggleTargetModeAction = this.session.actionManager.createAction({
                actionType: ActionTypes.NoArgsAction,
                onExecute: () => {
                    const currentMode = this._cursorTargetMode.value;
                    const newMode = currentMode === CursorTargetMode.Block ? CursorTargetMode.Face : CursorTargetMode.Block;
                    this._cursorTargetMode.set(newMode);
                    this._updateCursorProperties(this.session, false, this._mouseControlMode.value, this._cursorTargetMode.value, this._fixedDistanceCursor.value, this._fixedDistanceSliderControl);
                },
            });
            this.registerToolKeyBinding(
                keyToggleTargetModeAction,
                {
                    key: KeyboardKey.KEY_B,
                },
                "toggleBlockTargetMode"
            );
        }
    }
    shutdown() {
        super.shutdown();
        if (this._cursorPropertyEventSub) {
            this.session.extensionContext.afterEvents.cursorPropertyChange.unsubscribe(this._cursorPropertyEventSub);
        }
    }
    activateControl() {
        super.activateControl();
        this._constructControlUI();
    }
    deactivateControl() {
        super.deactivateControl();
        this._destroyControlUI();
    }
    forceTargetMode(value: CursorTargetMode) {
        this._cursorTargetMode.set(value);
        this._updateCursorProperties(this.session, false, this._mouseControlMode.value, value, this._fixedDistanceCursor.value, this._fixedDistanceSliderControl);
    }
    _destroyControlUI() {
        if (this._controlRootPane) {
            this.propertyPane.removeSubPane(this._controlRootPane);
            this._controlRootPane = undefined;
        }
    }
    _constructControlUI() {
        if (this._controlRootPane) {
            this._destroyControlUI();
        }
        this._controlRootPane = this.propertyPane.createSubPane({
            title: this.localize("rootPane.title"),
            infoTooltip: {
                title: this.localize("rootPane.title"),
                description: [this.localize("rootPane.tooltip")],
            },
            hasMargins: false,
        });
        {
            this._controlRootPane.addDropdown(this._mouseControlMode, {
                title: this.localize("mouseControlMode.title"),
                tooltip: {
                    title: {
                        id: this.localize("mouseControlMode.tooltip.title"),
                        props: [getInputMarkup(this.getToolKeyBindingId("toggleMouseTracking"))],
                    },
                    description: {
                        id: this.localize("mouseControlMode.tooltip"),
                        props: [newLineMarkup + newLineMarkup, getInputMarkup(this.getToolKeyBindingId("toggleMouseTracking"))],
                    },
                },
                entries: [
                    {
                        label: this.localize("mouseControlMode.keyboard"),
                        value: CursorControlMode.Keyboard,
                    },
                    {
                        label: this.localize("mouseControlMode.keyboardAndMouse"),
                        value: CursorControlMode.KeyboardAndMouse,
                    },
                    {
                        label: this.localize("mouseControlMode.fixed"),
                        value: CursorControlMode.Fixed,
                    },
                ],
                onChange: () => {
                    this._updateCursorProperties(this.session, false, this._mouseControlMode.value, this._cursorTargetMode.value, this._fixedDistanceCursor.value, this._fixedDistanceSliderControl);
                },
            });
            this._mouseControlMode.set(this._cachedCursorProperties.controlMode ?? CursorControlMode.KeyboardAndMouse);
            this._cursorTargetMode.set(this._cachedCursorProperties.targetMode ?? CursorTargetMode.Block);
            this._fixedDistanceCursor.set(this._cachedCursorProperties.fixedModeDistance ?? 5);
            const fixedDistanceSliderVisible = this._cachedCursorProperties.controlMode === CursorControlMode.Fixed;
            this._fixedDistanceSliderControl = this._controlRootPane.addNumber(this._fixedDistanceCursor, {
                visible: fixedDistanceSliderVisible,
                isInteger: true,
                min: CursorModeControl.MIN_FIXED_DISTANCE,
                max: CursorModeControl.MAX_FIXED_DISTANCE,
                title: this.localize("fixedDistance.slider.title"),
                tooltip: this.localize("fixedDistance.slider.tooltip"),
                variant: NumberPropertyItemVariant.InputFieldAndSlider,
                onChange: () => {
                    this._updateCursorProperties(this.session, false, this._mouseControlMode.value, this._cursorTargetMode.value, this._fixedDistanceCursor.value, this._fixedDistanceSliderControl);
                },
            });
            this.session.extensionContext.afterEvents.cursorPropertyChange.subscribe((_event) => {
                if (_event.properties.fixedModeDistance !== undefined && _event.properties.fixedModeDistance !== this._fixedDistanceCursor.value) {
                    this._fixedDistanceCursor.set(_event.properties.fixedModeDistance);
                }
            });
        }
        {
            this._controlRootPane.addToggleGroup(this._cursorTargetMode, {
                title: this.localize("cursorTargetMode.title"),
                tooltip: {
                    title: {
                        id: this.localize("cursorTargetMode.tooltip.title"),
                        props: [getInputMarkup(this.getToolKeyBindingId("toggleBlockTargetMode"))],
                    },
                    description: {
                        id: this.localize("cursorTargetMode.tooltip"),
                        props: [getInputMarkup(this.getToolKeyBindingId("toggleBlockTargetMode"))],
                    },
                },
                entries: [
                    {
                        tooltip: {
                            title: {
                                id: this.localize("cursorTargetMode.block"),
                                props: [getInputMarkup(this.getToolKeyBindingId("toggleBlockTargetMode"))],
                            },
                            description: {
                                id: this.localize("cursorTargetMode.block.tooltip"),
                                props: [newLineMarkup + newLineMarkup, getInputMarkup(this.getToolKeyBindingId("toggleBlockTargetMode"))],
                            },
                        },
                        value: CursorTargetMode.Block,
                        icon: "pack://textures/editor/block-mode.png",
                    },
                    {
                        tooltip: {
                            title: {
                                id: this.localize("cursorTargetMode.face"),
                                props: [getInputMarkup(this.getToolKeyBindingId("toggleBlockTargetMode"))],
                            },
                            description: {
                                id: this.localize("cursorTargetMode.face.tooltip"),
                                props: [newLineMarkup + newLineMarkup, getInputMarkup(this.getToolKeyBindingId("toggleBlockTargetMode"))],
                            },
                        },
                        value: CursorTargetMode.Face,
                        icon: "pack://textures/editor/face-mode.png",
                    },
                ],
                onChange: () => {
                    this._updateCursorProperties(this.session, false, this._mouseControlMode.value, this._cursorTargetMode.value, this._fixedDistanceCursor.value, this._fixedDistanceSliderControl);
                },
            });
        }
        {
            this._projectThroughWaterCheckbox = this._controlRootPane.addBool(this._projectThroughWater, {
                title: this.localize("projectThroughWater.title"),
                tooltip: this.localize("projectThroughWater.tooltip"),
                visible: this._mouseControlMode.value === CursorControlMode.Mouse || this._mouseControlMode.value === CursorControlMode.KeyboardAndMouse,
                onChange: () => {
                    const cursorProperties = {
                        projectThroughLiquid: this._projectThroughWater.value,
                    };
                    this.session.extensionContext.cursor.updatePropertiesById(cursorProperties, this.tool.id);
                },
            });
            this._cursorPropertyEventSub = this.session.extensionContext.afterEvents.cursorPropertyChange.subscribe((event) => {
                if (event.properties.projectThroughLiquid !== undefined) {
                    this._projectThroughWater.set(event.properties.projectThroughLiquid);
                }
            });
        }
    }
    _loadSettings() {
        const group = this._persistenceManager.getGroup(CursorModeControl_PERSISTENCE_GROUP_NAME);
        if (group) {
            const key = `${this.tool.id}_${PERSISTENCE_GROUPITEM_NAME}`;
            const storeItem = group.fetchItem<CursorProperties>(key);
            if (storeItem && storeItem.value) {
                return storeItem.value;
            }
            group.dispose();
        }
        return undefined;
    }
    _saveSettings(settings: CursorProperties) {
        const group = this._persistenceManager.getOrCreateGroup(CursorModeControl_PERSISTENCE_GROUP_NAME);
        if (group) {
            const key = `${this.tool.id}_${PERSISTENCE_GROUPITEM_NAME}`;
            const storeItem = group.getOrCreateItem(key, settings);
            if (storeItem) {
                storeItem.commit();
            }
            group.dispose();
            return;
        }
    }
}

export class BrushPainterBehavior extends EditorModule {
    private readonly tool: IModalTool;
    private readonly rootPane: IRootPropertyPane;

    private readonly cursorProperties: CursorProperties;
    private readonly cursorModeControl: CursorModeControl;
    private readonly brushControl: BrushPaintSharedControl;

    private paintingActive = false;

    constructor(session: IPlayerUISession) {
        super(session);
        this.cursorProperties = {
            outlineColor: {
                red: 0,
                green: 0.5,
                blue: 0.5,
                alpha: 0.2,
            },
            controlMode: CursorControlMode.KeyboardAndMouse,
            targetMode: CursorTargetMode.Block,
            visible: true,
        };
        const activationAction = this.session.actionManager.createAction({
            actionType: ActionTypes.NoArgsAction,
            onExecute: () => this.session.toolRail.setSelectedToolId(this.tool.id),
        });
        this.tool = this.session.toolRail.addTool("worldedit:modalTool:brushPainter", {
            title: "resourcePack.editor.brushPaint.title",
            icon: "pack://textures/editor/Brush.png?filtering=point",
            tooltip: {
                description: {
                    id: "resourcePack.editor.brushPaint.tool.tooltip",
                    props: [getInputMarkup("worldedit:toolModeKeyBinding:togglePencilBrushMode")],
                },
            },
            action: activationAction,
        });
        this.session.inputManager.registerKeyBinding(
            EditorInputContext.GlobalToolMode,
            activationAction,
            {
                key: KeyboardKey.KEY_B,
                modifier: InputModifier.Control,
            },
            {
                uniqueId: "worldedit:toolModeKeyBinding:toggleBrushMode",
                label: "resourcePack.editor.brushPaint.inputContext.activateBrushPaint.title",
                tooltip: "resourcePack.editor.brushPaint.inputContext.activateBrushPaint.tooltip",
            }
        );
        this.rootPane = this.session.createPropertyPane({
            title: "resourcePack.editor.brushPaint.title",
            infoTooltip: {
                description: [
                    {
                        id: "resourcePack.editor.brushPaint.tool.tooltip",
                        props: [getInputMarkup("worldedit:toolModeKeyBinding:togglePencilBrushMode")],
                    },
                ],
            },
        });
        this.tool.bindPropertyPane(this.rootPane);
        this.cursorModeControl = new CursorModeControl(this.session, this.tool, this.rootPane, true, this.cursorProperties);
        this.cursorModeControl.initialize();
        this.brushControl = new BrushPaintSharedControl(
            this.session,
            this.tool,
            this.rootPane,
            Array.from(brushTypes.keys()).filter((type) => type !== "structure_brush")
        );
        this.brushControl.initialize();
        this.tool.onModalToolActivation.subscribe((data) => {
            if (data.isActiveTool) {
                this.cursorModeControl.activateControl();
                this.brushControl.activateControl();
            } else {
                this.onLeave();
            }
        });
        this.registerMouseUpDownAction();
        this.registerKeyboardInputActions();
    }

    teardown() {
        this.onLeave();
        this.cursorModeControl.shutdown();
        this.brushControl.shutdown();
    }

    private registerMouseUpDownAction() {
        const action = this.session.actionManager.createAction({
            actionType: ActionTypes.MouseRayCastAction,
            onExecute: (_mouseRay, mouseProps) => {
                if (mouseProps.mouseAction !== MouseActionType.LeftButton) return;

                if (mouseProps.inputType === MouseInputType.ButtonDown) {
                    this.beginPainting();
                } else if (mouseProps.inputType === MouseInputType.ButtonUp && this.paintingActive) {
                    this.endPainting();
                }
            },
        });
        this.tool.registerMouseButtonBinding(action);
    }

    private registerKeyboardInputActions() {
        const singlePressPaintAction = this.session.actionManager.createAction({
            actionType: ActionTypes.NoArgsAction,
            onExecute: () => {
                if (this.paintingActive) return;
                getEditorBrushManager(this.session).singlePaint((state) => {
                    if (state !== PaintCompletionState.Success) {
                        this.session.log.error(`Error during painting`, { channelMask: LogChannel.All });
                    }
                    this.paintingActive = false;
                });
            },
        });
        this.tool.registerKeyBinding(
            singlePressPaintAction,
            { key: KeyboardKey.ENTER },
            {
                uniqueId: "worldedit:brushPainter:paintAtCursor",
                label: "resourcePack.editor.brushPaint.inputContext.oneshot.title",
                tooltip: "resourcePack.editor.brushPaint.inputContext.oneshot.tooltip",
            }
        );
    }

    private beginPainting() {
        if (getEditorBrushManager(this.session).isBrushPaintBusy() || this.session.extensionContext.transactionManager.isBusy()) {
            this.session.log.warning(`Brush already active`);
            return;
        }
        this.paintingActive = true;
        getEditorBrushManager(this.session).beginPainting((state) => {
            if (state !== PaintCompletionState.Success) {
                this.session.log.error(`Error during painting`, {
                    channelMask: LogChannel.All,
                });
            }
            this.paintingActive = false;
        });
    }

    private endPainting() {
        this.paintingActive = false;
        getEditorBrushManager(this.session).endPainting(false);
    }

    private onLeave() {
        if (this.paintingActive) this.endPainting();
        if (this.cursorModeControl.isActive) this.cursorModeControl.deactivateControl();
        if (this.brushControl.isActive) this.brushControl.deactivateControl();
    }
}
