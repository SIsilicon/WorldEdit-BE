import {
    IModalTool,
    IRootPropertyPane,
    IPlayerUISession,
    SupportedKeyboardActionTypes,
    KeyBinding,
    ActionTypes,
    ContinuousActionState,
    CursorControlMode,
    CursorProperties,
    CursorPropertiesChangeAfterEvent,
    CursorTargetMode,
    IBoolPropertyItem,
    INumberPropertyItem,
    IObservable,
    ISubPanePropertyItem,
    KeyboardKey,
    makeObservable,
    MouseInputType,
    NumberPropertyItemVariant,
} from "@minecraft/server-editor";
import { PersistenceManager, RelativeDirection, getRotationCorrectedDirectionVector, getInputMarkup } from "./modules/brushes/util";
import { newLineMarkup } from "./util";

export class SharedControl {
    public readonly localizationPrefix: string;
    public readonly tool: IModalTool;
    public readonly propertyPane: IRootPropertyPane;
    public readonly controlName: string;
    public readonly session: IPlayerUISession;

    private active = false;
    private initialized = false;

    constructor(session: IPlayerUISession, parentTool: IModalTool, parentPropertyPane: IRootPropertyPane, controlName: string, localizationPrefix: string) {
        this.session = session;
        this.tool = parentTool;
        this.propertyPane = parentPropertyPane;
        this.controlName = controlName;
        this.localizationPrefix = localizationPrefix;
    }

    get isActive() {
        return this.active;
    }

    get isInitialized() {
        return this.initialized;
    }

    initialize() {
        this.initialized = true;
    }

    shutdown() {
        this.initialized = false;
    }

    activateControl() {
        if (!this.initialized) throw new Error("Control must be initialized before it can be activated");
        if (this.active) throw new Error("Control is already active");
        this.active = true;
    }

    deactivateControl() {
        if (!this.active) throw new Error("Control is not active");
        this.active = false;
    }

    registerToolKeyBinding(action: SupportedKeyboardActionTypes, binding: KeyBinding, tag: string) {
        this.tool.registerKeyBinding(action, binding, {
            uniqueId: this.getToolKeyBindingId(tag),
            label: `${this.localizationPrefix}.keybinding.${tag}.title`,
            tooltip: `${this.localizationPrefix}.keybinding.${tag}.tooltip`,
        });
    }

    getToolKeyBindingId(tag: string) {
        return `${this.tool.id}:${this.controlName}Keybinding:${tag}`;
    }

    localize(key: string) {
        return `${this.localizationPrefix}.${key}`;
    }
}

const CursorModeControl_PERSISTENCE_GROUP_NAME = "worldedit:cursor";
const PERSISTENCE_GROUPITEM_NAME = "cursor_settings";
const PROPERTY_CURSORMODECONTROL_NAME = "CursorModeControl";
const PROPERTY_CURSORMODECONTROL_LOCALIZATION_PREFIX = `resourcePack.editor.${PROPERTY_CURSORMODECONTROL_NAME}`;
const KEY_REPEAT_DELAY = 5;
const KEY_REPEAT_INTERVAL = 1;

export class CursorModeControl extends SharedControl {
    public static readonly MIN_FIXED_DISTANCE = 1;
    public static readonly MAX_FIXED_DISTANCE = 128;

    private readonly overrideCursorProperties: CursorProperties;
    private readonly mouseControlMode: IObservable<CursorControlMode>;
    private readonly cursorTargetMode: IObservable<CursorTargetMode>;
    private readonly projectThroughWater: IObservable<boolean>;
    private readonly fixedDistanceCursor: IObservable<number>;
    private readonly persistenceManager: PersistenceManager;
    private readonly bindManualInput: boolean;

    private controlRootPane: ISubPanePropertyItem;
    private fixedDistanceSliderControl: INumberPropertyItem;
    private projectThroughWaterCheckbox: IBoolPropertyItem;
    private canMoveManually: () => boolean;
    private cachedCursorProperties: CursorProperties;
    private cursorPropertyEventSub: (ev: CursorPropertiesChangeAfterEvent) => void;

    constructor(session: IPlayerUISession, parentTool: IModalTool, parentPropertyPane: IRootPropertyPane, bindManualInput = true, overrideCursorProperties: CursorProperties) {
        super(session, parentTool, parentPropertyPane, PROPERTY_CURSORMODECONTROL_NAME, PROPERTY_CURSORMODECONTROL_LOCALIZATION_PREFIX);
        this.canMoveManually = () => true;
        this.persistenceManager = new PersistenceManager(session.extensionContext.player);
        this.bindManualInput = bindManualInput;
        const savedCursorProperties = this.loadSettings();
        this.overrideCursorProperties = {
            ...overrideCursorProperties,
        };
        this.cachedCursorProperties = this.overrideCursorProperties;
        if (savedCursorProperties) {
            delete savedCursorProperties.projectThroughLiquid;
            this.cachedCursorProperties = savedCursorProperties;
        }
        const currentCursorProperties = overrideCursorProperties ?? this.session.extensionContext.cursor.getDefaultProperties();
        this.mouseControlMode = makeObservable(this.cachedCursorProperties.controlMode ?? CursorControlMode.KeyboardAndMouse);
        this.cursorTargetMode = makeObservable(this.cachedCursorProperties.targetMode ?? CursorTargetMode.Block);
        this.projectThroughWater = makeObservable(currentCursorProperties.projectThroughLiquid ?? true);
        this.fixedDistanceCursor = makeObservable(this.cachedCursorProperties.fixedModeDistance ?? 5);
        currentCursorProperties.visible = true;
    }

    get cursorProperties() {
        const props: CursorProperties = {
            ...this.overrideCursorProperties,
            controlMode: this.mouseControlMode.value,
            targetMode: this.cursorTargetMode.value,
            fixedModeDistance: this.fixedDistanceCursor.value,
        };
        return props;
    }

    initialize() {
        super.initialize();
        this.tool.onModalToolActivation.subscribe((eventData) => {
            if (eventData.isActiveTool) {
                const savedCursorProperties = this.cachedCursorProperties;
                if (savedCursorProperties) {
                    if (savedCursorProperties.controlMode) this.mouseControlMode.set(savedCursorProperties.controlMode);
                    if (savedCursorProperties.targetMode) this.cursorTargetMode.set(savedCursorProperties.targetMode);
                    if (savedCursorProperties.fixedModeDistance) this.fixedDistanceCursor.set(savedCursorProperties.fixedModeDistance);
                }
                this.updateCursorProperties(this.session, true, this.mouseControlMode.value, this.cursorTargetMode.value, this.fixedDistanceCursor.value, this.fixedDistanceSliderControl, false);
            } else {
                this.session.extensionContext.cursor.popPropertiesById(this.tool.id);
            }
        });
        if (this.bindManualInput) {
            const moveBlockCursorManually = (session: IPlayerUISession, direction: RelativeDirection) => {
                const rotationY = session.extensionContext.player.getRotation().y;
                const rotationCorrectedVector = getRotationCorrectedDirectionVector(rotationY, direction);
                session.extensionContext.cursor.moveBy(rotationCorrectedVector);
            };
            const keyUpAction = this.session.actionManager.createAction({
                actionType: ActionTypes.ContinuousAction,
                onExecute: (state) => {
                    if (state === ContinuousActionState.End) return;
                    if (this.canMoveManually()) this.session.extensionContext.cursor.moveBy({ x: 0, y: 1, z: 0 });
                },
                repeatInterval: KEY_REPEAT_INTERVAL,
                repeatDelay: KEY_REPEAT_DELAY,
            });
            const keyDownAction = this.session.actionManager.createAction({
                actionType: ActionTypes.ContinuousAction,
                onExecute: (state) => {
                    if (state === ContinuousActionState.End) return;
                    if (this.canMoveManually()) this.session.extensionContext.cursor.moveBy({ x: 0, y: -1, z: 0 });
                },
                repeatInterval: KEY_REPEAT_INTERVAL,
                repeatDelay: KEY_REPEAT_DELAY,
            });
            const keyLeftAction = this.session.actionManager.createAction({
                actionType: ActionTypes.ContinuousAction,
                onExecute: (state) => {
                    if (state === ContinuousActionState.End) return;
                    if (this.canMoveManually()) moveBlockCursorManually(this.session, RelativeDirection.Left);
                },
                repeatInterval: KEY_REPEAT_INTERVAL,
                repeatDelay: KEY_REPEAT_DELAY,
            });
            const keyRightAction = this.session.actionManager.createAction({
                actionType: ActionTypes.ContinuousAction,
                onExecute: (state) => {
                    if (state === ContinuousActionState.End) return;
                    if (this.canMoveManually()) moveBlockCursorManually(this.session, RelativeDirection.Right);
                },
                repeatInterval: KEY_REPEAT_INTERVAL,
                repeatDelay: KEY_REPEAT_DELAY,
            });
            const keyForwardAction = this.session.actionManager.createAction({
                actionType: ActionTypes.ContinuousAction,
                onExecute: (state) => {
                    if (state === ContinuousActionState.End) return;
                    if (this.canMoveManually()) moveBlockCursorManually(this.session, RelativeDirection.Forward);
                },
                repeatInterval: KEY_REPEAT_INTERVAL,
                repeatDelay: KEY_REPEAT_DELAY,
            });
            const keyBackAction = this.session.actionManager.createAction({
                actionType: ActionTypes.ContinuousAction,
                onExecute: (state) => {
                    if (state === ContinuousActionState.End) return;
                    if (this.canMoveManually()) moveBlockCursorManually(this.session, RelativeDirection.Back);
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
                        const currentMode = this.mouseControlMode.value;
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
                        this.mouseControlMode.set(newMode);
                        this.updateCursorProperties(this.session, false, this.mouseControlMode.value, this.cursorTargetMode.value, this.fixedDistanceCursor.value, this.fixedDistanceSliderControl);
                    },
                });
                this.registerToolKeyBinding(keyToggleMouseControlModeAction, { key: KeyboardKey.KEY_T }, "toggleMouseTracking");
            }
            const mouseWheelAction = this.session.actionManager.createAction({
                actionType: ActionTypes.MouseRayCastAction,
                onExecute: (_, mouseProps) => {
                    if (mouseProps.inputType === MouseInputType.WheelOut && mouseProps.modifiers.shift) {
                        if (this.mouseControlMode.value === CursorControlMode.Fixed) {
                            let currentDistance = this.fixedDistanceCursor.value;
                            if (mouseProps.modifiers.shift) currentDistance += 5;
                            else currentDistance += 1;
                            currentDistance = Math.min(currentDistance, CursorModeControl.MAX_FIXED_DISTANCE);
                            this.fixedDistanceCursor.set(currentDistance);
                            this.updateCursorProperties(this.session, false, this.mouseControlMode.value, this.cursorTargetMode.value, this.fixedDistanceCursor.value, this.fixedDistanceSliderControl);
                        }
                    } else if (mouseProps.inputType === MouseInputType.WheelIn && mouseProps.modifiers.shift) {
                        if (this.mouseControlMode.value === CursorControlMode.Fixed) {
                            let currentDistance = this.fixedDistanceCursor.value;
                            if (mouseProps.modifiers.shift) currentDistance -= 5;
                            else currentDistance -= 1;
                            currentDistance = Math.max(currentDistance, CursorModeControl.MIN_FIXED_DISTANCE);
                            this.fixedDistanceCursor.set(currentDistance);
                            this.updateCursorProperties(this.session, false, this.mouseControlMode.value, this.cursorTargetMode.value, this.fixedDistanceCursor.value, this.fixedDistanceSliderControl);
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
                    const currentMode = this.cursorTargetMode.value;
                    const newMode = currentMode === CursorTargetMode.Block ? CursorTargetMode.Face : CursorTargetMode.Block;
                    this.cursorTargetMode.set(newMode);
                    this.updateCursorProperties(this.session, false, this.mouseControlMode.value, this.cursorTargetMode.value, this.fixedDistanceCursor.value, this.fixedDistanceSliderControl);
                },
            });
            this.registerToolKeyBinding(keyToggleTargetModeAction, { key: KeyboardKey.KEY_B }, "toggleBlockTargetMode");
        }
    }

    shutdown() {
        super.shutdown();
        if (this.cursorPropertyEventSub) {
            this.session.extensionContext.afterEvents.cursorPropertyChange.unsubscribe(this.cursorPropertyEventSub);
        }
    }

    activateControl() {
        super.activateControl();
        this.constructControlUI();
    }

    deactivateControl() {
        super.deactivateControl();
        this.destroyControlUI();
    }

    private destroyControlUI() {
        if (this.controlRootPane) {
            this.propertyPane.removeSubPane(this.controlRootPane);
            this.controlRootPane = undefined;
        }
    }

    private constructControlUI() {
        if (this.controlRootPane) this.destroyControlUI();

        this.controlRootPane = this.propertyPane.createSubPane({
            title: this.localize("rootPane.title"),
            infoTooltip: {
                title: this.localize("rootPane.title"),
                description: [this.localize("rootPane.tooltip")],
            },
            hasMargins: false,
        });
        {
            this.controlRootPane.addDropdown(this.mouseControlMode, {
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
                    this.updateCursorProperties(this.session, false, this.mouseControlMode.value, this.cursorTargetMode.value, this.fixedDistanceCursor.value, this.fixedDistanceSliderControl);
                },
            });
            this.mouseControlMode.set(this.cachedCursorProperties.controlMode ?? CursorControlMode.KeyboardAndMouse);
            this.cursorTargetMode.set(this.cachedCursorProperties.targetMode ?? CursorTargetMode.Block);
            this.fixedDistanceCursor.set(this.cachedCursorProperties.fixedModeDistance ?? 5);
            const fixedDistanceSliderVisible = this.cachedCursorProperties.controlMode === CursorControlMode.Fixed;
            this.fixedDistanceSliderControl = this.controlRootPane.addNumber(this.fixedDistanceCursor, {
                visible: fixedDistanceSliderVisible,
                isInteger: true,
                min: CursorModeControl.MIN_FIXED_DISTANCE,
                max: CursorModeControl.MAX_FIXED_DISTANCE,
                title: this.localize("fixedDistance.slider.title"),
                tooltip: this.localize("fixedDistance.slider.tooltip"),
                variant: NumberPropertyItemVariant.InputFieldAndSlider,
                onChange: () => {
                    this.updateCursorProperties(this.session, false, this.mouseControlMode.value, this.cursorTargetMode.value, this.fixedDistanceCursor.value, this.fixedDistanceSliderControl);
                },
            });
            this.session.extensionContext.afterEvents.cursorPropertyChange.subscribe((_event) => {
                if (_event.properties.fixedModeDistance !== undefined && _event.properties.fixedModeDistance !== this.fixedDistanceCursor.value) {
                    this.fixedDistanceCursor.set(_event.properties.fixedModeDistance);
                }
            });
        }
        {
            this.controlRootPane.addToggleGroup(this.cursorTargetMode, {
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
                    this.updateCursorProperties(this.session, false, this.mouseControlMode.value, this.cursorTargetMode.value, this.fixedDistanceCursor.value, this.fixedDistanceSliderControl);
                },
            });
        }
        {
            this.projectThroughWaterCheckbox = this.controlRootPane.addBool(this.projectThroughWater, {
                title: this.localize("projectThroughWater.title"),
                tooltip: this.localize("projectThroughWater.tooltip"),
                visible: this.mouseControlMode.value === CursorControlMode.Mouse || this.mouseControlMode.value === CursorControlMode.KeyboardAndMouse,
                onChange: () => {
                    const cursorProperties = {
                        projectThroughLiquid: this.projectThroughWater.value,
                    };
                    this.session.extensionContext.cursor.updatePropertiesById(cursorProperties, this.tool.id);
                },
            });
            this.cursorPropertyEventSub = this.session.extensionContext.afterEvents.cursorPropertyChange.subscribe((event) => {
                if (event.properties.projectThroughLiquid !== undefined) {
                    this.projectThroughWater.set(event.properties.projectThroughLiquid);
                }
            });
        }
    }

    private loadSettings() {
        const group = this.persistenceManager.getGroup(CursorModeControl_PERSISTENCE_GROUP_NAME);
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

    private saveSettings(settings: CursorProperties) {
        const group = this.persistenceManager.getOrCreateGroup(CursorModeControl_PERSISTENCE_GROUP_NAME);
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

    private updateCursorProperties(
        session: IPlayerUISession,
        isActivationUpdate: boolean,
        cursorControlMode: CursorControlMode,
        cursorTargetMode: CursorTargetMode,
        fixedDistanceValue: number,
        fixedDistanceSliderControl: INumberPropertyItem,
        isSaveSettings = true
    ) {
        const cursorProperties = {
            ...this.overrideCursorProperties,
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
        if (this.projectThroughWaterCheckbox) {
            this.projectThroughWaterCheckbox.visible = cursorControlMode === CursorControlMode.Mouse || cursorControlMode === CursorControlMode.KeyboardAndMouse;
        }
        if (isActivationUpdate) {
            session.extensionContext.cursor.pushPropertiesById(cursorProperties, this.tool.id);
        } else {
            session.extensionContext.cursor.updatePropertiesById(cursorProperties, this.tool.id);
        }
        this.cachedCursorProperties = cursorProperties;
        if (isSaveSettings) this.saveSettings(cursorProperties);
    }
}
