// import { ActionTypes, ContinuousActionState, CursorControlMode, CursorTargetMode, IModalTool, IPlayerUISession, IRootPropertyPane, KeyBinding, KeyboardKey, makeObservable, MouseInputType, NumberPropertyItemVariant, SupportedKeyboardActionTypes } from "@minecraft/server-editor";
// import { Vector } from "@notbeer-api";

// const CursorModeControl_PERSISTENCE_GROUP_NAME = "editor:cursor";
// const PERSISTENCE_GROUPITEM_NAME = "cursor_settings";
// const PROPERTY_CURSORMODECONTROL_NAME = "CursorModeControl";
// const PROPERTY_CURSORMODECONTROL_LOCALIZATION_PREFIX = `resourcePack.editor.${PROPERTY_CURSORMODECONTROL_NAME}`;
// const KEY_REPEAT_DELAY = 5;
// const KEY_REPEAT_INTERVAL = 1;

// class SharedControlImpl {
//     private readonly _session: IPlayerUISession;
//     private readonly _parentTool: IModalTool;
//     private readonly _parentPropertyPane: IRootPropertyPane;
//     private readonly _controlName: string;
//     private readonly _localizationPrefix: string;
//     private _isActive: boolean;
//     private _isInitialized: boolean;

//     constructor(session: IPlayerUISession, parentTool: IModalTool, parentPropertyPane: IRootPropertyPane, controlName: string, localizationPrefix: string) {
//         this._session = session;
//         this._parentTool = parentTool;
//         this._parentPropertyPane = parentPropertyPane;
//         this._controlName = controlName;
//         this._isActive = false;
//         this._isInitialized = false;
//         this._localizationPrefix = localizationPrefix;
//     }

//     initialize() {
//         this._isInitialized = true;
//     }

//     shutdown() {
//         this._isInitialized = false;
//     }

//     activateControl() {
//         if (!this._isInitialized) throw new Error("Control must be initialized before it can be activated");
//         if (this._isActive) throw new Error("Control is already active");
//         this._isActive = true;
//     }

//     deactivateControl() {
//         if (!this._isActive) throw new Error("Control is not active");
//         this._isActive = false;
//     }

//     registerToolKeyBinding(action: SupportedKeyboardActionTypes, binding: KeyBinding, tag: string) {
//         this._parentTool.registerKeyBinding(action, binding, {
//             uniqueId: this.getToolKeyBindingId(tag),
//             label: `${this._localizationPrefix}.keybinding.${tag}.title`,
//             tooltip: `${this._localizationPrefix}.keybinding.${tag}.tooltip`,
//         });
//     }

//     getToolKeyBindingId(tag: string) {
//         return `${this._parentTool.id}:${this._controlName}Keybinding:${tag}`;
//     }

//     localize(key: string) {
//         return `${this.localizationPrefix}.${key}`;
//     }

//     get session() {
//         return this._session;
//     }

//     get propertyPane() {
//         return this._parentPropertyPane;
//     }

//     get controlName() {
//         return this._controlName;
//     }

//     get tool() {
//         return this._parentTool;
//     }

//     get isActive() {
//         return this._isActive;
//     }

//     get isInitialized() {
//         return this._isInitialized;
//     }

//     get localizationPrefix() {
//         return this._localizationPrefix;
//     }
// }

// class CursorModeControl extends SharedControlImpl {
//     private _options;
//     private _controlRootPane;
//     private _mouseControlMode;
//     private _cursorTargetMode;
//     private _projectThroughWater;
//     private _fixedDistanceCursor;
//     private _canMoveManually;
//     private _updateCursorProperties;
//     private _overrideCursorProperties;
//     private _projectThroughWaterCheckbox;
//     private _cachedCursorProperties;
//     private _persistenceManager;
//     private _bindManualInput;
//     private _moveForward;
//     private _moveBack;
//     private _moveLeft;
//     private _moveRight;
//     private _moveUp;
//     private _moveDown;

//     constructor(_session: IPlayerUISession, _parentTool, _parentPropertyPane, _bindManualInput, _overrideCursorProperties, _options) {
//         super(_session, _parentTool, _parentPropertyPane, PROPERTY_CURSORMODECONTROL_NAME, PROPERTY_CURSORMODECONTROL_LOCALIZATION_PREFIX);
//         this._options = _options;
//         this._controlRootPane = undefined;
//         this._mouseControlMode = makeObservable(CursorControlMode.KeyboardAndMouse);
//         this._cursorTargetMode = makeObservable(CursorTargetMode.Block);
//         this._projectThroughWater = makeObservable(true);
//         this._fixedDistanceCursor = makeObservable(5);
//         this._canMoveManually = () => true;
//         this._updateCursorProperties = (session, isActivationUpdate, cursorControlMode, cursorTargetMode, fixedDistanceValue, fixedDistanceSliderControl, isSaveSettings = true) => {
//             const cursorProperties = {
//                 ...this._overrideCursorProperties,
//                 controlMode: cursorControlMode,
//                 targetMode: cursorTargetMode,
//                 fixedModeDistance: fixedDistanceValue,
//             };
//             if (fixedDistanceSliderControl) {
//                 fixedDistanceSliderControl.visible = cursorControlMode === CursorControlMode.Fixed;
//             }
//             if (cursorControlMode === CursorControlMode.Keyboard) {
//                 this.session.toolRail.focusToolInputContext();
//             }
//             if (this._projectThroughWaterCheckbox) {
//                 this._projectThroughWaterCheckbox.visible =
//                     cursorControlMode === CursorControlMode.Mouse || cursorControlMode === CursorControlMode.KeyboardAndMouse;
//             }
//             if (isActivationUpdate) {
//                 session.extensionContext.cursor.pushPropertiesById(cursorProperties, this.tool.id);
//             } else {
//                 session.extensionContext.cursor.updatePropertiesById(cursorProperties, this.tool.id);
//             }
//             this._cachedCursorProperties = cursorProperties;
//             if (isSaveSettings) {
//                 this._saveSettings(cursorProperties);
//             }
//         };
//         this._persistenceManager = getPersistenceManager(_session.extensionContext.player);
//         this._bindManualInput = _bindManualInput ?? true;
//         const savedCursorProperties = this._loadSettings();
//         this._overrideCursorProperties = {
//             ..._overrideCursorProperties,
//         };
//         this._cachedCursorProperties = this._overrideCursorProperties;
//         if (savedCursorProperties) {
//             delete savedCursorProperties.projectThroughLiquid;
//             this._cachedCursorProperties = savedCursorProperties;
//         }
//         const currentCursorProperties = _overrideCursorProperties ?? this.session.extensionContext.cursor.getDefaultProperties();
//         this._projectThroughWater.set(currentCursorProperties.projectThroughLiquid ?? true);
//         this._mouseControlMode.set(this._cachedCursorProperties.controlMode ?? CursorControlMode.KeyboardAndMouse);
//         this._cursorTargetMode.set(this._cachedCursorProperties.targetMode ?? CursorTargetMode.Block);
//         this._fixedDistanceCursor.set(this._cachedCursorProperties.fixedModeDistance ?? 5);
//         currentCursorProperties.visible = true;
//     }

//     get cursorProperties() {
//         const props = {
//             ...this._overrideCursorProperties,
//             controlMode: this._mouseControlMode.value,
//             targetMode: this._cursorTargetMode.value,
//             fixedModeDistance: this._fixedDistanceCursor.value,
//         };
//         return props;
//     }

//     bindMovementFunctions(canMove, moveForward, moveBack, moveLeft, moveRight, moveUp, moveDown) {
//         this._canMoveManually = canMove ?? this._canMoveManually;
//         this._moveForward = moveForward;
//         this._moveBack = moveBack;
//         this._moveLeft = moveLeft;
//         this._moveRight = moveRight;
//         this._moveUp = moveUp;
//         this._moveDown = moveDown;
//     }
//     initialize() {
//         super.initialize();
//         this.tool.onModalToolActivation.subscribe((eventData) => {
//             if (eventData.isActiveTool) {
//                 const savedCursorProperties = this._cachedCursorProperties;
//                 if (savedCursorProperties) {
//                     if (savedCursorProperties.controlMode) {
//                         this._mouseControlMode.set(savedCursorProperties.controlMode);
//                     }
//                     if (savedCursorProperties.targetMode) {
//                         this._cursorTargetMode.set(savedCursorProperties.targetMode);
//                     }
//                     if (savedCursorProperties.fixedModeDistance) {
//                         this._fixedDistanceCursor.set(savedCursorProperties.fixedModeDistance);
//                     }
//                 }
//                 this._updateCursorProperties(this.session, true, this._mouseControlMode.value, this._cursorTargetMode.value, this._fixedDistanceCursor.value, this._fixedDistanceSliderControl, false);
//             } else {
//                 this.session.extensionContext.cursor.popPropertiesById(this.tool.id);
//             }
//         });
//         if (this._bindManualInput) {
//             const _moveBlockCursorManually = (_session, _direction) => {
//                 const rotationY = _session.extensionContext.player.getRotation().y;
//                 const rotationCorrectedVector = getRotationCorrectedDirectionVector(rotationY, _direction);
//                 _session.extensionContext.cursor.moveBy(rotationCorrectedVector);
//             };
//             const keyUpAction = this.session.actionManager.createAction({
//                 actionType: ActionTypes.ContinuousAction,
//                 onExecute: (_state) => {
//                     if (_state === ContinuousActionState.End) {
//                         return;
//                     }
//                     if (this._canMoveManually()) {
//                         this.session.extensionContext.cursor.moveBy(Vector.UP);
//                         if (this._moveUp) {
//                             this._moveUp();
//                         }
//                     }
//                 },
//                 repeatInterval: KEY_REPEAT_INTERVAL,
//                 repeatDelay: KEY_REPEAT_DELAY,
//             });
//             const keyDownAction = this.session.actionManager.createAction({
//                 actionType: ActionTypes.ContinuousAction,
//                 onExecute: (_state) => {
//                     if (_state === ContinuousActionState.End) {
//                         return;
//                     }
//                     if (this._canMoveManually()) {
//                         this.session.extensionContext.cursor.moveBy(Vector.DOWN);
//                         if (this._moveDown) {
//                             this._moveDown();
//                         }
//                     }
//                 },
//                 repeatInterval: KEY_REPEAT_INTERVAL,
//                 repeatDelay: KEY_REPEAT_DELAY,
//             });
//             const keyLeftAction = this.session.actionManager.createAction({
//                 actionType: ActionTypes.ContinuousAction,
//                 onExecute: (_state) => {
//                     if (_state === ContinuousActionState.End) {
//                         return;
//                     }
//                     if (this._canMoveManually()) {
//                         _moveBlockCursorManually(this.session, direction_Direction.Left);
//                         if (this._moveLeft) {
//                             this._moveLeft();
//                         }
//                     }
//                 },
//                 repeatInterval: KEY_REPEAT_INTERVAL,
//                 repeatDelay: KEY_REPEAT_DELAY,
//             });
//             const keyRightAction = this.session.actionManager.createAction({
//                 actionType: ActionTypes.ContinuousAction,
//                 onExecute: (_state) => {
//                     if (_state === ContinuousActionState.End) {
//                         return;
//                     }
//                     if (this._canMoveManually()) {
//                         _moveBlockCursorManually(this.session, direction_Direction.Right);
//                         if (this._moveRight) {
//                             this._moveRight();
//                         }
//                     }
//                 },
//                 repeatInterval: KEY_REPEAT_INTERVAL,
//                 repeatDelay: KEY_REPEAT_DELAY,
//             });
//             const keyForwardAction = this.session.actionManager.createAction({
//                 actionType: ActionTypes.ContinuousAction,
//                 onExecute: (_state) => {
//                     if (_state === ContinuousActionState.End) {
//                         return;
//                     }
//                     if (this._canMoveManually()) {
//                         _moveBlockCursorManually(this.session, direction_Direction.Forward);
//                         if (this._moveForward) {
//                             this._moveForward();
//                         }
//                     }
//                 },
//                 repeatInterval: KEY_REPEAT_INTERVAL,
//                 repeatDelay: KEY_REPEAT_DELAY,
//             });
//             const keyBackAction = this.session.actionManager.createAction({
//                 actionType: ActionTypes.ContinuousAction,
//                 onExecute: (_state) => {
//                     if (_state === ContinuousActionState.End) {
//                         return;
//                     }
//                     if (this._canMoveManually()) {
//                         _moveBlockCursorManually(this.session, direction_Direction.Back);
//                         if (this._moveBack) {
//                             this._moveBack();
//                         }
//                     }
//                 },
//                 repeatInterval: KEY_REPEAT_INTERVAL,
//                 repeatDelay: KEY_REPEAT_DELAY,
//             });
//             this.registerToolKeyBinding(
//                 keyForwardAction,
//                 {
//                     key: KeyboardKey.UP,
//                 },
//                 "moveCursorForward"
//             );
//             this.registerToolKeyBinding(
//                 keyBackAction,
//                 {
//                     key: KeyboardKey.DOWN,
//                 },
//                 "moveCursorBack"
//             );
//             this.registerToolKeyBinding(
//                 keyLeftAction,
//                 {
//                     key: KeyboardKey.LEFT,
//                 },
//                 "moveCursorLeft"
//             );
//             this.registerToolKeyBinding(
//                 keyRightAction,
//                 {
//                     key: KeyboardKey.RIGHT,
//                 },
//                 "moveCursorRight"
//             );
//             this.registerToolKeyBinding(
//                 keyUpAction,
//                 {
//                     key: KeyboardKey.PAGE_UP,
//                 },
//                 "moveCursorUp"
//             );
//             this.registerToolKeyBinding(
//                 keyDownAction,
//                 {
//                     key: KeyboardKey.PAGE_DOWN,
//                 },
//                 "moveCursorDown"
//             );
//             {
//                 const keyToggleMouseControlModeAction = this.session.actionManager.createAction({
//                     actionType: ActionTypes.NoArgsAction,
//                     onExecute: () => {
//                         const currentMode = this._mouseControlMode.value;
//                         let newMode = CursorControlMode.Fixed;
//                         switch (currentMode) {
//                             case CursorControlMode.KeyboardAndMouse:
//                                 newMode = CursorControlMode.Fixed;
//                                 break;

//                             case CursorControlMode.Fixed:
//                                 newMode = CursorControlMode.Keyboard;
//                                 break;

//                             case CursorControlMode.Keyboard:
//                             default:
//                                 newMode = CursorControlMode.KeyboardAndMouse;
//                         }
//                         this._mouseControlMode.set(newMode);
//                         this._updateCursorProperties(
//                             this.session,
//                             false,
//                             this._mouseControlMode.value,
//                             this._cursorTargetMode.value,
//                             this._fixedDistanceCursor.value,
//                             this._fixedDistanceSliderControl
//                         );
//                     },
//                 });
//                 this.registerToolKeyBinding(
//                     keyToggleMouseControlModeAction,
//                     {
//                         key: KeyboardKey.KEY_T,
//                     },
//                     "toggleMouseTracking"
//                 );
//             }
//             const mouseWheelAction = this.session.actionManager.createAction({
//                 actionType: ActionTypes.MouseRayCastAction,
//                 onExecute: (mouseRay, mouseProps) => {
//                     if (mouseProps.inputType === MouseInputType.WheelOut && mouseProps.modifiers.shift) {
//                         if (this._mouseControlMode.value === CursorControlMode.Fixed) {
//                             let currentDistance = this._fixedDistanceCursor.value;
//                             if (mouseProps.modifiers.shift) {
//                                 currentDistance += 5;
//                             } else {
//                                 currentDistance += 1;
//                             }
//                             if (currentDistance > CursorModeControl.MAX_FIXED_DISTANCE) {
//                                 currentDistance = CursorModeControl.MAX_FIXED_DISTANCE;
//                             }
//                             this._fixedDistanceCursor.set(currentDistance);
//                             this._updateCursorProperties(
//                                 this.session,
//                                 false,
//                                 this._mouseControlMode.value,
//                                 this._cursorTargetMode.value,
//                                 this._fixedDistanceCursor.value,
//                                 this._fixedDistanceSliderControl
//                             );
//                         }
//                     } else if (mouseProps.inputType === MouseInputType.WheelIn && mouseProps.modifiers.shift) {
//                         if (this._mouseControlMode.value === CursorControlMode.Fixed) {
//                             let currentDistance = this._fixedDistanceCursor.value;
//                             if (mouseProps.modifiers.shift) {
//                                 currentDistance -= 5;
//                             } else {
//                                 currentDistance -= 1;
//                             }
//                             if (currentDistance < CursorModeControl.MIN_FIXED_DISTANCE) {
//                                 currentDistance = CursorModeControl.MIN_FIXED_DISTANCE;
//                             }
//                             this._fixedDistanceCursor.set(currentDistance);
//                             this._updateCursorProperties(
//                                 this.session,
//                                 false,
//                                 this._mouseControlMode.value,
//                                 this._cursorTargetMode.value,
//                                 this._fixedDistanceCursor.value,
//                                 this._fixedDistanceSliderControl
//                             );
//                         }
//                     }
//                 },
//             });
//             this.tool.registerMouseWheelBinding(mouseWheelAction);
//         }
//         {
//             const keyToggleTargetModeAction = this.session.actionManager.createAction({
//                 actionType: ActionTypes.NoArgsAction,
//                 onExecute: () => {
//                     const currentMode = this._cursorTargetMode.value;
//                     const newMode =
//                         currentMode === CursorTargetMode.Block
//                             ? CursorTargetMode.Face
//                             : CursorTargetMode.Block;
//                     this._cursorTargetMode.set(newMode);
//                     this._updateCursorProperties(this.session, false, this._mouseControlMode.value, this._cursorTargetMode.value, this._fixedDistanceCursor.value, this._fixedDistanceSliderControl);
//                 },
//             });
//             this.registerToolKeyBinding(
//                 keyToggleTargetModeAction,
//                 {
//                     key: KeyboardKey.KEY_B,
//                 },
//                 "toggleBlockTargetMode"
//             );
//         }
//     }
//     shutdown() {
//         super.shutdown();
//         if (this._cursorPropertyEventSub) {
//             this.session.extensionContext.afterEvents.cursorPropertyChange.unsubscribe(this._cursorPropertyEventSub);
//         }
//     }
//     activateControl() {
//         super.activateControl();
//         this._constructControlUI();
//     }
//     deactivateControl() {
//         super.deactivateControl();
//         this._destroyControlUI();
//     }
//     forceTargetMode(value) {
//         this._cursorTargetMode.set(value);
//         this._updateCursorProperties(this.session, false, this._mouseControlMode.value, value, this._fixedDistanceCursor.value, this._fixedDistanceSliderControl);
//     }
//     _destroyControlUI() {
//         if (this._controlRootPane) {
//             this.propertyPane.removeSubPane(this._controlRootPane);
//             this._controlRootPane = undefined;
//         }
//     }
//     _constructControlUI() {
//         if (this._controlRootPane) {
//             this._destroyControlUI();
//         }
//         this._controlRootPane = this.propertyPane.createSubPane({
//             title: this.localize("rootPane.title"),
//             infoTooltip: {
//                 title: this.localize("rootPane.title"),
//                 description: [this.localize("rootPane.tooltip")],
//             },
//             hasMargins: this._options?.hasPaneMargins,
//         });
//         {
//             this._controlRootPane.addDropdown(this._mouseControlMode, {
//                 title: this.localize("mouseControlMode.title"),
//                 tooltip: {
//                     title: {
//                         id: this.localize("mouseControlMode.tooltip.title"),
//                         props: [getInputMarkup(this.getToolKeyBindingId("toggleMouseTracking"))],
//                     },
//                     description: {
//                         id: this.localize("mouseControlMode.tooltip"),
//                         props: [newLineMarkup + newLineMarkup, getInputMarkup(this.getToolKeyBindingId("toggleMouseTracking"))],
//                     },
//                 },
//                 entries: [
//                     {
//                         label: this.localize("mouseControlMode.keyboard"),
//                         value: CursorControlMode.Keyboard,
//                     },
//                     {
//                         label: this.localize("mouseControlMode.keyboardAndMouse"),
//                         value: CursorControlMode.KeyboardAndMouse,
//                     },
//                     {
//                         label: this.localize("mouseControlMode.fixed"),
//                         value: CursorControlMode.Fixed,
//                     },
//                 ],
//                 onChange: () => {
//                     this._updateCursorProperties(this.session, false, this._mouseControlMode.value, this._cursorTargetMode.value, this._fixedDistanceCursor.value, this._fixedDistanceSliderControl);
//                 },
//             });
//             this._mouseControlMode.set(this._cachedCursorProperties.controlMode ?? CursorControlMode.KeyboardAndMouse);
//             this._cursorTargetMode.set(this._cachedCursorProperties.targetMode ?? CursorTargetMode.Block);
//             this._fixedDistanceCursor.set(this._cachedCursorProperties.fixedModeDistance ?? 5);
//             const fixedDistanceSliderVisible = this._cachedCursorProperties.controlMode === CursorControlMode.Fixed;
//             this._fixedDistanceSliderControl = this._controlRootPane.addNumber(this._fixedDistanceCursor, {
//                 visible: fixedDistanceSliderVisible,
//                 isInteger: true,
//                 min: CursorModeControl.MIN_FIXED_DISTANCE,
//                 max: CursorModeControl.MAX_FIXED_DISTANCE,
//                 title: this.localize("fixedDistance.slider.title"),
//                 tooltip: this.localize("fixedDistance.slider.tooltip"),
//                 variant: NumberPropertyItemVariant.InputFieldAndSlider,
//                 onChange: () => {
//                     this._updateCursorProperties(this.session, false, this._mouseControlMode.value, this._cursorTargetMode.value, this._fixedDistanceCursor.value, this._fixedDistanceSliderControl);
//                 },
//             });
//             this.session.extensionContext.afterEvents.cursorPropertyChange.subscribe((_event) => {
//                 if (_event.properties.fixedModeDistance !== undefined && _event.properties.fixedModeDistance !== this._fixedDistanceCursor.value) {
//                     this._fixedDistanceCursor.set(_event.properties.fixedModeDistance);
//                 }
//             });
//         }
//         {
//             this._controlRootPane.addToggleGroup(this._cursorTargetMode, {
//                 title: this.localize("cursorTargetMode.title"),
//                 tooltip: {
//                     title: {
//                         id: this.localize("cursorTargetMode.tooltip.title"),
//                         props: [getInputMarkup(this.getToolKeyBindingId("toggleBlockTargetMode"))],
//                     },
//                     description: {
//                         id: this.localize("cursorTargetMode.tooltip"),
//                         props: [getInputMarkup(this.getToolKeyBindingId("toggleBlockTargetMode"))],
//                     },
//                 },
//                 entries: [
//                     {
//                         tooltip: {
//                             title: {
//                                 id: this.localize("cursorTargetMode.block"),
//                                 props: [getInputMarkup(this.getToolKeyBindingId("toggleBlockTargetMode"))],
//                             },
//                             description: {
//                                 id: this.localize("cursorTargetMode.block.tooltip"),
//                                 props: [newLineMarkup + newLineMarkup, getInputMarkup(this.getToolKeyBindingId("toggleBlockTargetMode"))],
//                             },
//                         },
//                         value: CursorTargetMode.Block,
//                         icon: "pack://textures/editor/block-mode.png",
//                     },
//                     {
//                         tooltip: {
//                             title: {
//                                 id: this.localize("cursorTargetMode.face"),
//                                 props: [getInputMarkup(this.getToolKeyBindingId("toggleBlockTargetMode"))],
//                             },
//                             description: {
//                                 id: this.localize("cursorTargetMode.face.tooltip"),
//                                 props: [newLineMarkup + newLineMarkup, getInputMarkup(this.getToolKeyBindingId("toggleBlockTargetMode"))],
//                             },
//                         },
//                         value: CursorTargetMode.Face,
//                         icon: "pack://textures/editor/face-mode.png",
//                     },
//                 ],
//                 onChange: () => {
//                     this._updateCursorProperties(this.session, false, this._mouseControlMode.value, this._cursorTargetMode.value, this._fixedDistanceCursor.value, this._fixedDistanceSliderControl);
//                 },
//             });
//         }
//         {
//             this._projectThroughWaterCheckbox = this._controlRootPane.addBool(this._projectThroughWater, {
//                 title: this.localize("projectThroughWater.title"),
//                 tooltip: this.localize("projectThroughWater.tooltip"),
//                 visible:
//                     this._mouseControlMode.value === CursorControlMode.Mouse ||
//                     this._mouseControlMode.value === CursorControlMode.KeyboardAndMouse,
//                 onChange: () => {
//                     const cursorProperties = {
//                         projectThroughLiquid: this._projectThroughWater.value,
//                     };
//                     this.session.extensionContext.cursor.updatePropertiesById(cursorProperties, this.tool.id);
//                 },
//             });
//             this._cursorPropertyEventSub = this.session.extensionContext.afterEvents.cursorPropertyChange.subscribe((event) => {
//                 if (event.properties.projectThroughLiquid !== undefined) {
//                     this._projectThroughWater.set(event.properties.projectThroughLiquid);
//                 }
//             });
//         }
//     }
//     _loadSettings() {
//         const option = {
//             scope: server_editor_private_bindings_namespaceObject.PersistenceScope.ServerProject,
//             version: 0,
//         };
//         const group = this._persistenceManager.getGroup(CursorModeControl_PERSISTENCE_GROUP_NAME, option);
//         if (group) {
//             const key = `${this.tool.id}_${PERSISTENCE_GROUPITEM_NAME}`;
//             const storeItem = group.fetchItem(key);
//             if (storeItem && storeItem.value) {
//                 return storeItem.value;
//             }
//             group.dispose();
//         }
//         return undefined;
//     }
//     _saveSettings(settings) {
//         const option = {
//             scope: server_editor_private_bindings_namespaceObject.PersistenceScope.ServerProject,
//             version: 0,
//         };
//         const group = this._persistenceManager.getOrCreateGroup(CursorModeControl_PERSISTENCE_GROUP_NAME, option);
//         if (group) {
//             const key = `${this.tool.id}_${PERSISTENCE_GROUPITEM_NAME}`;
//             const storeItem = group.getOrCreateItem(key, settings);
//             if (storeItem) {
//                 storeItem.commit();
//             }
//             group.dispose();
//             return;
//         }
//     }
// }
// CursorModeControl.MAX_FIXED_DISTANCE = 32;
// CursorModeControl.MIN_FIXED_DISTANCE = 1;

//                         },
//                         value: CursorTargetMode.Face,
//                         icon: "pack://textures/editor/face-mode.png",
//                     },
//                 ],
//                 onChange: () => {
//                     this._updateCursorProperties(this.session, false, this._mouseControlMode.value, this._cursorTargetMode.value, this._fixedDistanceCursor.value, this._fixedDistanceSliderControl);
//                 },
//             });
//         }
//         {
//             this._projectThroughWaterCheckbox = this._controlRootPane.addBool(this._projectThroughWater, {
//                 title: this.localize("projectThroughWater.title"),
//                 tooltip: this.localize("projectThroughWater.tooltip"),
//                 visible:
//                     this._mouseControlMode.value === CursorControlMode.Mouse ||
//                     this._mouseControlMode.value === CursorControlMode.KeyboardAndMouse,
//                 onChange: () => {
//                     const cursorProperties = {
//                         projectThroughLiquid: this._projectThroughWater.value,
//                     };
//                     this.session.extensionContext.cursor.updatePropertiesById(cursorProperties, this.tool.id);
//                 },
//             });
//             this._cursorPropertyEventSub = this.session.extensionContext.afterEvents.cursorPropertyChange.subscribe((event) => {
//                 if (event.properties.projectThroughLiquid !== undefined) {
//                     this._projectThroughWater.set(event.properties.projectThroughLiquid);
//                 }
//             });
//         }
//     }
//     _loadSettings() {
//         const option = {
//             scope: server_editor_private_bindings_namespaceObject.PersistenceScope.ServerProject,
//             version: 0,
//         };
//         const group = this._persistenceManager.getGroup(CursorModeControl_PERSISTENCE_GROUP_NAME, option);
//         if (group) {
//             const key = `${this.tool.id}_${PERSISTENCE_GROUPITEM_NAME}`;
//             const storeItem = group.fetchItem(key);
//             if (storeItem && storeItem.value) {
//                 return storeItem.value;
//             }
//             group.dispose();
//         }
//         return undefined;
//     }
//     _saveSettings(settings) {
//         const option = {
//             scope: server_editor_private_bindings_namespaceObject.PersistenceScope.ServerProject,
//             version: 0,
//         };
//         const group = this._persistenceManager.getOrCreateGroup(CursorModeControl_PERSISTENCE_GROUP_NAME, option);
//         if (group) {
//             const key = `${this.tool.id}_${PERSISTENCE_GROUPITEM_NAME}`;
//             const storeItem = group.getOrCreateItem(key, settings);
//             if (storeItem) {
//                 storeItem.commit();
//             }
//             group.dispose();
//             return;
//         }
//     }
// }
// CursorModeControl.MAX_FIXED_DISTANCE = 32;
// CursorModeControl.MIN_FIXED_DISTANCE = 1;
