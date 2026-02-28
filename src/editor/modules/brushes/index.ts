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
    IPlayerUISession,
    IModalTool,
    IRootPropertyPane,
    CursorProperties,
} from "@minecraft/server-editor";
import { EditorModule } from "../base";
import { getInputMarkup } from "./util";
import { getEditorBrushManager } from "./manager";
import { brushTypes } from "server/brushes/base_brush";
import { CursorModeControl } from "editor/control";
import { BrushPaintSharedControl } from "./control";

export class BrushPainterModule extends EditorModule {
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
